(function () {
    const PUZZLE_ID = 'lightsout';
    const BOARD = { easy: 5, medium: 6, hard: 7 };
    const SCRAMBLES = { easy: 8, medium: 14, hard: 22 };

    const boardEl = document.getElementById('lights-board');
    const statusEl = document.getElementById('lights-status');
    const countEl = document.getElementById('lights-count');
    const timerEl = document.getElementById('lights-timer');
    const pauseButton = document.getElementById('btn-lights-pause');
    const pauseOverlay = document.getElementById('lights-pause');

    let size = 5;
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
    let hintTimer = null;
    let hintCell = null;
    let puzzleRevealed = false;

    function blank() {
        return Array.from({ length: size }, () => Array(size).fill(false));
    }

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function syncHintButton() {
        const button = document.getElementById('btn-hint');
        if (!document.getElementById('lightsout-play').hidden) {
            button.disabled = won || paused;
        }
    }

    function litCount(source = grid) {
        let total = 0;
        source.forEach((row) => row.forEach((on) => { if (on) total += 1; }));
        return total;
    }

    function toggleOn(gridCopy, row, col) {
        if (row < 0 || col < 0 || row >= size || col >= size) return;
        gridCopy[row][col] = !gridCopy[row][col];
    }

    function pressOn(gridCopy, row, col) {
        toggleOn(gridCopy, row, col);
        toggleOn(gridCopy, row - 1, col);
        toggleOn(gridCopy, row + 1, col);
        toggleOn(gridCopy, row, col - 1);
        toggleOn(gridCopy, row, col + 1);
    }

    function toggle(row, col) {
        pressOn(grid, row, col);
    }

    function press(row, col) {
        toggle(row, col);
    }

    function scramble(count) {
        grid = blank();
        for (let i = 0; i < count; i++) {
            press(
                Math.floor(rng() * size),
                Math.floor(rng() * size)
            );
        }
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

    function setPaused(next) {
        if (won) return;
        paused = !!next;
        if (paused) stopTimer();
        else if (started) startTimer();
        updateHeader();
        saveDaily();
    }

    function updateHeader() {
        countEl.textContent = `${litCount()} lit`;
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
            grid: grid.map((row) => row.map((on) => (on ? 1 : 0))),
            revealed: puzzleRevealed && !won
        });
    }

    function cloneGrid(source) {
        return source.map((row) => row.slice());
    }

    function isAllOff(source) {
        return litCount(source) === 0;
    }

    /** Chase-lights solver: returns presses that clear the board, or null. */
    function findSolution(source) {
        const limit = 1 << size;
        for (let mask = 0; mask < limit; mask++) {
            const trial = cloneGrid(source);
            const presses = [];
            for (let c = 0; c < size; c++) {
                if (mask & (1 << c)) {
                    pressOn(trial, 0, c);
                    presses.push({ row: 0, col: c });
                }
            }
            for (let r = 0; r < size - 1; r++) {
                for (let c = 0; c < size; c++) {
                    if (trial[r][c]) {
                        pressOn(trial, r + 1, c);
                        presses.push({ row: r + 1, col: c });
                    }
                }
            }
            if (isAllOff(trial)) return presses;
        }
        return null;
    }

    function pickHintCell() {
        const solution = findSolution(grid);
        if (solution && solution.length) {
            let best = solution[0];
            let bestCount = Infinity;
            solution.forEach((cell) => {
                const trial = cloneGrid(grid);
                pressOn(trial, cell.row, cell.col);
                const count = litCount(trial);
                if (count < bestCount) {
                    bestCount = count;
                    best = cell;
                }
            });
            return best;
        }
        let fallback = null;
        let bestCount = Infinity;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const trial = cloneGrid(grid);
                pressOn(trial, r, c);
                const count = litCount(trial);
                if (count < bestCount) {
                    bestCount = count;
                    fallback = { row: r, col: c };
                }
            }
        }
        return fallback;
    }

    function render() {
        boardEl.style.setProperty('--lights-size', String(size));
        boardEl.innerHTML = '';
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'lights-cell' + (grid[r][c] ? ' on' : '');
                if (hintCell && hintCell.row === r && hintCell.col === c) {
                    cell.classList.add('hint');
                }
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
        if (!puzzleRevealed) {
            window.Store.recordBest(PUZZLE_ID, level, secondsElapsed);
        }
        if (gameMode === 'daily') {
            if (puzzleRevealed) {
                trophy = 'Hint used — this daily is not counted.';
            } else {
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
        setStatus('');
        if (litCount() === 0) finish();
    }

    function applyLevel(nextLevel) {
        level = BOARD[nextLevel] ? nextLevel : 'easy';
        size = BOARD[level];
    }

    function seedRng() {
        const seed = gameMode === 'daily'
            ? window.PuzzleUtil.hashString(`${playDate}:${level}:lightsout`)
            : (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0));
        rng = window.PuzzleUtil.mulberry32(seed);
    }

    function giveHint() {
        if (paused || won) return;
        window.App.closePopouts();
        const best = pickHintCell();
        if (!best) {
            setStatus('No helpful move found.');
            return;
        }
        if (!started) {
            started = true;
            startTimer();
        }
        puzzleRevealed = true;
        hintCell = best;
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => {
            hintCell = null;
            render();
        }, 2000);
        press(best.row, best.col);
        setStatus(gameMode === 'daily'
            ? 'Hint used — this daily will not award trophies.'
            : 'Hint applied.');
        render();
        saveDaily();
        if (litCount() === 0) finish();
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

    function freshBoard() {
        seedRng();
        grid = blank();
        scramble(SCRAMBLES[level]);
        started = false;
        won = false;
        paused = false;
        puzzleRevealed = false;
        secondsElapsed = 0;
        stopTimer();
    }

    function restore(saved) {
        applyLevel(level);
        if (!saved || !saved.started || !Array.isArray(saved.grid)) {
            freshBoard();
            showBoard();
            return;
        }
        const savedSize = saved.grid.length;
        if (savedSize === BOARD[level]) {
            grid = saved.grid.map((row) => row.map((value) => !!value));
        } else {
            freshBoard();
            showBoard();
            return;
        }
        started = true;
        secondsElapsed = saved.seconds || 0;
        won = saved.status === 'completed';
        paused = saved.status === 'in-progress';
        puzzleRevealed = !!(saved.revealed);
        showBoard();
    }

    window.LightsOut = {
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
