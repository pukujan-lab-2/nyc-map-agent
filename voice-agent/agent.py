"""nyc-map-agent's voice call worker on LiveKit Agents: it hears and speaks; the rider's page decides what to say.

Copied from design-bakery's worker (Pukujan/design-bakery voice-agent/agent.py at 268b2dc, itself a copy of
pukujan-lab-2/voice-agent-research demo/live-site/speech/agent.py) for the hands-free live-call pilot (issue 299,
docs/PLAN-livekit-hands-free.md), so this app's calls can be tuned on their own. It registers as AGENT_NAME (default
nyc-map-voice) and only joins rooms whose token asks for it (server/features/agent/voiceToken.ts); design-bakery's worker never
joins those rooms, nor this one theirs. Speech goes through the shared gateway as X-Speech-Project nyc-map, whose route there is
the multilingual stack. The RPC names below (copilot.greet, copilot.turn) are design-bakery's; the page here answers them with
the map's own agent (src/lib/voice/liveCall.ts). As in design-bakery's version, so other people in the rider's space are not
answered (voice-agent/README.md):
  Hush (hush.py) takes background voices and noise out of the caller's audio before anything hears it;
  the voice match (voiceprint.py) learns the caller's voice and drops turns in anyone else's, the copilot's own echo included;
  a short line the recogniser was unsure of is dropped too; a stricter voice detector and a longer barge-in.
  A dropped turn reaches the page as copilot.ignored (shown greyed, with "answer this"; agent.claim says it was the caller's),
  and is an empty transcript to LiveKit, so a reply it talked over carries on (a false interruption).

  caller's browser ──WebRTC──► LiveKit server (local, dev mode) ◄──► this worker
    Silero VAD + LiveKit's turn detector end each turn and handle barge-in (the caller talks over the voice);
    LocalSTT / LocalTTS call speech/server.py with the call's voice stack (stacks.json, docs/decisions/0012):
      english-fast  Parakeet to listen, the English turn detector, Pocket TTS to speak
      multilingual  Whisper large-v3-turbo, the multilingual turn detector, Kokoro in the caller's language
      lfm3-audio    LFM3-Audio hears and speaks (one model on llama.cpp), turns end on voice activity alone
    The token (server/features/agent/voiceToken.ts) puts the stack and the rider's language on the caller's participant
    attributes (copilot.stack, copilot.language); a language changed mid-call takes effect from the next turn;
    the decision step is the rider's page (src/lib/voice/liveCall.ts, then /api/agent), reached over LiveKit RPC:
      copilot.greet  -> the short spoken intro          copilot.turn {text} -> the reply to speak
    so the agent's tools and its map actions stay where they are for typed questions.

Every turn goes to Phoenix through Octo (telemetry.py), in the page's call session: what was heard, and from the
moment the caller stops talking, the end-of-turn wait (VAD and turn detector), STT, the engine's decision (which includes
any library search) and the voice's first audio; barge-ins, failed RPC calls and speech errors too. A watchdog
(stall_watchdog.py) logs a stall (the caller spoke and no turn came of it) as an error span and starts the turn over.

Run: voice-agent/.venv/bin/python voice-agent/agent.py dev   (with Hush: the Dockerfile; voice-agent/README.md)
"""
import asyncio, contextlib, difflib, inspect, json, os, re, time, uuid

import aiohttp
import numpy as np
from livekit import rtc
from livekit.agents import (
    Agent, AgentServer, AgentSession, APIConnectOptions, JobContext, JobProcess, StopResponse, cli, stt, tts,
)
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
from livekit.agents.voice.room_io import AudioInputOptions, RoomOptions
from livekit.plugins import silero
from livekit.plugins.turn_detector.english import EnglishModel
from livekit.plugins.turn_detector.multilingual import MultilingualModel
import hush
from speech_text import spoken
from stall_watchdog import StallWatchdog
from telemetry import CallTelemetry
from voiceprint import Heard, VoicePrint, load_embedder

