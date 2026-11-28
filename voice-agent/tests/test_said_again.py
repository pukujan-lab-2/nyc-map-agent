import os, sys, types, unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from voiceprint import Heard, VoicePrint  # noqa: E402

try:
    import agent  # noqa: E402
except Exception as e:  # LiveKit is not installed here: the worker's tests run in its image
    agent = None
    MISSING = str(e)


@unittest.skipIf(agent is None, 'agent.py needs livekit')
class SaidAgainTest(unittest.TestCase):
    """A line dropped as another voice and said again soon after is the caller asking twice (2026-11-08 call)."""

    def stt(self):
        s = agent.LocalSTT.__new__(agent.LocalSTT)
        s.prints = VoicePrint(None)
        s.last_confidence = 0.9
        s._last_drop = None
        return s

    def other(self):
        return Heard(np.array([0.0, 1.0], dtype=np.float32), 1.5, 0.2 - 0.1)

    def test_asking_twice_is_kept_and_teaches_the_voice(self):
        s = self.stt()
        self.assertEqual(s._dropped('Tell the joke.', self.other()), 'another voice')
        self.assertEqual(s._dropped('Tell a joke.', self.other()), '')
        self.assertEqual(len(s.prints.turns), 2)

    def test_a_different_line_is_still_dropped(self):
        s = self.stt()
        self.assertEqual(s._dropped('Tell the joke.', self.other()), 'another voice')
        self.assertEqual(s._dropped('Show me something cool.', self.other()), 'another voice')

    def test_a_short_unsure_line_in_the_callers_voice_is_kept(self):
        s = self.stt()
        s.last_confidence = 0.56
        self.assertEqual(s._dropped('They are showing.', Heard(None, 1.4, 0.47)), '')
        self.assertEqual(s._dropped('They are showing.', Heard(None, 1.4, 0.25)), 'unsure and short')

    def test_a_repeat_long_after_is_judged_on_its_own(self):
        s = self.stt()
        s._dropped('Tell the joke.', self.other())
        words, _, heard = s._last_drop
        s._last_drop = (words, agent.time.monotonic() - agent.REPEAT_S - 1, heard)
        self.assertEqual(s._dropped('Tell a joke.', self.other()), 'another voice')


if __name__ == '__main__':
    unittest.main()
