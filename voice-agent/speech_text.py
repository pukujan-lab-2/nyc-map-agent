"""How a reply is said, as against how it is written. No LiveKit imports, so it has its own unit tests (tests/test_speech_text.py)."""


def spoken(text: str) -> str:
    """An email address as words: "rider at example dot com". Said as written, the sentence splitter cut it at the dot and
    a caller on 2026-11-08 heard "g gmail". The page shows the reply as written; only the voice gets this."""
    words = []
    for word in text.split(' '):
        at = word.find('@')
        if at > 0 and '.' in word[at:]:
            tail = len(word) - len(word.rstrip('.,;:!?)'))
            core, end = (word[:-tail], word[-tail:]) if tail else (word, '')
            user, domain = core.split('@', 1)
            word = f"{' dot '.join(user.split('.'))} at {' dot '.join(domain.split('.'))}{end}"
        words.append(word)
    return ' '.join(words)