SPEECH = os.environ.get('SPEECH_URL', 'http://127.0.0.1:8799')
# On the VPS SPEECH_URL is the shared speech gateway (voice-agent-research docs/speech-gateway.md). Every speech request names the
# project and the call, so the whole call stays on one speech server, and the call's place is released when it ends. A 503
# no_room (every server full) is an ordinary speech error here: these calls use our own models only, there is no cloud voice.
SPEECH_PROJECT = os.environ.get('SPEECH_PROJECT', 'nyc-map')
AGENT_NAME = os.environ.get('AGENT_NAME', 'nyc-map-voice')
VOICE_MATCH_MODEL = os.environ.get('VOICE_MATCH_MODEL', '')  # the speaker model (voiceprint.py); unset: every voice is kept
# A short turn the recogniser was unsure of is someone else in the room, a TV or a noise, not the caller: on 2026-11-03 "Cat" (0.65),
# "But it's coming." (0.64) and "Agantic What?" (0.68) were background; real short replies scored 0.76 to 0.99.
MIN_CONFIDENCE = float(os.environ.get('MIN_CONFIDENCE', 0.7))
SHORT_WORDS = 3
# A line dropped as another voice and then said again soon after is the caller asking twice ("Tell the joke.", then "Tell a
# joke.", both dropped on 2026-11-08): the second is kept and both join the caller's voice.
REPEAT_S = 30.0
# A short unsure line in a voice this close to the caller's is the caller ("They are showing.", 0.47, dropped as unsure on
# 2026-11-08); background voices scored 0.04 to 0.27 in the scripted calls.
CALLER_LIKE = 0.4
REPEAT_LIKE = 0.75
# Short answers to a question the copilot asked are kept even when the recogniser is unsure of them.
REPLY = re.compile(r'^(?:yes|yeah|yep|yup|no|nope|nah|sure|ok|okay|please|thanks|thank you|hello|hi|hey|stop|wait)\W*$', re.I)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stacks.json')) as f:
    STACKS = json.load(f)


class Voice:
    """The call's stack and language. language is the caller's pick, or '' to go by what the recogniser hears."""

    def __init__(self, stack: str, language: str):
        self.stack = stack if stack in STACKS['stacks'] else STACKS['default']
        self.parts = STACKS['stacks'][self.stack]
        self.picked = ''
        self.heard = ''
        self.pick(language)

    def pick(self, language: str) -> None:
        self.picked = language if language in self.parts['languages'] else ''

    @property
    def language(self) -> str:
        """What the voice speaks and the reply is written in: the pick, else the last language heard that the stack speaks."""
        return self.picked or (self.heard if self.heard in self.parts['languages'] else self.parts['languages'][0])


