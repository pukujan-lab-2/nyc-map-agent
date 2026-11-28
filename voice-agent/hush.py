"""Hush (Weya AI, Apache 2.0): takes background voices and noise out of the caller's audio before the voice detector, the
recogniser and the voice match hear it. The browser's own noise suppression already runs; it only knows steady noise, and
another person talking passes it untouched. Hush is DeepFilterNet3 trained to treat a second voice as noise too.

The library (libweya_nc, Rust) is built from Hush's source in the Dockerfile (pulp-vision/Hush, native/weya_nc_build), and the
model is the 8 MB ONNX bundle from huggingface.co/weya-ai/hush. Off when HUSH_LIB or HUSH_MODEL is missing (a plain
`python agent.py dev` on a Mac): the audio then passes through as it came.

It runs at 16 kHz in 10 ms hops (160 samples), causal, under a millisecond per hop on a CPU; agent.py asks LiveKit for the
caller's audio at 16 kHz in 50 ms frames, so each frame is five hops and nothing is held back.
"""
from __future__ import annotations

import ctypes, os

import numpy as np
from livekit import rtc

RATE = 16000
LIB = os.environ.get('HUSH_LIB', '')
MODEL = os.environ.get('HUSH_MODEL', '')
# How far Hush may turn a sound down, in dB; 100 is no limit. A limit keeps a little of the room in, which some recognisers prefer.
ATTEN_DB = float(os.environ.get('HUSH_ATTEN_DB', 100))

_lib = None
_model = None


def load() -> bool:
    """Load the library and the model once per process (the model is shared by every call's session)."""
    global _lib, _model
    if _model is not None:
        return True
    if os.environ.get('HUSH', 'on') == 'off' or not (LIB and MODEL and os.path.exists(LIB) and os.path.exists(MODEL)):
        return False
    lib = ctypes.CDLL(LIB)
    f32 = ctypes.POINTER(ctypes.c_float)
    lib.weya_nc_model_load_from_path.argtypes, lib.weya_nc_model_load_from_path.restype = [ctypes.c_char_p], ctypes.c_void_p
    lib.weya_nc_session_create.argtypes, lib.weya_nc_session_create.restype = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_float], ctypes.c_void_p
    lib.weya_nc_session_free.argtypes, lib.weya_nc_session_free.restype = [ctypes.c_void_p], None
    lib.weya_nc_get_frame_length.argtypes, lib.weya_nc_get_frame_length.restype = [ctypes.c_void_p], ctypes.c_size_t
    lib.weya_nc_process_frame.argtypes, lib.weya_nc_process_frame.restype = [ctypes.c_void_p, f32, f32], ctypes.c_float
    model = lib.weya_nc_model_load_from_path(MODEL.encode())
    if not model:
        print('hush: the model did not load:', MODEL, flush=True)
        return False
    _lib, _model = lib, model
    return True


class Hush(rtc.FrameProcessor[rtc.AudioFrame]):
    """One call's filter: its own streaming state, on the shared model."""

    def __init__(self):
        self._session = _lib.weya_nc_session_create(_model, RATE, ctypes.c_float(ATTEN_DB))
        self._hop = int(_lib.weya_nc_get_frame_length(self._session))
        self._in = np.zeros(self._hop, dtype=np.float32)
        self._out = np.zeros(self._hop, dtype=np.float32)
        self._pending = np.zeros(0, dtype=np.float32)  # input short of a whole hop, kept for the next frame
        self._ready = np.zeros(0, dtype=np.float32)  # cleaned audio not yet handed back
        self._enabled = True
        self._warned = False

    @property
    def enabled(self) -> bool:
        return self._enabled

    @enabled.setter
    def enabled(self, value: bool) -> None:
        self._enabled = value

    def _process(self, frame: rtc.AudioFrame) -> rtc.AudioFrame:
        if frame.sample_rate != RATE or frame.num_channels != 1 or not self._session:
            if not self._warned:
                print('hush: passing through audio at', frame.sample_rate, 'Hz,', frame.num_channels, 'channels', flush=True)
                self._warned = True
            return frame
        pcm = np.frombuffer(frame.data, dtype=np.int16).astype(np.float32) / 32768
        audio = np.concatenate([self._pending, pcm])
        whole = len(audio) // self._hop * self._hop
        cleaned = np.empty(whole, dtype=np.float32)
        in_ptr = self._in.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        out_ptr = self._out.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        for i in range(0, whole, self._hop):
            self._in[:] = audio[i:i + self._hop]
            _lib.weya_nc_process_frame(self._session, in_ptr, out_ptr)
            cleaned[i:i + self._hop] = self._out
        self._pending = audio[whole:]
        ready = np.concatenate([self._ready, cleaned])
        n = len(pcm)
        if len(ready) < n:  # only while the first hop fills: pad the start with silence
            ready = np.concatenate([np.zeros(n - len(ready), dtype=np.float32), ready])
        out, self._ready = ready[:n], ready[n:]
        data = (np.clip(out, -1, 1) * 32767).astype(np.int16)
        return rtc.AudioFrame(data.tobytes(), RATE, 1, n)

    def _close(self) -> None:
        if self._session:
            _lib.weya_nc_session_free(self._session)
            self._session = None
