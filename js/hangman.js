(function () {
    const PUZZLE_ID = 'hangman';
    const MAX_MISSES = 7;
    const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

    const statusEl = document.getElementById('hang-status');
    const figureEl = document.getElementById('hang-figure');
    const wordEl = document.getElementById('hang-word');
    const missesEl = document.getElementById('hang-misses');
    const scoreEl = document.getElementById('hang-score');
    const timerEl = document.getElementById('hang-timer');
    const keyboard = document.getElementById('hang-keyboard');
    const pauseButton = document.getElementById('btn-hang-pause');
    const pauseOverlay = document.getElementById('hang-pause');
    const stageEl = document.getElementById('hang-stage');

    const phrases = window.Phrases;

    let answer = '';
    let guessed = [];
    let gameMode = 'daily';
    let playDate = '';
    let secondsElapsed = 0;
    let timerId = null;
    let finished = false;
    let won = false;
    let paused = false;
    let started = false;

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function lettersInAnswer() {
        return new Set([...answer].filter((ch) => /[a-z]/.test(ch)));
    }

    function misses() {
        const needed = lettersInAnswer();
        return guessed.filter((letter) => !needed.has(letter)).length;
    }

    function wrongGuessesLeft() {
        return Math.max(0, MAX_MISSES - misses());
    }

    function syncHintButton() {
        const button = document.getElementById('btn-hint');
        if (!document.getElementById('hangman-play').hidden) {
            button.disabled = finished || paused;
        }
    }

    function renderWord() {
        wordEl.innerHTML = '';
        const showAnswer = finished && !won;
        const words = answer.split(' ');
        words.forEach((word) => {
            const group = document.createElement('span');
            group.className = 'hang-word-group';
            [...word].forEach((ch) => {
                const slot = document.createElement('span');
                slot.className = 'hang-letter';
                const known = showAnswer || guessed.includes(ch);
                slot.textContent = known ? ch.toUpperCase() : '_';
                if (known) slot.classList.add('revealed');
                group.appendChild(slot);
            });
            wordEl.appendChild(group);
        });
    }

    function isWon() {
        const needed = lettersInAnswer();
        for (const letter of needed) {
            if (!guessed.includes(letter)) return false;
        }
        return needed.size > 0;
    }

    function stopTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function startTimer() {
        stopTimer();
        if (finished || paused || !started) return;
        timerId = setInterval(() => {
            secondsElapsed += 1;
            updateHeader();
            saveDaily();
        }, 1000);
    }

    function setPaused(next) {
        if (finished) return;
        paused = !!next;
        if (paused) stopTimer();
        else if (started) startTimer();
        updateHeader();
        saveDaily();
    }

    function updateHeader() {
        const left = wrongGuessesLeft();
        if (missesEl) missesEl.textContent = `${left} wrong ${left === 1 ? 'guess' : 'guesses'} left`;
        if (scoreEl) scoreEl.textContent = String(left);
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        pauseButton.hidden = finished;
        pauseButton.setAttribute('aria-pressed', String(paused));
        pauseButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
        pauseOverlay.hidden = !paused || finished;
        stageEl.classList.toggle('paused', paused && !finished);
        figureEl.dataset.stage = String(Math.min(misses(), MAX_MISSES));
        syncHintButton();
    }

    function saveDaily() {
        if (gameMode !== 'daily' || !started) return;
        window.Store.setDaily(PUZZLE_ID, playDate, 'default', {
            status: finished ? (won ? 'completed' : 'failed') : 'in-progress',
            seconds: secondsElapsed,
            started: true,
            answer,
            guessed: guessed.slice()
        });
    }

    function render() {
        renderWord();
        keyboard.querySelectorAll('[data-key]').forEach((button) => {
            const letter = button.dataset.key;
            button.classList.remove('exact', 'absent', 'used');
            button.disabled = false;
            if (!guessed.includes(letter)) return;
            button.disabled = true;
            button.classList.add('used');
            button.classList.add(lettersInAnswer().has(letter) ? 'exact' : 'absent');
        });
        updateHeader();
    }

    function endGame(didWin) {
        finished = true;
        won = didWin;
        paused = false;
        stopTimer();
        saveDaily();
        render();
        const scoring = window.PuzzleUtil.scoringFor(PUZZLE_ID);
        const lives = wrongGuessesLeft();
        let bestScore = window.Store.getScoreBests(PUZZLE_ID).default;
        let trophy = '';
        if (didWin) {
            window.Store.recordBest(PUZZLE_ID, 'default', secondsElapsed);
            window.Store.recordScoreBest(PUZZLE_ID, 'default', lives, scoring.better);
            bestScore = window.Store.getScoreBests(PUZZLE_ID).default;
            if (gameMode === 'daily') {
                const award = window.Store.awardIfNeeded(
                    PUZZLE_ID,
                    playDate,
                    'default',
                    window.PuzzleUtil.trophyFor(PUZZLE_ID, 'default')
                );
                trophy = award
                    ? `+${award} ${award === 1 ? 'trophy' : 'trophies'}`
                    : 'Trophies already claimed for this daily.';
            }
        } else if (!didWin) {
            trophy = `The phrase was “${answer}”.`;
        }
        setStatus(didWin
            ? (window.Store.hideTimers() ? 'Solved.' : `Solved in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`)
            : `The phrase was “${answer}”.`);
        window.App.showVictory({
            title: didWin ? 'Puzzle solved' : 'Out of guesses',
            seconds: secondsElapsed,
            score: lives,
            bestScore,
            scoring,
            trophy,
            again: gameMode === 'daily' ? 'Back to Hangman' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') window.Hangman.leave();
                else window.Hangman.startFree();
            }
        });
    }

    function guessLetter(letter) {
        if (finished || paused || guessed.includes(letter)) return;
        if (!started) {
            started = true;
            startTimer();
        }
        guessed.push(letter);
        setStatus('');
        render();
        saveDaily();
        if (isWon()) {
            endGame(true);
            return;
        }
        if (misses() >= MAX_MISSES) endGame(false);
    }

    function giveHint() {
        if (finished || paused) return;
        window.App.closePopouts();
        const needed = lettersInAnswer();
        const remaining = [...needed].filter((letter) => !guessed.includes(letter));
        if (!remaining.length) {
            setStatus('No letters left to hint.');
            return;
        }
        const counts = {};
        for (const ch of answer) {
            if (/[a-z]/.test(ch)) counts[ch] = (counts[ch] || 0) + 1;
        }
        remaining.sort((a, b) => (counts[a] - counts[b]) || a.localeCompare(b));
        const letter = remaining[0];
        if (!started) {
            started = true;
            startTimer();
        }
        guessed.push(letter);
        setStatus(`Hint: ${letter.toUpperCase()} revealed.`);
        render();
        saveDaily();
        if (isWon()) endGame(true);
    }

    function buildKeyboard() {
        keyboard.innerHTML = '';
        KEY_ROWS.forEach((row) => {
            const line = document.createElement('div');
            line.className = 'wordle-keys hang-keys';
            [...row].forEach((letter) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'wordle-key';
                button.dataset.key = letter.toLowerCase();
                button.textContent = letter;
                button.addEventListener('click', () => guessLetter(letter.toLowerCase()));
                line.appendChild(button);
            });
            keyboard.appendChild(line);
        });
    }

    function begin(nextAnswer, saved) {
        answer = nextAnswer.toLowerCase();
        guessed = saved && Array.isArray(saved.guessed) ? saved.guessed.filter((l) => /^[a-z]$/.test(l)) : [];
        secondsElapsed = saved ? saved.seconds || 0 : 0;
        finished = !!(saved && (saved.status === 'completed' || saved.status === 'failed'));
        won = !!(saved && saved.status === 'completed');
        paused = !!(saved && saved.status === 'in-progress' && saved.started);
        started = !!(saved && saved.started) || guessed.length > 0;
        window.App.preparePlay(PUZZLE_ID);
        document.getElementById('play-title').textContent = gameMode === 'daily' ? 'Daily' : 'New game';
        render();
        if (finished) {
            stopTimer();
            setStatus(won ? 'Completed.' : `The phrase was “${answer}”.`);
            return;
        }
        setStatus('');
        if (!paused) {
            started = true;
            startTimer();
        } else {
            stopTimer();
        }
    }

    function dailyPhrase(date) {
        return phrases[window.PuzzleUtil.hashString(`${date}:hangman`) % phrases.length];
    }

    function pickFree() {
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    window.Hangman = {
        bind() {
            buildKeyboard();
            pauseButton.addEventListener('click', () => {
                if (finished) return;
                setPaused(!paused);
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) saveDaily();
            });
            window.addEventListener('pagehide', () => saveDaily());
        },
        startDaily() {
            gameMode = 'daily';
            playDate = window.PuzzleUtil.localDateKey();
            const saved = window.Store.getDaily(PUZZLE_ID, playDate, 'default');
            const phrase = saved && saved.answer && phrases.includes(saved.answer)
                ? saved.answer
                : dailyPhrase(playDate);
            begin(phrase, saved);
        },
        startFree() {
            gameMode = 'free';
            playDate = '';
            begin(pickFree(), null);
        },
        leave() {
            saveDaily();
            stopTimer();
            paused = false;
            window.App.showHome(PUZZLE_ID);
        },
        giveHint,
        setPaused,
        isPaused: () => paused,
        onKeyDown(event) {
            const tag = event.target && event.target.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
            if (/^[a-zA-Z]$/.test(event.key)) {
                event.preventDefault();
                guessLetter(event.key.toLowerCase());
            }
        }
    };
})();
