(function () {
    const PUZZLE_ID = 'memory';
    const LAYOUTS = {
        easy: { rows: 3, cols: 4, pairs: 6 },
        medium: { rows: 4, cols: 4, pairs: 8 },
        hard: { rows: 4, cols: 5, pairs: 10 }
    };
    const ICONS = ['★', '●', '▲', '■', '◆', '♥', '☀', '☁', '♫', '❄', '✿', '⚡'];

    const boardEl = document.getElementById('memory-board');
    const statusEl = document.getElementById('memory-status');
    const scoreEl = document.getElementById('memory-score');
    const timerEl = document.getElementById('memory-timer');
    const pauseButton = document.getElementById('btn-memory-pause');
    const pauseOverlay = document.getElementById('memory-pause');

    let level = 'easy';
    let rows = 3;
    let cols = 4;
    let cards = [];
    let flipped = [];
    let matched = [];
    let lock = false;
    let gameMode = 'daily';
    let playDate = '';
    let secondsElapsed = 0;
    let timerId = null;
    let started = false;
    let won = false;
    let paused = false;
    let rng = null;
    let flips = 0;
    let puzzleRevealed = false;

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function syncHintButton() {
        const button = document.getElementById('btn-hint');
        if (!document.getElementById('memory-play').hidden) {
            button.disabled = won || paused || lock;
        }
    }

    function shuffle(list) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const swap = list[i];
            list[i] = list[j];
            list[j] = swap;
        }
        return list;
    }

    function deal() {
        const layout = LAYOUTS[level];
        rows = layout.rows;
        cols = layout.cols;
        const picks = ICONS.slice(0, layout.pairs);
        const deck = [];
        picks.forEach((icon, pair) => {
            deck.push({ id: pair * 2, pair, icon });
            deck.push({ id: pair * 2 + 1, pair, icon });
        });
        cards = shuffle(deck);
        flipped = [];
        matched = [];
        lock = false;
        flips = 0;
    }

    function stopTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function startTimer() {
        stopTimer();
        if (paused || won || !started) return;
        timerId = setInterval(() => {
            secondsElapsed += 1;
            updateHeader();
            saveDaily();
        }, 1000);
    }

    function setPaused(next) {
        if (won) return;
        paused = !!next;
        if (paused) stopTimer();
        else if (started) startTimer();
        updateHeader();
        saveDaily();
    }

    function updateHeader() {
        scoreEl.textContent = String(flips);
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        pauseButton.hidden = won;
        pauseButton.setAttribute('aria-pressed', String(paused));
        pauseButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
        pauseOverlay.hidden = !paused || won;
        boardEl.classList.toggle('paused', paused && !won);
        syncHintButton();
    }

    function saveDaily() {
        if (gameMode !== 'daily' || !started) return;
        window.Store.setDaily(PUZZLE_ID, playDate, level, {
            status: won ? 'completed' : 'in-progress',
            seconds: secondsElapsed,
            started: true,
            level,
            cards,
            matched: matched.slice(),
            flipped: flipped.slice(),
            flips,
            revealed: puzzleRevealed && !won
        });
    }

    function render() {
        boardEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
        boardEl.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
        boardEl.innerHTML = '';
        cards.forEach((card, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            const isUp = matched.includes(index) || flipped.includes(index);
            button.className = 'memory-card'
                + (isUp ? ' up' : ' down')
                + (matched.includes(index) ? ' matched' : '');
            button.textContent = isUp ? card.icon : '';
            button.disabled = won || matched.includes(index);
            button.addEventListener('click', () => flip(index));
            boardEl.appendChild(button);
        });
        updateHeader();
    }

    function finish() {
        won = true;
        paused = false;
        stopTimer();
        saveDaily();
        render();
        const scoring = window.PuzzleUtil.scoringFor(PUZZLE_ID);
        let bestScore = window.Store.getScoreBests(PUZZLE_ID)[level];
        let trophy = '';
        if (gameMode === 'daily') {
            if (puzzleRevealed) {
                trophy = 'Hint used — this daily is not counted.';
            } else {
                window.Store.recordBest(PUZZLE_ID, level, secondsElapsed);
                window.Store.recordScoreBest(PUZZLE_ID, level, flips, scoring.better);
                bestScore = window.Store.getScoreBests(PUZZLE_ID)[level];
                const award = window.Store.awardIfNeeded(
                    PUZZLE_ID,
                    playDate,
                    level,
                    window.PuzzleUtil.trophyFor(PUZZLE_ID, level)
                );
                trophy = award
                    ? `+${award} ${award === 1 ? 'trophy' : 'trophies'}`
                    : 'Trophies already claimed for this daily.';
            }
        } else if (!puzzleRevealed) {
            window.Store.recordBest(PUZZLE_ID, level, secondsElapsed);
            window.Store.recordScoreBest(PUZZLE_ID, level, flips, scoring.better);
            bestScore = window.Store.getScoreBests(PUZZLE_ID)[level];
        }
        setStatus(window.Store.hideTimers()
            ? `All matched · ${flips} flips.`
            : `Matched in ${window.PuzzleUtil.formatTime(secondsElapsed)} · ${flips} flips.`);
        window.App.showVictory({
            title: 'Puzzle solved',
            seconds: secondsElapsed,
            score: flips,
            bestScore,
            scoring,
            trophy,
            again: gameMode === 'daily' ? 'Back to Memory' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') window.Memory.leave();
                else window.Memory.startFree(level);
            }
        });
    }

    function flip(index) {
        if (paused || won || lock || matched.includes(index) || flipped.includes(index)) return;
        if (!started) {
            started = true;
            startTimer();
        }
        flipped.push(index);
        flips += 1;
        render();
        if (flipped.length < 2) {
            saveDaily();
            return;
        }
        const [a, b] = flipped;
        if (cards[a].pair === cards[b].pair) {
            matched.push(a, b);
            flipped = [];
            setStatus('');
            saveDaily();
            render();
            if (matched.length === cards.length) finish();
            return;
        }
        lock = true;
        setStatus('');
        saveDaily();
        setTimeout(() => {
            flipped = [];
            lock = false;
            render();
            saveDaily();
        }, 650);
    }

    function giveHint() {
        if (paused || won || lock) return;
        window.App.closePopouts();
        const unmatched = cards
            .map((card, index) => ({ card, index }))
            .filter((entry) => !matched.includes(entry.index));
        if (unmatched.length < 2) {
            setStatus('No pairs left to hint.');
            return;
        }
        const first = unmatched[0];
        const partner = unmatched.find(
            (entry) => entry.index !== first.index && entry.card.pair === first.card.pair
        );
        if (!partner) {
            setStatus('No pairs left to hint.');
            return;
        }
        if (!started) {
            started = true;
            startTimer();
        }
        puzzleRevealed = true;
        matched.push(first.index, partner.index);
        flipped = [];
        lock = false;
        render();
        setStatus(gameMode === 'daily'
            ? 'Hint used — this daily will not award trophies.'
            : 'Hint: pair revealed.');
        saveDaily();
        if (matched.length === cards.length) finish();
    }

    function applyLevel(nextLevel) {
        level = LAYOUTS[nextLevel] ? nextLevel : 'easy';
    }

    function seedRng() {
        const seed = gameMode === 'daily'
            ? window.PuzzleUtil.hashString(`${playDate}:${level}:memory`)
            : (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0));
        rng = window.PuzzleUtil.mulberry32(seed);
    }

    function freshBoard() {
        seedRng();
        deal();
        started = false;
        won = false;
        paused = false;
        lock = false;
        puzzleRevealed = false;
        secondsElapsed = 0;
        stopTimer();
    }

    function showBoard() {
        window.App.preparePlay(PUZZLE_ID);
        const label = window.PuzzleUtil.difficultyLabel(level);
        document.getElementById('play-title').textContent = gameMode === 'daily'
            ? `Daily · ${label}`
            : `New game · ${label}`;
        lock = false;
        render();
        if (won) {
            stopTimer();
            setStatus('Completed.');
            return;
        }
        setStatus(puzzleRevealed && gameMode === 'daily'
            ? 'Hint used — this daily will not award trophies.'
            : '');
        if (!paused) {
            started = true;
            startTimer();
        } else {
            stopTimer();
        }
    }

    function restore(saved) {
        if (!saved || !saved.started || !Array.isArray(saved.cards)) {
            freshBoard();
            showBoard();
            return;
        }
        applyLevel(saved.level || level);
        cards = saved.cards;
        matched = Array.isArray(saved.matched) ? saved.matched.slice() : [];
        flipped = [];
        lock = false;
        flips = saved.flips || 0;
        puzzleRevealed = !!(saved.revealed);
        rows = LAYOUTS[level].rows;
        cols = LAYOUTS[level].cols;
        started = true;
        secondsElapsed = saved.seconds || 0;
        won = saved.status === 'completed';
        paused = saved.status === 'in-progress';
        showBoard();
    }

    window.Memory = {
        bind() {
            pauseButton.addEventListener('click', () => {
                if (won) return;
                setPaused(!paused);
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) saveDaily();
            });
            window.addEventListener('pagehide', () => saveDaily());
        },
        startDaily(nextLevel) {
            gameMode = 'daily';
            playDate = window.PuzzleUtil.localDateKey();
            applyLevel(nextLevel);
            restore(window.Store.getDaily(PUZZLE_ID, playDate, level));
        },
        startFree(nextLevel) {
            gameMode = 'free';
            playDate = '';
            applyLevel(nextLevel);
            freshBoard();
            showBoard();
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
        onKeyDown() {}
    };
})();
