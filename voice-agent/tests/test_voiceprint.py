import os, sys, unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from voiceprint import RATE, THRESHOLD, VoicePrint  # noqa: E402

# A fake speaker model: the "audio" carries its speaker in its first sample, and each speaker has a fixed direction.
DIRECTIONS = {1: np.array([1.0, 0.0, 0.0]), 2: np.array([0.0, 1.0, 0.0]), 3: np.array([0.8, 0.6, 0.0])}


def embed(samples):
    return DIRECTIONS[int(samples[0])]


def turn(speaker, seconds):
    a = np.zeros(int(RATE * seconds), dtype=np.float32)
    a[0] = speaker
    return a


class VoicePrintTest(unittest.TestCase):
    def setUp(self):
        self.vp = VoicePrint(embed)

    def test_everything_is_kept_until_the_callers_voice_is_learnt(self):
        heard = self.vp.hear(turn(2, 2.0))
        self.assertIsNone(heard.score)
        self.assertFalse(heard.other)

    def test_the_first_clear_turn_teaches_the_voice_and_another_voice_is_dropped(self):
        self.vp.learn(self.vp.hear(turn(1, 2.0)), 0.95)
        self.assertTrue(self.vp.ready)
        self.assertFalse(self.vp.hear(turn(1, 1.2)).other)
        self.assertTrue(self.vp.hear(turn(2, 1.2)).other)

    def test_a_short_turn_is_never_judged(self):
        self.vp.learn(self.vp.hear(turn(1, 2.0)), 0.95)
        heard = self.vp.hear(turn(2, 0.6))
        self.assertIsNone(heard.embedding)
        self.assertFalse(heard.other)

    def test_an_unsure_or_short_first_turn_does_not_teach_the_voice(self):
        self.vp.learn(self.vp.hear(turn(1, 2.0)), 0.6)
        self.vp.learn(self.vp.hear(turn(1, 1.2)), 0.99)
        self.assertFalse(self.vp.ready)

    def test_another_voice_never_joins_the_print(self):
        self.vp.learn(self.vp.hear(turn(1, 2.0)), 0.95)
        self.vp.learn(self.vp.hear(turn(2, 2.0)), 0.95)  # kept by some other rule, but not the caller's voice
        self.assertEqual(len(self.vp.turns), 1)
        self.vp.learn(self.vp.hear(turn(3, 2.0)), 0.95)  # close to the caller's (0.8)
        self.assertEqual(len(self.vp.turns), 2)

    def test_the_first_few_kept_turns_join_even_at_a_middling_match(self):
        # One 1.5 s turn is a thin print: on 2026-11-08 the owner's own lines scored 0.20 to 0.32 against it.
        vp = VoicePrint(lambda s: {1: np.array([1.0, 0.0]), 4: np.array([0.4, 0.92])}[int(s[0])])
        vp.learn(vp.hear(turn(1, 2.0)), 0.95)
        middling = vp.hear(turn(4, 2.0))
        self.assertFalse(middling.other)
        self.assertLess(middling.score, 0.5)
        vp.learn(middling, 0.95)
        self.assertEqual(len(vp.turns), 2)

    def test_the_cut_off_drops_only_a_clearly_different_voice(self):
        self.assertLessEqual(THRESHOLD, 0.2)

    def test_a_claimed_turn_widens_the_print(self):
        self.vp.learn(self.vp.hear(turn(1, 2.0)), 0.95)
        dropped = self.vp.hear(turn(2, 2.0))
        self.assertTrue(dropped.other)
        self.vp.claim(dropped)
        self.assertGreaterEqual(self.vp.hear(turn(2, 2.0)).score, THRESHOLD)

    def test_without_a_speaker_model_every_turn_is_kept(self):
        vp = VoicePrint(None)
        heard = vp.hear(turn(2, 3.0))
        vp.learn(heard, 0.99)
        self.assertFalse(heard.other)
        self.assertFalse(vp.ready)


if __name__ == '__main__':
    unittest.main()
