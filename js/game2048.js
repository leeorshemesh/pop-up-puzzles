(function () {
    const PUZZLE_ID = '2048';
    const SIZE = 4;
    const THRESHOLDS = [
        { tile: 512, key: 't512' },
        { tile: 1024, key: 't1024' },
        { tile: 2048, key: 't2048' },
        { tile: 4096, key: 't4096' }
    ];

    const boardEl = document.getElementById('g2048-board');
    const scoreEl = document.getElementById('g2048-score');
    const timerEl = document.getElementById('g2048-timer');
    const statusEl = document.getElementById('g2048-status');
    const pauseButton = document.getElementById('btn-g2048-pause');
    const undoButton = document.getElementById('btn-g2048-undo');
    const pauseOverlay = document.getElementById('g2048-pause');
    const stageEl = document.getElementById('g2048-stage');
    const MAX_UNDOS = 3;

    let grid = blank();
    let score = 0;
    let maxTile = 0;
    let started = false;
    let lost = false;
    let paused = false;
    let secondsElapsed = 0;
    let timerId = null;
    let gameMode = 'daily';
    let playDate = '';
    let rng = null;
    let touchStart = null;
    let sessionAwards = 0;
    let undoStack = [];
    let undosUsed = 0;
    let puzzleRevealed = false;

    function blank() {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    }

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function cloneGrid(source) {
        return source.map((row) => row.slice());
    }

    function emptyCells() {
        const cells = [];
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (!grid[r][c]) cells.push({ r, c });
            }
        }
        return cells;
    }

    function currentMax() {
        let best = 0;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] > best) best = grid[r][c];
            }
        }
        return best;
    }

    function spawnTile() {
        const cells = emptyCells();
        if (!cells.length) return false;
        const pick = cells[Math.floor(rng() * cells.length)];
        grid[pick.r][pick.c] = rng() < 0.9 ? 2 : 4;
        return true;
    }

    function gridsEqual(a, b) {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (a[r][c] !== b[r][c]) return false;
            }
        }
        return true;
    }

    function slideLine(line) {
        const tiles = line.filter((value) => value);
        const merged = [];
        let gained = 0;
        for (let i = 0; i < tiles.length; i++) {
            if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
                const value = tiles[i] * 2;
                merged.push(value);
                gained += value;
                i += 1;
            } else {
                merged.push(tiles[i]);
            }
        }
        while (merged.length < SIZE) merged.push(0);
        return { line: merged, gained };
    }

    function awardThresholds() {
        if (gameMode !== 'daily' || puzzleRevealed) return;
        THRESHOLDS.forEach((entry) => {
            if (maxTile < entry.tile) return;
            const amount = window.PuzzleUtil.trophyFor(PUZZLE_ID, entry.key);
            const awarded = window.Store.awardIfNeeded(PUZZLE_ID, playDate, entry.key, amount);
            if (awarded) {
                sessionAwards += awarded;
                window.App.refreshChrome();
            }
        });
    }

    function move(direction) {
        if (paused || lost) return false;
        const before = cloneGrid(grid);
        let gained = 0;

        if (direction === 'left' || direction === 'right') {
            for (let r = 0; r < SIZE; r++) {
                const raw = grid[r].slice();
                if (direction === 'right') raw.reverse();
                const result = slideLine(raw);
                if (direction === 'right') result.line.reverse();
                grid[r] = result.line;
                gained += result.gained;
            }
        } else {
            for (let c = 0; c < SIZE; c++) {
                const raw = [];
                for (let r = 0; r < SIZE; r++) raw.push(grid[r][c]);
                if (direction === 'down') raw.reverse();
                const result = slideLine(raw);
                if (direction === 'down') result.line.reverse();
                for (let r = 0; r < SIZE; r++) grid[r][c] = result.line[r];
                gained += result.gained;
            }
        }

        if (gridsEqual(before, grid)) return false;

        undoStack.push({
            grid: before,
            score,
            maxTile
        });
        if (undoStack.length > MAX_UNDOS) undoStack.shift();

        if (!started) {
            started = true;
            startTimer();
        }
        score += gained;
        spawnTile();
        maxTile = Math.max(maxTile, currentMax());
        awardThresholds();
        render();
        if (!(puzzleRevealed && gameMode === 'daily')) setStatus('');
        saveDaily();

        if (!canMove()) {
            finish();
            return true;
        }
        return true;
    }

    function canMove() {
        if (emptyCells().length) return true;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const value = grid[r][c];
                if (c + 1 < SIZE && grid[r][c + 1] === value) return true;
                if (r + 1 < SIZE && grid[r + 1][c] === value) return true;
            }
        }
        return false;
    }

    function syncUndoButton() {
        const left = MAX_UNDOS - undosUsed;
        undoButton.textContent = `Undo (${left})`;
        undoButton.disabled = lost || paused || !undoStack.length || undosUsed >= MAX_UNDOS;
    }

    function undoMove() {
        if (lost || paused || !undoStack.length || undosUsed >= MAX_UNDOS) return;
        const snap = undoStack.pop();
        grid = cloneGrid(snap.grid);
        score = snap.score;
        maxTile = snap.maxTile;
        undosUsed += 1;
        if (gameMode === 'daily') {
            puzzleRevealed = true;
            setStatus('Undo used — this daily will not award trophies.');
        }
        render();
        saveDaily();
    }

    function updateHeader() {
        scoreEl.textContent = String(score);
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        pauseButton.hidden = lost;
        pauseButton.setAttribute('aria-pressed', String(paused));
        pauseButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
        pauseOverlay.hidden = !paused || lost;
        boardEl.classList.toggle('paused', paused && !lost);
        syncUndoButton();
    }

    function stopTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function startTimer() {
        stopTimer();
        if (paused || lost || !started) return;
        timerId = setInterval(() => {
            secondsElapsed += 1;
            updateHeader();
            saveDaily();
        }, 1000);
    }

    function setPaused(next) {
        if (lost) return;
        paused = !!next;
        if (paused) stopTimer();
        else if (started) startTimer();
        updateHeader();
        saveDaily();
    }

    function saveDaily() {
        if (gameMode !== 'daily' || !started) return;
        window.Store.setDaily(PUZZLE_ID, playDate, 'default', {
            status: lost ? 'completed' : 'in-progress',
            seconds: secondsElapsed,
            started: true,
            grid,
            score,
            maxTile,
            revealed: puzzleRevealed && !lost,
            undosUsed
        });
    }

    function render() {
        boardEl.innerHTML = '';
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'g2048-cell';
                const value = grid[r][c];
                if (value) {
                    cell.classList.add('filled', `v${Math.min(value, 2048)}`);
                    if (value > 2048) cell.classList.add('v-super');
                    cell.textContent = String(value);
                }
                boardEl.appendChild(cell);
            }
        }
        updateHeader();
    }

    function finish() {
        lost = true;
        paused = false;
        stopTimer();
        awardThresholds();
        window.Store.recordBest(PUZZLE_ID, 'default', secondsElapsed);
        saveDaily();
        render();
        const trophy = puzzleRevealed && gameMode === 'daily'
            ? 'Undo used — this daily is not counted.'
            : (sessionAwards
                ? `+${sessionAwards} ${sessionAwards === 1 ? 'trophy' : 'trophies'}`
                : (gameMode === 'daily'
                    ? 'Trophies already claimed for reached tiles.'
                    : ''));
        setStatus('No more moves.');
        window.App.showVictory({
            title: 'Run over',
            seconds: secondsElapsed,
            trophy,
            again: gameMode === 'daily' ? 'Back to 2048' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') window.Game2048.leave();
                else window.Game2048.startFree();
            }
        });
    }

    function freshBoard() {
        grid = blank();
        score = 0;
        maxTile = 0;
        started = false;
        lost = false;
        paused = false;
        secondsElapsed = 0;
        sessionAwards = 0;
        undoStack = [];
        undosUsed = 0;
        puzzleRevealed = false;
        stopTimer();
    }

    function seedRng() {
        const seed = gameMode === 'daily'
            ? window.PuzzleUtil.hashString(`${playDate}:2048`)
            : (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0));
        rng = window.PuzzleUtil.mulberry32(seed);
    }

    function showBoard() {
        window.App.preparePlay(PUZZLE_ID);
        document.getElementById('play-title').textContent = gameMode === 'daily' ? 'Daily' : 'New game';
        render();
        if (lost) {
            stopTimer();
            setStatus('Completed.');
            return;
        }
        if (puzzleRevealed && gameMode === 'daily') {
            setStatus('Undo used — this daily will not award trophies.');
        } else {
            setStatus('');
        }
        if (!paused) {
            started = true;
            startTimer();
        } else {
            stopTimer();
        }
    }

    function restore(saved) {
        freshBoard();
        if (!saved || !saved.started || !Array.isArray(saved.grid) || !saved.grid.length) {
            seedRng();
            spawnTile();
            spawnTile();
            maxTile = currentMax();
            showBoard();
            return;
        }
        grid = saved.grid.map((row) => row.slice());
        score = saved.score || 0;
        maxTile = saved.maxTile || currentMax();
        started = true;
        secondsElapsed = saved.seconds || 0;
        lost = saved.status === 'completed' || saved.status === 'failed';
        paused = saved.status === 'in-progress';
        puzzleRevealed = !!(saved.revealed);
        undosUsed = saved.undosUsed || (saved.revealed ? MAX_UNDOS : 0);
        undoStack = [];
        rng = window.PuzzleUtil.mulberry32(
            window.PuzzleUtil.hashString(`${JSON.stringify(grid)}:${score}:${secondsElapsed}:2048`)
        );
        showBoard();
    }

    function directionFromKey(key) {
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'left';
        if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'right';
        if (key === 'ArrowUp' || key === 'w' || key === 'W') return 'up';
        if (key === 'ArrowDown' || key === 's' || key === 'S') return 'down';
        return null;
    }

    window.Game2048 = {
        bind() {
            pauseButton.addEventListener('click', () => {
                if (lost) return;
                setPaused(!paused);
            });
            undoButton.addEventListener('click', undoMove);
            stageEl.addEventListener('touchstart', (event) => {
                if (event.touches.length !== 1) return;
                const touch = event.touches[0];
                touchStart = { x: touch.clientX, y: touch.clientY };
            }, { passive: true });
            stageEl.addEventListener('touchend', (event) => {
                if (!touchStart || !event.changedTouches.length) return;
                const touch = event.changedTouches[0];
                const dx = touch.clientX - touchStart.x;
                const dy = touch.clientY - touchStart.y;
                touchStart = null;
                if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
                if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
                else move(dy > 0 ? 'down' : 'up');
            }, { passive: true });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) saveDaily();
            });
            window.addEventListener('pagehide', () => saveDaily());
        },
        startDaily() {
            gameMode = 'daily';
            playDate = window.PuzzleUtil.localDateKey();
            restore(window.Store.getDaily(PUZZLE_ID, playDate, 'default'));
        },
        startFree() {
            gameMode = 'free';
            playDate = '';
            freshBoard();
            seedRng();
            spawnTile();
            spawnTile();
            maxTile = currentMax();
            showBoard();
        },
        leave() {
            saveDaily();
            stopTimer();
            paused = false;
            window.App.showHome(PUZZLE_ID);
        },
        setPaused,
        isPaused: () => paused,
        onKeyDown(event) {
            const direction = directionFromKey(event.key);
            if (!direction) return;
            event.preventDefault();
            move(direction);
        }
    };
})();
