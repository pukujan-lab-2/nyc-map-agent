import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

try:
    import agent  # noqa: E402
except Exception as e:  # LiveKit is not installed here: the worker's tests run in its image
    agent = None
    MISSING = str(e)


@unittest.skipIf(agent is None, 'agent.py needs livekit')
class QueuedRepeatTest(unittest.TestCase):
    """A line said again while the first was still being answered gets one reply (the 2026-11-27 "Sure. Sure." call)."""

    def test_the_same_yes_twice_while_waiting_is_one_turn(self):
        self.assertTrue(agent.queued_repeat('Sure.', 'Sure.', True))

    def test_two_different_yes_words_while_waiting_are_one_turn(self):
        self.assertTrue(agent.queued_repeat('Sure.', 'Yes.', True))

    def test_a_question_asked_twice_while_waiting_is_one_turn(self):
        self.assertTrue(agent.queued_repeat('Show me the projects.', 'Show me your projects.', True))

    def test_the_same_word_after_the_reply_began_is_a_new_turn(self):
        self.assertFalse(agent.queued_repeat('Next.', 'Next.', False))

    def test_something_new_while_waiting_is_still_answered(self):
        self.assertFalse(agent.queued_repeat('Sure.', 'Actually, tell me about Riley instead.', True))

    def test_nothing_before_is_never_a_repeat(self):
        self.assertFalse(agent.queued_repeat('', 'Sure.', True))


if __name__ == '__main__':
    unittest.main()
