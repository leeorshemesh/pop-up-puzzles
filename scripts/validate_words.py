import pathlib
import re

text = pathlib.Path('js/words.js').read_text(encoding='utf-8')
answers = re.findall(r"'([a-z]{5})'", re.search(r'answers: \[(.*?)\]', text, re.S).group(1))
guesses = set(re.findall(r"'([a-z]{5})'", re.search(r'guesses: \[(.*?)\]', text, re.S).group(1)))
missing = [w for w in answers if w not in guesses]
print('answers', len(answers), 'guesses', len(guesses), 'missing', len(missing))
print('crane' in answers, 'aaron' in answers, 'apnic' in answers)
