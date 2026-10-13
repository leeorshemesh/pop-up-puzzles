import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchText(res.headers.location).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        }).on('error', reject);
    });
}

function linesToWords(text) {
    return [...new Set(
        text.split(/\r?\n/)
            .map((line) => line.trim().toLowerCase())
            .filter((word) => /^[a-z]{5}$/.test(word))
    )].sort();
}

const answersUrl = 'https://raw.githubusercontent.com/3b1b/videos/master/_2022/wordle/data/possible_words.txt';
const guessesUrl = 'https://raw.githubusercontent.com/tabatkins/wordle-list/main/words';

const [answersText, guessesText] = await Promise.all([
    fetchText(answersUrl),
    fetchText(guessesUrl)
]);

const answers = linesToWords(answersText);
const guessSet = new Set(linesToWords(guessesText));
for (const word of answers) guessSet.add(word);
const guesses = [...guessSet].sort();

const out = `window.Words = {\n    answers: [${answers.map((w) => `'${w}'`).join(', ')}],\n    guesses: [${guesses.map((w) => `'${w}'`).join(', ')}],\n};\n`;
fs.writeFileSync(path.join(root, 'js', 'words.js'), out);
console.log(`Wrote ${answers.length} answers and ${guesses.length} guesses`);
