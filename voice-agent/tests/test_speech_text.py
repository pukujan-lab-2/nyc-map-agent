import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from speech_text import spoken  # noqa: E402


class SpokenTest(unittest.TestCase):
    def test_email_is_said_as_words(self):
        self.assertEqual(spoken('My email is rider@example.com.'), 'My email is rider at example dot com.')
        self.assertEqual(spoken('Write to teresa.g@mail.co.uk, then wait'), 'Write to teresa dot g at mail dot co dot uk, then wait')

    def test_other_text_is_left_alone(self):
        self.assertEqual(spoken('a @ b'), 'a @ b')
        self.assertEqual(spoken('Version 2.1 is out. See you at 5.'), 'Version 2.1 is out. See you at 5.')


if __name__ == '__main__':
    unittest.main()