class LocalSTT(stt.STT):
    """One finished turn to text on speech/server.py with the stack's listener. The VAD cuts the turns, so no streaming is needed."""

    def __init__(self, http: aiohttp.ClientSession, voice: Voice, prints: VoicePrint):
        super().__init__(capabilities=stt.STTCapabilities(streaming=False, interim_results=False))
        self._http, self._voice, self.prints = http, voice, prints
        self.last_ms = 0
        self.last_confidence: float | None = None  # the model's mean token probability for the last turn, 0 to 1
        self.last_language = 'en'
        self.last_heard = Heard(None, 0.0)  # the last turn's voice and its match against the caller's
        self._last_drop: tuple[str, float, Heard] | None = None  # the last line dropped as another voice: words, when, voice
        self.on_request = lambda: None  # told when a turn's audio reaches the recogniser (the stall watchdog)
        self.on_dropped = lambda text, reason, heard: None  # told of a turn dropped before the copilot saw it

    @property
    def model(self) -> str:
        return self._voice.parts['listens']

    @property
    def provider(self) -> str:
        return 'local'

    async def warm(self) -> None:
        # Parakeet is slow on its first turn after a while idle; Whisper is warmed when it loads, and a second call on
        # it would only queue behind the caller's first turn.
        if not self._voice.parts['listens'].startswith('parakeet'):
            return
        noise = (np.random.default_rng().standard_normal(16000 * 2) * 0.01).astype(np.float32).tobytes()
        try:
            async with self._http.post(f'{SPEECH}/stt', params={'sr': 16000, 'stack': self._voice.stack, 'lang': 'en'}, data=noise, headers={'content-type': 'application/octet-stream'}) as r:
                await r.read()
        except aiohttp.ClientError:
            pass

    def _timeout(self, conn_options: APIConnectOptions) -> float:
        # Whisper pads every clip to 30 s of audio and shares the GPU, so on a busy 8 GB laptop a turn can take
        # well over LiveKit's default 10 s (34 s for one turn, seen with the machine in swap); dropping it would lose what the caller said.
        return conn_options.timeout if self._voice.parts['listens'].startswith('parakeet') else max(conn_options.timeout, 60.0)

    async def _recognize_impl(self, buffer, *, language=None, conn_options: APIConnectOptions) -> stt.SpeechEvent:
        self.on_request()
        frame = rtc.combine_audio_frames(buffer)
        samples = _samples(frame)
        t = time.perf_counter()
        v = self._voice
        # Whose voice it is, worked out beside the recogniser so it adds no wait (the caller's audio is 16 kHz: hush.RATE).
        hearing = asyncio.create_task(asyncio.to_thread(self.prints.hear, samples)) if frame.sample_rate == hush.RATE else None
        async with self._http.post(f'{SPEECH}/stt', params={'sr': frame.sample_rate, 'stack': v.stack, 'lang': v.picked}, data=samples.tobytes(),
                                   headers={'content-type': 'application/octet-stream'},
                                   timeout=aiohttp.ClientTimeout(total=self._timeout(conn_options))) as r:
            r.raise_for_status()
            j = await r.json()
        text = j.get('text', '')
        self.last_confidence = j.get('confidence')
        # The language the recogniser heard (or was told): the turn detector, the voice and the turn's record go by it.
        if text and j.get('language'):
            v.heard = j['language']
        self.last_language = j.get('language') or v.language
        self.last_ms = round((time.perf_counter() - t) * 1000)
        self.last_heard = heard = await hearing if hearing else Heard(None, len(samples) / frame.sample_rate)
        reason = self._dropped(text, heard)
        if reason:
            print('dropped', repr(text), reason, 'match', heard.score, 'confidence', self.last_confidence, flush=True)
            self.on_dropped(text, reason, heard)
            text = ''  # nothing was said to the copilot: LiveKit makes no turn of it, and a reply it talked over resumes
        elif text:
            self.prints.learn(heard, self.last_confidence)
        return stt.SpeechEvent(type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                               alternatives=[stt.SpeechData(language=j.get('language') or v.language, text=text)])

    def _dropped(self, text: str, heard: Heard) -> str:
        """Why the turn is not the caller talking to the copilot, or '' to keep it."""
        said = FILLER.sub('', text.strip()).strip()
        if not said:
            return ''  # silence or "hmm": Copilot.on_user_turn_completed lets it pass without a reply
        if heard.other:
            if self._said_again(said, heard):
                return ''
            self._last_drop = (said.lower(), time.monotonic(), heard)
            return 'another voice'
        confidence = self.last_confidence
        caller = heard.score is not None and heard.score >= CALLER_LIKE  # clearly the caller's voice, unsure words or not
        if confidence is not None and confidence < MIN_CONFIDENCE and len(said.split()) <= SHORT_WORDS and not REPLY.match(said) and not caller:
            return 'unsure and short'
        return ''

    def _said_again(self, said: str, heard: Heard) -> bool:
        """This line repeats the last one dropped as another voice, soon after: the caller asking twice. Both voices join theirs."""
        last = self._last_drop
        if last is None or time.monotonic() - last[1] > REPEAT_S:
            return False
        if difflib.SequenceMatcher(None, last[0], said.lower()).ratio() < REPEAT_LIKE:
            return False
        self._last_drop = None
        self.prints.claim(last[2])
        self.prints.claim(heard)
        return True


def _samples(frame: rtc.AudioFrame) -> np.ndarray:
    """The frame as mono float32 in [-1, 1], what the speech server and the voice match take."""
    pcm = np.frombuffer(frame.data, dtype=np.int16)
    if frame.num_channels > 1:
        pcm = pcm.reshape(-1, frame.num_channels).mean(axis=1)
    return pcm.astype(np.float32) / 32768


class LocalTTS(tts.TTS):
    """The stack's voice on speech/server.py, in the call's language, streamed: the first words play while the rest is made."""

    def __init__(self, http: aiohttp.ClientSession, sample_rate: int, voice: Voice):
        super().__init__(capabilities=tts.TTSCapabilities(streaming=False), sample_rate=sample_rate, num_channels=1)
        self._http, self._voice = http, voice
        self.first_ms: int | None = None  # the last reply's first audio, from the request

    @property
    def model(self) -> str:
        return self._voice.parts['speaks']

    @property
    def provider(self) -> str:
        return 'local'

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> tts.ChunkedStream:
        return _LocalStream(tts=self, input_text=text, conn_options=conn_options)


