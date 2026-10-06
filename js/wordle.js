(function () {
    const PUZZLE_ID = 'wordle';
    const ROWS = 6;
    const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const RANK = { absent: 1, present: 2, exact: 3 };

    const grid = document.getElementById('wordle-grid');
    const keyboard = document.getElementById('wordle-keyboard');
    const statusEl = document.getElementById('wordle-status');

    const answers = window.Words.answers;
    const wordSet = new Set(window.Words.guesses);

    function hashString(value) {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    let answer = '';
    let guesses = [];
    let entry = '';
    let gameMode = 'daily';
    let playDate = '';
    let secondsElapsed = 0;
    let timerId = null;
    let locked = false;
    let finished = false;

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function scoreGuess(guess) {
        const result = Array(5).fill('absent');
        const counts = {};
        for (const letter of answer) counts[letter] = (counts[letter] || 0) + 1;
        for (let i = 0; i < 5; i++) {
            if (guess[i] === answer[i]) {
                result[i] = 'exact';
                counts[guess[i]] -= 1;
            }
        }
        for (let i = 0; i < 5; i++) {
            if (result[i] === 'exact') continue;
            if (counts[guess[i]] > 0) {
                result[i] = 'present';
                counts[guess[i]] -= 1;
            }
        }
        return result;
    }

    function keyStates() {
        const states = {};
        guesses.forEach((guess) => {
            scoreGuess(guess).forEach((mark, index) => {
                const letter = guess[index];
                if (!states[letter] || RANK[mark] > RANK[states[letter]]) states[letter] = mark;
            });
        });
        return states;
    }

    function render() {
        const states = keyStates();
        grid.innerHTML = '';
        for (let row = 0; row < ROWS; row++) {
            const line = document.createElement('div');
            line.className = 'wordle-row';
            const letters = row < guesses.length ? guesses[row] : (row === guesses.length ? entry : '');
            const marks = row < guesses.length ? scoreGuess(guesses[row]) : null;
            for (let col = 0; col < 5; col++) {
                const tile = document.createElement('span');
                tile.className = 'wordle-tile';
                if (marks) tile.classList.add(marks[col]);
                tile.textContent = (letters[col] || '').toUpperCase();
                line.appendChild(tile);
            }
            grid.appendChild(line);
        }
        keyboard.querySelectorAll('[data-key]').forEach((button) => {
            const letter = button.dataset.key;
            button.classList.remove('exact', 'present', 'absent');
            if (states[letter]) button.classList.add(states[letter]);
        });
    }

    function shake() {
        const row = grid.children[guesses.length];
        if (!row) return;
        row.classList.remove('shake');
        void row.offsetWidth;
        row.classList.add('shake');
    }

    function stopTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function startTimer() {
        stopTimer();
        if (finished || locked) return;
        timerId = setInterval(() => {
            secondsElapsed += 1;
            saveDaily();
        }, 1000);
    }

    function saveDaily() {
        if (gameMode !== 'daily') return;
        if (!guesses.length && !finished) return;
        window.Store.setDaily(PUZZLE_ID, playDate, 'default', {
            status: finished ? (guesses.at(-1) === answer ? 'completed' : 'failed') : 'in-progress',
            seconds: secondsElapsed,
            guesses: guesses.slice(),
            answer
        });
    }

    function endGame(won) {
        finished = true;
        locked = true;
        stopTimer();
        saveDaily();
        const trophyText = won && gameMode === 'daily'
            ? (() => {
                const award = window.Store.awardIfNeeded(
                    PUZZLE_ID,
                    playDate,
                    'default',
                    window.PuzzleUtil.trophyFor(PUZZLE_ID, 'default')
                );
                window.Store.recordBest(PUZZLE_ID, 'default', secondsElapsed);
                return award
                    ? `+${award} ${award === 1 ? 'trophy' : 'trophies'}`
                    : 'Trophies already claimed for this daily.';
            })()
            : (won ? '' : `The word was ${answer.toUpperCase()}`);
        setStatus(won
            ? (window.Store.hideTimers() ? 'Solved.' : `Solved in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`)
            : `The word was ${answer.toUpperCase()}.`);
        window.App.showVictory({
            title: won ? 'Puzzle solved' : 'Out of guesses',
            seconds: secondsElapsed,
            trophy: trophyText,
            again: gameMode === 'daily' ? 'Back to Wordle' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') window.Wordle.leave();
                else window.Wordle.startFree();
            }
        });
    }

    function submit() {
        if (locked) return;
        if (entry.length < 5) {
            setStatus('Not enough letters.');
            shake();
            return;
        }
        if (!wordSet.has(entry)) {
            setStatus('Not in word list.');
            shake();
            return;
        }
        guesses.push(entry);
        entry = '';
        render();
        if (guesses.at(-1) === answer) {
            endGame(true);
            return;
        }
        if (guesses.length >= ROWS) {
            endGame(false);
            return;
        }
        setStatus('');
        saveDaily();
    }

    function typeLetter(letter) {
        if (locked || entry.length >= 5) return;
        entry += letter;
        setStatus('');
        render();
    }

    function backspace() {
        if (locked || !entry) return;
        entry = entry.slice(0, -1);
        render();
    }

    function buildKeyboard() {
        keyboard.innerHTML = '';
        KEY_ROWS.forEach((row, index) => {
            const line = document.createElement('div');
            line.className = 'wordle-keys';
            if (index === 2) {
                const enter = document.createElement('button');
                enter.type = 'button';
                enter.className = 'wordle-key wide';
                enter.textContent = 'Enter';
                enter.addEventListener('click', submit);
                line.appendChild(enter);
            }
            [...row].forEach((letter) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'wordle-key';
                button.dataset.key = letter.toLowerCase();
                button.textContent = letter;
                button.addEventListener('click', () => typeLetter(letter.toLowerCase()));
                line.appendChild(button);
            });
            if (index === 2) {
                const back = document.createElement('button');
                back.type = 'button';
                back.className = 'wordle-key wide';
                back.textContent = 'Back';
                back.addEventListener('click', backspace);
                line.appendChild(back);
            }
            keyboard.appendChild(line);
        });
    }

    function begin(nextAnswer, saved) {
        answer = nextAnswer;
        guesses = saved && Array.isArray(saved.guesses) ? saved.guesses.filter((guess) => wordSet.has(guess)).slice(0, ROWS) : [];
        entry = '';
        secondsElapsed = saved ? saved.seconds || 0 : 0;
        finished = !!(saved && (saved.status === 'completed' || saved.status === 'failed'));
        locked = finished;
        window.App.preparePlay(PUZZLE_ID);
        document.getElementById('play-title').textContent = gameMode === 'daily' ? 'Daily' : 'New game';
        render();
        if (finished) {
            stopTimer();
            setStatus(saved.status === 'completed'
                ? 'Completed.'
                : `The word was ${answer.toUpperCase()}.`);
            return;
        }
        setStatus('');
        startTimer();
        saveDaily();
    }

    function pickFree() {
        return answers[Math.floor(Math.random() * answers.length)];
    }

    function dailyWord(date) {
        return answers[hashString(date) % answers.length];
    }

    window.Wordle = {
        bind() {
            buildKeyboard();
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && gameMode === 'daily') saveDaily();
            });
            window.addEventListener('pagehide', () => saveDaily());
        },
        startDaily() {
            gameMode = 'daily';
            playDate = window.PuzzleUtil.localDateKey();
            const saved = window.Store.getDaily(PUZZLE_ID, playDate, 'default');
            const word = saved && saved.answer && wordSet.has(saved.answer) ? saved.answer : dailyWord(playDate);
            begin(word, saved);
        },
        startFree() {
            gameMode = 'free';
            playDate = '';
            begin(pickFree(), null);
        },
        leave() {
            saveDaily();
            stopTimer();
            window.App.showHome(PUZZLE_ID);
        },
        onKeyDown(event) {
            const tag = event.target && event.target.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
            } else if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault();
                backspace();
            } else if (/^[a-zA-Z]$/.test(event.key)) {
                event.preventDefault();
                typeLetter(event.key.toLowerCase());
            }
        }
    };
})();
