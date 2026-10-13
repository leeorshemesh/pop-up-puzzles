import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
ANSWERS_URL = 'https://raw.githubusercontent.com/3b1b/videos/master/_2022/wordle/data/possible_words.txt'
GUESSES_URL = 'https://raw.githubusercontent.com/tabatkins/wordle-list/main/words'


def load_words(url):
    text = urllib.request.urlopen(url).read().decode('utf-8')
    words = {
        line.strip().lower()
        for line in text.splitlines()
        if re.fullmatch(r'[a-z]{5}', line.strip().lower() or '')
    }
    return sorted(words)


answers = load_words(ANSWERS_URL)
guesses = sorted(set(load_words(GUESSES_URL)) | set(answers))

def js_list(words):
    return ', '.join(f"'{word}'" for word in words)

out = (
    'window.Words = {\n'
    f'    answers: [{js_list(answers)}],\n'
    f'    guesses: [{js_list(guesses)}],\n'
    '};\n'
)
(ROOT / 'js' / 'words.js').write_text(out, encoding='utf-8')
print(f'Wrote {len(answers)} answers and {len(guesses)} guesses')
