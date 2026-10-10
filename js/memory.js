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

    function setStatus(text) {
        statusEl.textContent = text;
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

    function updateHeader() {
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        pauseButton.hidden = won;
        pauseButton.setAttribute('aria-pressed', String(paused));
        pauseButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
        pauseOverlay.hidden = !paused || won;
        boardEl.classList.toggle('paused', paused && !won);
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
            flipped: flipped.slice()
        });
    }

    function render() {
        boardEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
        boardEl.innerHTML = '';
        cards.forEach((card, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            const isUp = matched.includes(index) || flipped.includes(index);
            button.className = 'memory-card' + (isUp ? ' up' : '') + (matched.includes(index) ? ' matched' : '');
            button.textContent = isUp ? card.icon : '';
            button.disabled = paused || won || matched.includes(index) || lock;
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
        let trophy = '';
        if (gameMode === 'daily') {
            const award = window.Store.awardIfNeeded(
                PUZZLE_ID,
                playDate,
                level,
                window.PuzzleUtil.trophyFor(PUZZLE_ID, level)
            );
            window.Store.recordBest(PUZZLE_ID, level, secondsElapsed);
            trophy = award
                ? `+${award} ${award === 1 ? 'trophy' : 'trophies'}`
                : 'Trophies already claimed for this daily.';
        }
        setStatus(window.Store.hideTimers()
            ? 'All matched.'
            : `Matched in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`);
        window.App.showVictory({
            title: 'Puzzle solved',
            seconds: secondsElapsed,
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
        render();
        if (flipped.length < 2) {
            saveDaily();
            return;
        }
        const [a, b] = flipped;
        if (cards[a].pair === cards[b].pair) {
            matched.push(a, b);
            flipped = [];
            setStatus(`${matched.length / 2} pairs.`);
            saveDaily();
            render();
            if (matched.length === cards.length) finish();
            return;
        }
        lock = true;
        setStatus('No match.');
        saveDaily();
        setTimeout(() => {
            flipped = [];
            lock = false;
            setStatus('');
            render();
            saveDaily();
        }, 650);
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
        secondsElapsed = 0;
        stopTimer();
    }

    function showBoard() {
        window.App.preparePlay(PUZZLE_ID);
        const label = window.PuzzleUtil.difficultyLabel(level);
        document.getElementById('play-title').textContent = gameMode === 'daily'
            ? `Daily · ${label}`
            : `New game · ${label}`;
        render();
        if (won) {
            stopTimer();
            setStatus('Completed.');
            return;
        }
        setStatus('Find matching pairs.');
        if (started && !paused) startTimer();
        else stopTimer();
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
                paused = !paused;
                if (paused) stopTimer();
                else if (started) startTimer();
                updateHeader();
                saveDaily();
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
        onKeyDown() {}
    };
})();