class _LocalStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        t: LocalTTS = self._tts  # type: ignore[assignment]
        output_emitter.initialize(request_id=uuid.uuid4().hex, sample_rate=t.sample_rate, num_channels=1,
                                  mime_type='audio/pcm', frame_size_ms=40, stream=False)
        async with t._http.post(f'{SPEECH}/tts', json={'text': self._input_text, 'stack': t._voice.stack, 'lang': t._voice.language},
                                timeout=aiohttp.ClientTimeout(total=60, sock_read=self._conn_options.timeout)) as r:
            r.raise_for_status()
            async for chunk in r.content.iter_any():
                if t.first_ms is None:
                    t.first_ms = round((time.perf_counter() - self._started_time) * 1000)
                output_emitter.push(chunk)
        output_emitter.flush()


# "Hmm.", "uh", "um", "like": thinking aloud at the start of a turn is not part of the question (copilot-engine's stripFillers).
FILLER = re.compile(r'^(?:(?:hmm+|hm+|uh+|um+|umm+|er+|erm|ah+|oh|well|like|so|okay so|you know|i mean)(?=[\s,.…-]|$)[\s,.…-]*)+', re.I)
JOIN_WITHIN_S = 10.0  # more speech this soon after a reply was handed over, before it began, joins the earlier words
# LiveKit runs one turn's on_user_turn_completed at a time and makes the next wait (agent_activity.py, 1.8.8): a turn whose
# handler starts this soon after the last one ended was said while that one was still being answered.
QUEUED_S = 0.5


def queued_repeat(before: str, said: str, queued: bool) -> bool:
    """A line said again while its first saying was still being answered: the caller heard nothing yet and asked twice. On
    2026-11-27 "Sure." came twice, 3 s apart, during an 8 s turn, and both got a reply ("Opening the Maybe page", then "Yes,
    and the page is already on your screen"). Only a queued turn counts: the same word after the reply began is a new turn."""
    if not queued or not before or not said:
        return False
    a, b = before.strip().lower(), said.strip().lower()
    if REPLY.match(a) and REPLY.match(b):
        return True  # "Sure." then "Yes, sure.": one answer to one question
    return difflib.SequenceMatcher(None, a, b).ratio() >= REPEAT_LIKE

