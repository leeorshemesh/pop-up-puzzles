(function () {
    const PUZZLE_ID = 'lightsout';
    const SIZE = 5;
    const SCRAMBLES = { easy: 8, medium: 12, hard: 16 };

    const boardEl = document.getElementById('lights-board');
    const statusEl = document.getElementById('lights-status');
    const countEl = document.getElementById('lights-count');
    const timerEl = document.getElementById('lights-timer');
    const pauseButton = document.getElementById('btn-lights-pause');
    const pauseOverlay = document.getElementById('lights-pause');

    let grid = blank();
    let level = 'easy';
    let gameMode = 'daily';
    let playDate = '';
    let secondsElapsed = 0;
    let timerId = null;
    let started = false;
    let won = false;
    let paused = false;
    let rng = null;

    function blank() {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    }

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function litCount() {
        let total = 0;
        grid.forEach((row) => row.forEach((on) => { if (on) total += 1; }));
        return total;
    }

    function toggle(row, col) {
        if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) return;
        grid[row][col] = !grid[row][col];
    }

    function press(row, col) {
        toggle(row, col);
        toggle(row - 1, col);
        toggle(row + 1, col);
        toggle(row, col - 1);
        toggle(row, col + 1);
    }

    function scramble(count) {
        grid = blank();
        const presses = [];
        for (let i = 0; i < count; i++) {
            presses.push({
                r: Math.floor(rng() * SIZE),
                c: Math.floor(rng() * SIZE)
            });
        }
        presses.forEach((cell) => press(cell.r, cell.c));
        if (litCount() === 0) press(0, 0);
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
        countEl.textContent = String(litCount()).padStart(2, '0');
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
            grid: grid.map((row) => row.map((on) => (on ? 1 : 0)))
        });
    }

    function render() {
        boardEl.innerHTML = '';
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'lights-cell' + (grid[r][c] ? ' on' : '');
                cell.setAttribute('aria-label', grid[r][c] ? 'On' : 'Off');
                cell.addEventListener('click', () => clickCell(r, c));
                boardEl.appendChild(cell);
            }
        }
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
            ? 'All lights out.'
            : `Cleared in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`);
        window.App.showVictory({
            title: 'Puzzle solved',
            seconds: secondsElapsed,
            trophy,
            again: gameMode === 'daily' ? 'Back to Lights Out' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') window.LightsOut.leave();
                else window.LightsOut.startFree(level);
            }
        });
    }

    function clickCell(row, col) {
        if (paused || won) return;
        if (!started) {
            started = true;
            startTimer();
        }
        press(row, col);
        render();
        saveDaily();
        setStatus(`${litCount()} lit.`);
        if (litCount() === 0) finish();
    }

    function applyLevel(nextLevel) {
        level = SCRAMBLES[nextLevel] ? nextLevel : 'easy';
    }

    function seedRng() {
        const seed = gameMode === 'daily'
            ? window.PuzzleUtil.hashString(`${playDate}:${level}:lightsout`)
            : (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0));
        rng = window.PuzzleUtil.mulberry32(seed);
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
        setStatus(`${litCount()} lit.`);
        if (started && !paused) startTimer();
        else stopTimer();
    }

    function freshBoard() {
        seedRng();
        scramble(SCRAMBLES[level]);
        started = false;
        won = false;
        paused = false;
        secondsElapsed = 0;
        stopTimer();
    }

    function restore(saved) {
        if (!saved || !saved.started || !Array.isArray(saved.grid)) {
            freshBoard();
            showBoard();
            return;
        }
        grid = saved.grid.map((row) => row.map((value) => !!value));
        started = true;
        secondsElapsed = saved.seconds || 0;
        won = saved.status === 'completed';
        paused = saved.status === 'in-progress';
        showBoard();
    }

    window.LightsOut = {
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
