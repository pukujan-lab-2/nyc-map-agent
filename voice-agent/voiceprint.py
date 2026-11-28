"""Whose voice a turn is in: the caller's, or someone else's (a roommate, a TV, the copilot's own voice coming back).

The caller's voice is learnt from their first clear turn (at least ENROLL_S of speech the recogniser was sure of) and refined
with the caller's next kept turns (the first EARLY of them all join, since one 1.5 s turn is a thin print; after that only turns
that match it well). A turn of at least MIN_S whose voice scores under THRESHOLD against it is someone else's, and agent.py drops
it before the copilot sees it. Shorter turns ("yes", "no", "okay") are not judged: under a
second of speech the score is too unsteady. A line the caller taps "answer this" on (the page's copilot.ignored list) is
theirs after all, and joins the print.

The speaker model is 3D-Speaker's ERes2Net (VoxCeleb, English, Apache 2.0) on sherpa-onnx. Measured on 2026-11-03 against
14 LibriSpeech speakers (voice-agent/README.md): at 1 s of speech and a cut-off of 0.32 it kept 98% of the caller's turns and
dropped 98% of other people's; from 1.5 s, all of each. The copilot's own voice scored 0.07 to 0.25 against a caller.
On real calls (2026-11-08) the owner's own lines scored 0.20 to 0.32 against a print learnt from one turn and were dropped, so
the cut-off is now 0.18: only a clearly different voice is dropped, and the copilot's addressee check (not_for_me) and the
page's echo cancellation handle the rest.
wespeaker's CAM++ export was tried first and could not tell people apart under sherpa-onnx (same 0.65, others 0.47).

No LiveKit imports, so the logic has unit tests of its own (tests/test_voiceprint.py) with a fake embedder.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Callable

import numpy as np

RATE = 16000
MIN_S = 1.0
ENROLL_S = 1.5
ENROLL_CONFIDENCE = 0.85
THRESHOLD = float(os.environ.get('VOICE_MATCH_MIN', 0.18))
EARLY = 3  # the caller's first few kept turns all join the print, so one odd first turn does not set it
REFINE = 0.5  # after that, a turn joins the print only when it is clearly the caller
KEEP = 8  # the print is the mean of the caller's last few clear turns


def load_embedder(model: str) -> Callable[[np.ndarray], np.ndarray] | None:
    """The speaker model, or None when it is missing (VOICE_MATCH_MODEL unset or no file): every turn is then kept."""
    if not model or not os.path.exists(model):
        return None
    import sherpa_onnx
    extractor = sherpa_onnx.SpeakerEmbeddingExtractor(sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=model, num_threads=1))

    def embed(samples: np.ndarray) -> np.ndarray:
        stream = extractor.create_stream()
        stream.accept_waveform(RATE, np.ascontiguousarray(samples, dtype=np.float32))
        stream.input_finished()
        return np.asarray(extractor.compute(stream), dtype=np.float32)

    return embed


def unit(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n else v


@dataclass
class Heard:
    """One turn's voice: its embedding (None when the turn was too short to judge) and its score against the caller."""
    embedding: np.ndarray | None
    seconds: float
    score: float | None = None  # None: not judged (too short, or the caller's voice is not learnt yet)

    @property
    def other(self) -> bool:
        return self.score is not None and self.score < THRESHOLD


@dataclass
class VoicePrint:
    embed: Callable[[np.ndarray], np.ndarray] | None
    turns: list[np.ndarray] = field(default_factory=list)

    @property
    def ready(self) -> bool:
        return bool(self.turns)

    def hear(self, samples: np.ndarray) -> Heard:
        """The turn's voice and how well it matches the caller's. samples: 16 kHz mono float32. Runs the speaker model (tens of
        milliseconds on a CPU): agent.py runs it in a thread beside the speech-to-text request."""
        seconds = len(samples) / RATE
        if self.embed is None or seconds < MIN_S:
            return Heard(None, seconds)
        e = unit(self.embed(samples))
        return Heard(e, seconds, float(e @ self._print()) if self.turns else None)

    def learn(self, heard: Heard, confidence: float | None) -> None:
        """A turn that was kept: the first clear one teaches the caller's voice, the next few join it, later ones that clearly match
        refine it."""
        if heard.embedding is None:
            return
        if not self.turns:
            if heard.seconds >= ENROLL_S and (confidence is None or confidence >= ENROLL_CONFIDENCE):
                self.turns.append(heard.embedding)
        elif heard.score is not None and not heard.other and (len(self.turns) < EARLY or heard.score >= REFINE):
            self.turns = (self.turns + [heard.embedding])[-KEEP:]

    def claim(self, heard: Heard) -> None:
        """The caller says a dropped turn was theirs: their voice is wider than the print knew."""
        if heard.embedding is not None:
            self.turns = (self.turns + [heard.embedding])[-KEEP:]

    def _print(self) -> np.ndarray:
        return unit(np.mean(self.turns, axis=0))