class Copilot(Agent):
    """No LLM of its own: each finished turn goes to the copilot engine in the caller's page, and its reply is spoken."""

    def __init__(self, room: rtc.Room, caller: str, stt_: LocalSTT, tts_: LocalTTS, tel: CallTelemetry, voice: Voice):
        super().__init__(instructions='The copilot engine in the page decides every reply.')
        self._room, self._caller, self._stt, self._tts, self._tel, self._voice = room, caller, stt_, tts_, tel, voice
        self.turn: dict = {}
        # The reply last handed to the voice and the words behind it: a reply that has not begun when more speech arrives is
        # dropped, and the two pieces are one question (a pause in the middle of a sentence ends a turn too early).
        self._speech = None
        self._said = ''
        self._said_at = 0.0
        self._asked = ''  # the last line sent to the page, and when its handler ended (queued_repeat)
        self._handled_at: float | None = None
        self._dropped: dict[str, Heard] = {}  # the last few dropped turns' voices, for agent.claim
        stt_.on_dropped = self.dropped

    def dropped(self, text: str, reason: str, heard: Heard) -> None:
        """A turn LocalSTT dropped: on the record, and on the page as a greyed line the caller can still have answered."""
        confidence = self._stt.last_confidence
        self._tel.ignored(text, reason, confidence, _round(heard.score), heard.seconds)
        key = uuid.uuid4().hex[:12]
        self._dropped = {**dict(list(self._dropped.items())[-9:]), key: heard}
        payload = {'id': key, 'text': text, 'reason': reason, 'confidence': confidence, 'voiceMatch': _round(heard.score)}

        async def tell():
            with contextlib.suppress(Exception):  # an older page has no such method; the turn stays dropped either way
                await self._room.local_participant.perform_rpc(destination_identity=self._caller, method='copilot.ignored',
                                                               payload=json.dumps(payload), response_timeout=5)
        asyncio.create_task(tell())

    def claim(self, key: str) -> bool:
        """The caller tapped "answer this" on a dropped line: it was their voice after all."""
        heard = self._dropped.pop(key, None)
        if heard is not None:
            self._stt.prints.claim(heard)
        return heard is not None

    async def _rpc(self, method: str, payload: dict, timeout: float = 45.0) -> dict:
        t = time.perf_counter()
        try:
            r = await self._room.local_participant.perform_rpc(
                destination_identity=self._caller, method=method, payload=json.dumps(payload), response_timeout=timeout)
        except Exception as e:
            self._tel.failure('rpc', str(e), method=method, ms=round((time.perf_counter() - t) * 1000), timeout_s=timeout)
            raise
        r = json.loads(r or '{}')
        self._tel.link(r.get('call', ''))  # the page's call id: this call's Phoenix session
        return r

    async def on_enter(self) -> None:
        # Wake the speech-to-text model while the intro plays: after a while idle, its first turn is seconds slower.
        self._warming = asyncio.create_task(self._stt.warm())
        # The page asked for the microphone before it joined, so the caller already answered that prompt.
        # The page can get the greeting before it has seen this worker join, and refuses it (56 ms, the 2026-11-08 call, which
        # then had no greeting and no call id for its first turn): one more try after a moment.
        try:
            r = await self._rpc('copilot.greet', self._tel.stack)
        except Exception:  # noqa: BLE001 - logged by _rpc
            await asyncio.sleep(1.0)
            try:
                r = await self._rpc('copilot.greet', self._tel.stack)
            except Exception:  # noqa: BLE001 - no greeting; the call still listens
                return
        if r.get('say'):
            self.session.say(spoken(r['say']), allow_interruptions=True)

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        said = FILLER.sub('', (new_message.text_content or '').strip()).strip()
        if not said:
            raise StopResponse()  # "hmm", "uh…": someone thinking, not a turn
        t = time.perf_counter()
        queued = self._handled_at is not None and t - self._handled_at < QUEUED_S
        if queued_repeat(self._asked, said, queued):
            self._tel.ignored(said, 'asked again while waiting', self._stt.last_confidence, _round(self._stt.last_heard.score), 0.0)
            self._handled_at = time.perf_counter()
            raise StopResponse()  # the reply to the first saying is already on its way
        try:
            await self._answer(said, t)
        finally:
            self._handled_at = time.perf_counter()

    async def _answer(self, said: str, t: float) -> None:
        sp = self._speech
        if sp is not None and not sp.done() and self._tts.first_ms is None and t - self._said_at < JOIN_WITHIN_S:
            sp.interrupt()  # the earlier reply never started: this is the rest of the same question
            said = f'{self._said} {said}'.strip()
        self._asked = said
        turn = uuid.uuid4().hex
        heard = {'turn': turn, 'stt_ms': self._stt.last_ms, 'confidence': self._stt.last_confidence, 'language': self._stt.last_language,
                 'voiceMatch': _round(self._stt.last_heard.score)}
        try:
            # The language goes with the words, so the reply is written in it (a pick, or what the recogniser heard).
            r = await self._rpc('copilot.turn', {'text': said, **heard, 'language': self._voice.language, 'heard': self._voice.heard})
        except Exception as e:  # noqa: BLE001 - a page that went away or timed out: say so, don't hang
            print('copilot.turn failed:', e, flush=True)
            r = {'say': "Sorry, something went wrong on my side. Could you say that again?"}
        self.turn = {**heard, 'decide_ms': round((time.perf_counter() - t) * 1000), 'heard': said, 'reply': r.get('say', ''),
                     'kind': r.get('kind', ''), 'search_ms': r.get('searchMs')}
        if r.get('say'):
            self._tts.first_ms = None
            self._speech = self.session.say(spoken(r['say']), allow_interruptions=True)
            self._said, self._said_at = said, time.perf_counter()
        else:  # nothing to say, so no first audio will close this turn's span: record it now
            self._tel.turn({**self.turn, 'total_ms': round((time.perf_counter() - t) * 1000), 'end_of_turn_ms': 0}, time.time() - (time.perf_counter() - t), time.time())
            self.turn = {}
        # The engine's reply is the whole response: no LLM runs after it.
        raise StopResponse()


