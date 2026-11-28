/**
 * The maths behind `scripts/voice-baseline.ts`: where speech ends in a clip, and how one hands-free
 * turn splits into its parts. Pure, so it is tested without a browser.
 */

/** A moment the page recorded during one turn, in `performance.now()` milliseconds. */
export interface Mark {
  name: string;
  t: number;
  text?: string;
}

/** Loudness (RMS of -1..1 samples) a 20 ms window needs to count as speech; matches the app's SPEECH_RMS. */
export const SPEECH_RMS = 0.02;

/** Seconds from the clip's start to the end of its last 20 ms window louder than `threshold`. 0 for silence. */
export function speechEndSec(samples: ArrayLike<number>, rate: number, threshold = SPEECH_RMS): number {
  const win = Math.max(1, Math.round(rate * 0.02));
  let end = 0;
  for (let at = 0; at < samples.length; at += win) {
    const stop = Math.min(samples.length, at + win);
    let sum = 0;
    for (let i = at; i < stop; i += 1) sum += samples[i] * samples[i];
    if (Math.sqrt(sum / (stop - at)) > threshold) end = stop;
  }
  return end / rate;
}

/** 16-bit mono PCM WAV bytes to floats in -1..1, with the sample rate from its header. */
export function readWav(bytes: Uint8Array): { rate: number; samples: Float32Array } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAV file");
  let at = 12;
  let rate = 0;
  while (at + 8 <= bytes.length) {
    const id = tag(at);
    const size = dv.getUint32(at + 4, true);
    if (id === "fmt ") {
      if (dv.getUint16(at + 8, true) !== 1 || dv.getUint16(at + 10, true) !== 1 || dv.getUint16(at + 22, true) !== 16) throw new Error("only 16-bit mono PCM");
      rate = dv.getUint32(at + 12, true);
    } else if (id === "data") {
      const n = Math.floor(Math.min(size, bytes.length - at - 8) / 2);
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i += 1) samples[i] = dv.getInt16(at + 8 + i * 2, true) / 32768;
      if (!rate) throw new Error("no fmt chunk before data");
      return { rate, samples };
    }
    at += 8 + size + (size % 2);
  }
  throw new Error("no data chunk");
}

/** One turn's parts, in milliseconds. A part is null when its mark never came. */
export interface TurnParts {
  /** The rider stops talking → the app decides the turn is over and stops recording. */
  recordingEnd: number | null;
  /** Recording stopped → the clip is converted and sent to /api/stt. */
  upload: number | null;
  /** /api/stt sent → its text is back (every attempt, when the first came back empty). */
  stt: number | null;
  /** Text back → the question is sent to /api/agent. */
  toAgent: number | null;
  /** /api/agent sent → its first text. */
  agentFirstToken: number | null;
  /** First text → the whole answer is in. */
  agentRest: number | null;
  /** Answer in → the answer's /api/tts first byte. */
  ttsFirstByte: number | null;
  /** First byte → first sound queued. */
  playStart: number | null;
  /** The rider stops talking → first sound of the answer. The number the plan's "keep it if" compares. */
  total: number | null;
  /** The rider stops talking → first sound of anything, the "still working" line included. */
  firstSound: number | null;
  /** How many /api/stt requests the turn made (2 when automatic language detection came back empty). */
  sttCalls: number;
  /** What speech-to-text heard (its last attempt). */
  heard: string | null;
  /** What the answer's speech was asked to say. */
  answer: string | null;
}

const first = (marks: Mark[], name: string, after = -Infinity) => marks.find((m) => m.name === name && m.t >= after);
const last = (marks: Mark[], name: string) => [...marks].reverse().find((m) => m.name === name);
const gap = (a?: Mark, b?: Mark) => (a && b ? Math.round(b.t - a.t) : null);

/**
 * Split one turn's marks. The answer's speech is the first /api/tts asked after the agent finished;
 * an earlier one is the short "still working" line the app says when an answer is slow.
 */
export function turnParts(marks: Mark[]): TurnParts {
  const said = first(marks, "speech-end");
  const recStop = first(marks, "rec-stop");
  const sttSent = first(marks, "stt-sent");
  const sttDone = last(marks, "stt-done");
  const agentSent = first(marks, "agent-sent");
  const agentText = first(marks, "agent-first-text");
  const agentDone = first(marks, "agent-done");
  const ttsSent = agentDone ? first(marks, "tts-sent", agentDone.t) : undefined;
  const ttsByte = ttsSent ? first(marks, "tts-first-byte", ttsSent.t) : undefined;
  const sound = ttsSent ? first(marks, "audio-start", ttsSent.t) : undefined;
  const anySound = said ? first(marks, "audio-start", said.t) : undefined;
  return {
    recordingEnd: gap(said, recStop),
    upload: gap(recStop, sttSent),
    stt: gap(sttSent, sttDone),
    toAgent: gap(sttDone, agentSent),
    agentFirstToken: gap(agentSent, agentText),
    agentRest: gap(agentText, agentDone),
    ttsFirstByte: gap(agentDone, ttsByte),
    playStart: gap(ttsByte, sound),
    total: gap(said, sound),
    firstSound: gap(said, anySound),
    sttCalls: marks.filter((m) => m.name === "stt-sent").length,
    heard: sttDone?.text ?? null,
    answer: ttsSent?.text ?? null,
  };
}

/** Median of the numbers present; null when there are none. */
export function median(xs: Array<number | null>): number | null {
  const v = xs.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}
