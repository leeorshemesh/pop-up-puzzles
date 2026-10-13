(function () {
    const PUZZLE_ID = 'wordle';
    const ROWS = 6;
    const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const RANK = { absent: 1, present: 2, exact: 3 };

    const grid = document.getElementById('wordle-grid');
    const keyboard = document.getElementById('wordle-keyboard');
    const statusEl = document.getElementById('wordle-status');
    const timerEl = document.getElementById('wordle-timer');

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
    let entrySlots = ['', '', '', '', ''];
    let lockedClues = [null, null, null, null, null];
    let hintedPresents = new Set();
    let puzzleRevealed = false;
    let hintFlash = null;
    let hintTimer = null;
    let gameMode = 'daily';
    let playDate = '';
    let secondsElapsed = 0;
    let timerId = null;
    let locked = false;
    let finished = false;
    let paused = false;

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function syncHintButton() {
        const button = document.getElementById('btn-hint');
        if (!document.getElementById('wordle-play').hidden) {
            button.disabled = finished || locked;
        }
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

    function knownExactPositions() {
        const known = lockedClues.slice();
        guesses.forEach((guess) => {
            scoreGuess(guess).forEach((mark, index) => {
                if (mark === 'exact') known[index] = answer[index];
            });
        });
        return known;
    }

    function applyLockedToEntry() {
        for (let i = 0; i < 5; i++) {
            if (lockedClues[i]) entrySlots[i] = lockedClues[i];
        }
    }

    function currentEntry() {
        return entrySlots.join('');
    }

    function keyStates() {
        const states = {};
        guesses.forEach((guess) => {
            scoreGuess(guess).forEach((mark, index) => {
                const letter = guess[index];
                if (!states[letter] || RANK[mark] > RANK[states[letter]]) states[letter] = mark;
            });
        });
        lockedClues.forEach((letter) => {
            if (letter) states[letter] = 'exact';
        });
        hintedPresents.forEach((letter) => {
            if (!states[letter] || RANK.present > RANK[states[letter]]) states[letter] = 'present';
        });
        return states;
    }

    function render() {
        const states = keyStates();
        grid.innerHTML = '';
        for (let row = 0; row < ROWS; row++) {
            const line = document.createElement('div');
            line.className = 'wordle-row';
            const isCurrent = row === guesses.length && !finished;
            const isFuture = row > guesses.length;
            const letters = row < guesses.length
                ? guesses[row]
                : (isCurrent ? currentEntry() : lockedClues.map((letter) => letter || '').join(''));
            const marks = row < guesses.length ? scoreGuess(guesses[row]) : null;
            for (let col = 0; col < 5; col++) {
                const tile = document.createElement('span');
                tile.className = 'wordle-tile';
                const lockedLetter = lockedClues[col];
                if (marks) {
                    tile.classList.add(marks[col]);
                    tile.textContent = (letters[col] || '').toUpperCase();
                } else if ((isCurrent || isFuture) && lockedLetter) {
                    tile.classList.add('exact', 'hint-clue');
                    tile.textContent = lockedLetter.toUpperCase();
                    if (hintFlash && hintFlash.type === 'exact' && hintFlash.index === col) {
                        tile.classList.add('hint');
                    }
                } else if (isCurrent) {
                    tile.textContent = (entrySlots[col] || '').toUpperCase();
                    if (entrySlots[col]) tile.classList.add('filled');
                }
                line.appendChild(tile);
            }
            grid.appendChild(line);
        }
        keyboard.querySelectorAll('[data-key]').forEach((button) => {
            const letter = button.dataset.key;
            button.classList.remove('exact', 'present', 'absent', 'hint');
            if (states[letter]) button.classList.add(states[letter]);
            if (hintFlash && hintFlash.type === 'present' && hintFlash.letter === letter) {
                button.classList.add('hint');
            }
        });
        syncHintButton();
    }

    function shake() {
        const row = grid.children[guesses.length];
        if (!row) return;
        row.classList.remove('shake');
        void row.offsetWidth;
        row.classList.add('shake');
    }

    function updateTimerDisplay() {
        if (!timerEl) return;
        timerEl.textContent = window.PuzzleUtil.formatTime(secondsElapsed);
    }

    function stopTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function startTimer() {
        stopTimer();
        if (finished || locked || paused) return;
        timerId = setInterval(() => {
            secondsElapsed += 1;
            updateTimerDisplay();
            saveDaily();
        }, 1000);
    }

    function setPaused(next) {
        if (finished || locked) return;
        paused = !!next;
        if (paused) stopTimer();
        else startTimer();
    }

    function saveDaily() {
        if (gameMode !== 'daily') return;
        if (!guesses.length && !finished && !puzzleRevealed) return;
        window.Store.setDaily(PUZZLE_ID, playDate, 'default', {
            status: finished ? (guesses.at(-1) === answer ? 'completed' : 'failed') : 'in-progress',
            seconds: secondsElapsed,
            guesses: guesses.slice(),
            answer,
            revealed: puzzleRevealed && !finished,
            lockedClues: lockedClues.slice(),
            hintedPresents: [...hintedPresents]
        });
    }

    function endGame(won) {
        finished = true;
        locked = true;
        stopTimer();
        saveDaily();
        if (won && !puzzleRevealed) {
            window.Store.recordBest(PUZZLE_ID, 'default', secondsElapsed);
        }
        const trophyText = won && gameMode === 'daily'
            ? (puzzleRevealed
                ? 'Hint used — this daily is not counted.'
                : (() => {
                    const award = window.Store.awardIfNeeded(
                        PUZZLE_ID,
                        playDate,
                        'default',
                        window.PuzzleUtil.trophyFor(PUZZLE_ID, 'default')
                    );
                    return award
                        ? `+${award} ${award === 1 ? 'trophy' : 'trophies'}`
                        : 'Trophies already claimed for this daily.';
                })())
            : (won ? '' : `The word was ${answer.toUpperCase()}`);
        setStatus(won
            ? (window.Store.hideTimers() ? 'Solved.' : `Solved in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`)
            : `The word was ${answer.toUpperCase()}.`);
        syncHintButton();
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
        if (locked || paused) return;
        applyLockedToEntry();
        const entry = currentEntry();
        if (entry.length < 5 || entrySlots.some((slot) => !slot)) {
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
        entrySlots = ['', '', '', '', ''];
        applyLockedToEntry();
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
        if (locked || paused) return;
        const index = entrySlots.findIndex((slot, col) => !slot && !lockedClues[col]);
        if (index < 0) return;
        entrySlots[index] = letter;
        setStatus('');
        render();
    }

    function backspace() {
        if (locked || paused) return;
        for (let i = 4; i >= 0; i--) {
            if (entrySlots[i] && !lockedClues[i]) {
                entrySlots[i] = '';
                render();
                return;
            }
        }
    }

    function flashHint(next) {
        hintFlash = next;
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => {
            hintFlash = null;
            render();
        }, 2000);
        render();
    }

    function giveHint() {
        if (finished || locked || paused) return;
        window.App.closePopouts();
        puzzleRevealed = true;

        const known = knownExactPositions();
        const presentLetters = new Set();
        guesses.forEach((guess) => {
            scoreGuess(guess).forEach((mark, index) => {
                if (mark === 'present') presentLetters.add(guess[index]);
            });
        });

        for (const letter of presentLetters) {
            for (let i = 0; i < 5; i++) {
                if (answer[i] === letter && !known[i]) {
                    lockedClues[i] = letter;
                    applyLockedToEntry();
                    setStatus(`Hint: ${letter.toUpperCase()} belongs in spot ${i + 1}.`);
                    flashHint({ type: 'exact', index: i });
                    saveDaily();
                    return;
                }
            }
        }

        const states = keyStates();
        for (let i = 0; i < 5; i++) {
            const letter = answer[i];
            if (known[i]) continue;
            if (states[letter] === 'exact') continue;
            if (hintedPresents.has(letter) || states[letter] === 'present') continue;
            hintedPresents.add(letter);
            setStatus(`Hint: ${letter.toUpperCase()} is in the word.`);
            flashHint({ type: 'present', letter });
            saveDaily();
            return;
        }

        for (let i = 0; i < 5; i++) {
            if (!known[i]) {
                lockedClues[i] = answer[i];
                applyLockedToEntry();
                setStatus(`Hint: ${answer[i].toUpperCase()} belongs in spot ${i + 1}.`);
                flashHint({ type: 'exact', index: i });
                saveDaily();
                return;
            }
        }

        setStatus('No more letter hints available.');
        saveDaily();
        syncHintButton();
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
        lockedClues = saved && Array.isArray(saved.lockedClues)
            ? saved.lockedClues.map((letter, index) => (letter === answer[index] ? letter : null))
            : [null, null, null, null, null];
        hintedPresents = new Set(
            saved && Array.isArray(saved.hintedPresents)
                ? saved.hintedPresents.filter((letter) => answer.includes(letter))
                : []
        );
        puzzleRevealed = !!(saved && saved.revealed);
        entrySlots = ['', '', '', '', ''];
        applyLockedToEntry();
        secondsElapsed = saved ? saved.seconds || 0 : 0;
        finished = !!(saved && (saved.status === 'completed' || saved.status === 'failed'));
        locked = finished;
        paused = false;
        hintFlash = null;
        clearTimeout(hintTimer);
        window.App.preparePlay(PUZZLE_ID);
        document.getElementById('play-title').textContent = gameMode === 'daily' ? 'Daily' : 'New game';
        updateTimerDisplay();
        render();
        if (finished) {
            stopTimer();
            setStatus(saved.status === 'completed'
                ? 'Completed.'
                : `The word was ${answer.toUpperCase()}.`);
            return;
        }
        setStatus(puzzleRevealed ? 'Hint used — this daily will not award trophies.' : '');
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
        giveHint,
        setPaused,
        isPaused: () => paused,
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