def _round(v: float | None) -> float | None:
    return None if v is None else round(v, 3)


# One local caller at a time on a busy laptop: the machine's CPU load (a library load, the LiveKit VM) must not make the
# worker turn calls away, so it is always available. Modules the agent loop would otherwise import mid-call are loaded first.
# A stop (docker stop, SIGTERM) drains instead of killing: LiveKit Agents 1.8.8 marks the worker full, so new calls go to a newer
# worker, and waits for the calls it holds to end (cli/cli.py runs worker.drain() on the first TERM or INT in `start` mode). Its
# default wait is an hour; this one is shorter, and docker-compose.agent.yml's stop_grace_period must stay longer than it.
server = AgentServer(num_idle_processes=1, load_fnc=lambda: 0.0, load_threshold=1.0, preload_modules=['filelock', 'numpy'],
                     drain_timeout=int(os.environ.get('AGENT_DRAIN_S', 1200)))


def prewarm(proc: JobProcess):
    # Stricter than the lab's (0.15 s, threshold 0.5): a click, a cough or a far-off voice is not the start of a turn.
    proc.userdata['vad'] = silero.VAD.load(min_speech_duration=0.3, min_silence_duration=0.3, prefix_padding_duration=0.3, activation_threshold=0.6)
    proc.userdata['embed'] = load_embedder(VOICE_MATCH_MODEL)
    proc.userdata['hush'] = hush.load()


server.setup_fnc = prewarm


async def load_stack(http: aiohttp.ClientSession, stack: str) -> None:
    """Models are swapped, not run all at once (docs/decisions/0014): the speech server unloads the stack in use before this
    one's load, which can take a few seconds to a minute, so a call waits for it here and not in the middle of its greeting."""
    t = time.perf_counter()
    try:
        async with http.post(f'{SPEECH}/load', params={'stack': stack}, timeout=aiohttp.ClientTimeout(total=300)) as r:
            r.raise_for_status()
            swap = (await r.json()).get('swap') or {}
        print('stack', stack, 'ready in', round(time.perf_counter() - t, 1), 's', 'swap:', swap.get('unloaded') or '-', '->', swap.get('loaded') or '-', flush=True)
    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        print('stack load failed, the first request will try again:', e, flush=True)


def speech_headers(call: str) -> dict[str, str]:
    """The gateway's headers for one call (a speech server without the gateway ignores them)."""
    return {'X-Speech-Project': SPEECH_PROJECT, 'X-Speech-Call': call}


async def release_speech(http: aiohttp.ClientSession) -> None:
    """The call ended: give its place on the speech server back now rather than after the gateway's idle time."""
    with contextlib.suppress(Exception):
        async with http.post(f'{SPEECH}/release', timeout=aiohttp.ClientTimeout(total=5)):
            pass


def voice_parts(http: aiohttp.ClientSession, voice: Voice, rates: dict, prints: VoicePrint) -> tuple[LocalSTT, LocalTTS, object]:
    """The stack's listener, voice and turn detector. lfm3-audio is one model that hears and speaks (speech/server.py runs it
    on llama.cpp), so it has no turn detector of its own: the Silero VAD ends a turn after a short silence. The engine's
    turns and decision 0011's code lock stay as they are; the desk's tool calls go to the same model (api.ts)."""
    kind = voice.parts['turns']
    turns = 'vad' if kind == 'vad' else MultilingualModel() if kind == 'multilingual' else EnglishModel()
    return LocalSTT(http, voice, prints), LocalTTS(http, int(rates.get(voice.parts['speaks'], 24000)), voice), turns


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    caller = await ctx.wait_for_participant()
    http = aiohttp.ClientSession(headers=speech_headers(ctx.room.name))  # on every /health, /stt, /tts and /load of this call
    async with http.get(f'{SPEECH}/health') as r:
        health = await r.json()
    rates = health.get('rates') or {'pocket-tts': health.get('rate', 24000)}
    voice = Voice(caller.attributes.get('copilot.stack', ''), caller.attributes.get('copilot.language', ''))
    print('call', ctx.room.name, 'stack', voice.stack, 'language', voice.picked or 'heard', flush=True)
    stt_, tts_, turns = voice_parts(http, voice, rates, VoicePrint(ctx.proc.userdata.get('embed')))
    hushed = bool(ctx.proc.userdata.get('hush'))
    tel = CallTelemetry(ctx.room.name, {'stack': voice.stack, 'stt': f'{stt_.provider}:{stt_.model}', 'tts': f'{tts_.provider}:{tts_.model}',
                                        'turn_detector': 'silero-vad' if turns == 'vad' else f"livekit-{voice.parts['turns']}", 'vad': 'silero', 'language': voice.picked or 'heard',
                                        'hush': hushed, 'voice_match': os.path.basename(VOICE_MATCH_MODEL) if ctx.proc.userdata.get('embed') else 'off'})
    agent = Copilot(ctx.room, caller.identity, stt_, tts_, tel, voice)
    await load_stack(http, voice.stack)  # this stack's models in and the last stack's out, before the greeting asks the voice for audio
    session = AgentSession(
        vad=ctx.proc.userdata['vad'], stt=stt_, tts=tts_,
        turn_handling={
            'turn_detection': turns,
            # Seven tenths of a second of quiet ends a turn when the turn detector thinks the caller is done; up to 4 s when
            # the sentence sounds unfinished ("my number is 512…", or a pause to think in the middle of a question).
            'endpointing': {'min_delay': 0.7, 'max_delay': 4.0},
            # Barge-in: half a second of the caller's voice stops the copilot's (the lab's 0.15 s let room noise cut replies off:
            # 7 barge-ins in one call on 2026-11-03). The page's echo cancellation keeps the copilot's own voice out.
            'interruption': {'enabled': True, 'mode': 'vad', 'min_duration': 0.5, 'min_words': 0},
            'preemptive_generation': {'enabled': False},
        },
        user_away_timeout=None,
    )

    pending: dict = {}
    dog = StallWatchdog()
    stt_.on_request = dog.recognising

    # A turn's total: from the moment the caller stopped talking to the moment the copilot's voice started.
    @session.on('user_state_changed')
    def _user(ev):
        if ev.new_state == 'speaking':
            dog.speech_started()
            if session.agent_state == 'speaking':
                tel.barge_in()  # the caller talked over the copilot's voice
        if ev.old_state == 'speaking' and ev.new_state != 'speaking':
            dog.speech_ended()
            pending['stopped_at'] = ev.created_at

    @session.on('agent_state_changed')
    def _agent(ev):
        if ev.new_state != 'speaking' or 'stopped_at' not in pending:
            return
        since = round((ev.created_at - pending['stopped_at']) * 1000)
        if not agent.turn:
            # "Let me check the tax guides." while a search runs: the caller's first audio of this turn.
            pending.setdefault('filler_ms', since)
            return
        row = {**agent.turn, 'tts_first_ms': tts_.first_ms, 'total_ms': since, **({'filler_ms': pending['filler_ms']} if 'filler_ms' in pending else {})}
        row['end_of_turn_ms'] = since - (row.get('stt_ms') or 0) - row['decide_ms'] - (row.get('tts_first_ms') or 0)
        tel.turn(row, pending['stopped_at'], ev.created_at)
        agent.turn = {}
        pending.clear()

    # Something the copilot says outside a turn (a form that opens after a page change): the page asks the agent to say it.
    def agent_say(data: rtc.RpcInvocationData) -> str:
        text = str(json.loads(data.payload or '{}').get('text', '')).strip()
        if text:
            session.say(spoken(text), allow_interruptions=True)
        return '{}'

    # Speech-to-text and voice errors (a recoverable one is retried by LiveKit), and why the session closed.
    @session.on('error')
    def _error(ev):
        err = getattr(ev, 'error', None)
        tel.failure(type(err).__name__ if err else 'error', str(getattr(err, 'error', err)), source=type(ev.source).__name__,
                    recoverable=bool(getattr(err, 'recoverable', False)))

    closed: dict = {}

    @session.on('close')
    def _close(ev):
        closed['reason'] = str(getattr(ev.reason, 'value', ev.reason)) + (f': {ev.error}' if ev.error else '')
        print('session closed:', closed['reason'], flush=True)

    # Why a call ended (#93): a live call lost its agent about a minute in with nothing in the log to say why. These lines name who
    # left and the reason LiveKit gives, with what the session was doing.
    @ctx.room.on('participant_disconnected')
    def _left(p: rtc.RemoteParticipant):
        print('participant left:', p.identity, 'reason', getattr(p, 'disconnect_reason', None), '| user', session.user_state, '| agent', session.agent_state, flush=True)

    @ctx.room.on('disconnected')
    def _room_gone(reason):
        print('agent disconnected from the room:', reason, '| user', session.user_state, '| agent', session.agent_state, flush=True)

    # The caller spoke and no turn came of it (stall_watchdog.py): the call is not left deaf. Say so in Phoenix, drop the
    # half-made turn and the voice, and listen from the start. The call that stopped hearing its caller looked like this.
    async def watch_for_stalls():
        while True:
            await asyncio.sleep(1)
            try:
                hit = dog.check()
                if not hit:
                    continue
                kind, seen = hit
                # Speech over the copilot's own voice that never interrupted it is not a lost turn: 7 of the 10 "stalls" on the
                # 2026-11-08 call were that, and starting the turn over there could only drop what the caller said next.
                if kind == 'speech-without-turn' and str(session.agent_state) == 'speaking':
                    print('speech over the voice that did not become a turn,', round(seen, 1), 's', flush=True)
                    continue
                print('stall', kind, round(seen, 1), 's; starting the turn over', flush=True)
                tel.failure('stall', f'{kind}: {seen:.0f} s', stall=kind, seconds=round(seen, 1), user_state=str(session.user_state), agent_state=str(session.agent_state))
                agent.turn = {}
                pending.clear()
                # A detector stuck on speech also cuts the voice; a lost turn leaves a reply that is playing alone.
                for reset in ((session.interrupt, session.clear_user_turn) if kind == 'speech-without-end' else (session.clear_user_turn,)):
                    with contextlib.suppress(Exception):
                        done = reset()
                        if inspect.isawaitable(done):
                            await asyncio.wait_for(done, 5)
            except Exception as e:  # noqa: BLE001 - the watchdog must outlive whatever it finds
                print('stall watchdog:', e, flush=True)

    watcher = asyncio.create_task(watch_for_stalls())

    async def _stop_watching():
        watcher.cancel()

    ctx.add_shutdown_callback(_stop_watching)

    ctx.room.local_participant.register_rpc_method('agent.say', agent_say)

    # The caller tapped "answer this" on a line the agent dropped: their voice joins the print (the page answers the line itself).
    def agent_claim(data: rtc.RpcInvocationData) -> str:
        return json.dumps({'ok': agent.claim(str(json.loads(data.payload or '{}').get('id', '')))})

    ctx.room.local_participant.register_rpc_method('agent.claim', agent_claim)

    # The caller switched language mid-call (the page's picker, or asking to): the next turn listens and speaks in it.
    @ctx.room.on('participant_attributes_changed')
    def _attrs(changed: dict, p: rtc.Participant):
        if p.identity == caller.identity and 'copilot.language' in changed:
            voice.pick(changed['copilot.language'])
            tel.stack['language'] = voice.picked or 'heard'  # the call's record says the language it ended in
            print('language', voice.picked or 'heard', flush=True)

    # LiveKit runs shutdown callbacks at the same time (asyncio.gather), so the release and the close are one callback, in order:
    # a separate http.close closed the session under the release (TASK-DB-0154: the first call's place stayed taken).
    async def _release_and_close(_reason: str = ''):
        await release_speech(http)
        await http.close()

    ctx.add_shutdown_callback(_release_and_close)

    async def _sent(reason: str):
        print('job shutdown:', reason or '-', '| session:', closed.get('reason', 'still open'), '| user', session.user_state, '| agent', session.agent_state, flush=True)
        await tel.close(closed.get('reason') or reason or 'room closed')

    ctx.add_shutdown_callback(_sent)
    # 16 kHz in 50 ms frames: Hush's rate, five of its hops a frame, and what the recogniser and the voice match take.
    audio_in = AudioInputOptions(sample_rate=hush.RATE, frame_size_ms=50, noise_cancellation=(lambda _: hush.Hush()) if hushed else None)
    print('hush', 'on' if hushed else 'off', '| voice match', 'on' if ctx.proc.userdata.get('embed') else 'off', flush=True)
    await session.start(agent=agent, room=ctx.room, room_options=RoomOptions(audio_input=audio_in))


if __name__ == '__main__':
    cli.run_app(server)
