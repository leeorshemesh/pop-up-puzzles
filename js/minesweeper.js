(function () {
    const PUZZLE_ID = 'minesweeper';
    const SIZES = {
        easy: { rows: 9, cols: 9, mines: 10 },
        medium: { rows: 16, cols: 16, mines: 40 },
        hard: { rows: 16, cols: 30, mines: 99 }
    };

    const boardEl = document.getElementById('mine-board');
    const countEl = document.getElementById('mine-count');
    const timerEl = document.getElementById('mine-timer');
    const statusEl = document.getElementById('mine-status');
    const pauseButton = document.getElementById('btn-mine-pause');
    const pauseOverlay = document.getElementById('mine-pause');

    let rows = 9;
    let cols = 9;
    let mineCount = 10;
    let mines = [];
    let counts = [];
    let revealed = [];
    let flags = [];
    let started = false;
    let lost = false;
    let won = false;
    let paused = false;
    let secondsElapsed = 0;
    let timerId = null;
    let gameMode = 'daily';
    let level = 'easy';
    let playDate = '';
    let rng = null;
    let hit = null;
    let pressTimer = null;
    let suppressClick = false;
    let flagStamp = 0;
    let hintTimer = null;
    let hintCell = null;

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function syncHintButton() {
        const button = document.getElementById('btn-hint');
        if (!document.getElementById('minesweeper-play').hidden) {
            button.disabled = won || lost || paused;
        }
    }

    function cellSizePx() {
        const frame = boardEl.closest('.mine-frame') || boardEl.parentElement;
        const available = Math.max(180, (frame ? frame.clientWidth : 460) - 4);
        const maxByWidth = Math.floor(available / cols);
        const maxByDiff = level === 'easy' ? 52 : (level === 'medium' ? 30 : 24);
        const minSize = level === 'hard' ? 18 : 22;
        return Math.max(minSize, Math.min(maxByDiff, maxByWidth));
    }

    function blank(fill) {
        return Array.from({ length: rows }, () => Array(cols).fill(fill));
    }

    function neighbors(row, col) {
        const cells = [];
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (r === row && c === col) continue;
                if (r >= 0 && c >= 0 && r < rows && c < cols) cells.push({ r, c });
            }
        }
        return cells;
    }

    function shuffle(list, random) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const swap = list[i];
            list[i] = list[j];
            list[j] = swap;
        }
        return list;
    }

    function placeMines(safeRow, safeCol, random) {
        const banned = new Set();
        for (let r = safeRow - 1; r <= safeRow + 1; r++) {
            for (let c = safeCol - 1; c <= safeCol + 1; c++) {
                if (r >= 0 && c >= 0 && r < rows && c < cols) banned.add(r * cols + c);
            }
        }
        const pool = [];
        for (let index = 0; index < rows * cols; index++) {
            if (!banned.has(index)) pool.push(index);
        }
        shuffle(pool, random);
        mines = blank(false);
        for (let i = 0; i < mineCount; i++) {
            const id = pool[i];
            mines[Math.floor(id / cols)][id % cols] = true;
        }
        counts = blank(0);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (mines[r][c]) continue;
                counts[r][c] = neighbors(r, c).filter((cell) => mines[cell.r][cell.c]).length;
            }
        }
    }

    function flagTotal() {
        let total = 0;
        flags.forEach((row) => row.forEach((flagged) => { if (flagged) total += 1; }));
        return total;
    }

    function updateHeader() {
        countEl.textContent = String(Math.max(0, mineCount - flagTotal())).padStart(3, '0');
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        const ended = won || lost;
        pauseButton.hidden = ended;
        pauseButton.setAttribute('aria-pressed', String(paused));
        pauseButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
        pauseOverlay.hidden = !paused || ended;
        boardEl.classList.toggle('paused', paused && !ended);
    }

    function stopTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function startTimer() {
        stopTimer();
        if (paused || won || lost) return;
        timerId = setInterval(() => {
            secondsElapsed += 1;
            updateHeader();
            saveDaily();
        }, 1000);
    }

    function setPaused(next) {
        if (won || lost) return;
        paused = !!next;
        if (paused) stopTimer();
        else startTimer();
        updateHeader();
        syncHintButton();
        saveDaily();
    }

    function saveDaily() {
        if (gameMode !== 'daily' || !started) return;
        window.Store.setDaily(PUZZLE_ID, playDate, level, {
            status: won ? 'completed' : (lost ? 'failed' : 'in-progress'),
            seconds: secondsElapsed,
            started: true,
            rows,
            cols,
            mines,
            revealed,
            flags,
            hit
        });
    }

    function render() {
        const size = cellSizePx();
        boardEl.style.setProperty('--mine-cell', `${size}px`);
        boardEl.style.setProperty('--mine-font', `${Math.max(0.7, size / 28)}rem`);
        boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--mine-cell))`;
        boardEl.style.gridTemplateRows = `repeat(${rows}, var(--mine-cell))`;
        boardEl.innerHTML = '';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'mine-cell';
                cell.setAttribute('role', 'gridcell');
                const open = revealed[r][c];
                const flagged = flags[r][c];
                const mined = started && mines[r] && mines[r][c];
                if (!open) {
                    cell.classList.add('covered');
                    if (flagged && lost && !mined) {
                        cell.classList.add('wrong-flag');
                        cell.textContent = '⚑';
                        cell.setAttribute('aria-label', 'Wrong flag');
                    } else if (flagged) {
                        cell.classList.add('flagged');
                        cell.textContent = '⚑';
                        cell.setAttribute('aria-label', 'Flagged');
                    } else if (lost && mined) {
                        cell.classList.add('revealed', 'mine');
                        cell.textContent = '●';
                        cell.setAttribute('aria-label', 'Mine');
                    } else {
                        cell.setAttribute('aria-label', 'Covered');
                    }
                } else if (mined) {
                    cell.classList.add('revealed', 'mine');
                    if (hit && hit.row === r && hit.col === c) cell.classList.add('hit');
                    cell.textContent = '●';
                    cell.setAttribute('aria-label', 'Mine');
                } else {
                    cell.classList.add('revealed');
                    const number = counts[r][c];
                    if (number) {
                        cell.classList.add(`n${number}`);
                        cell.textContent = String(number);
                        cell.setAttribute('aria-label', String(number));
                    } else {
                        cell.setAttribute('aria-label', 'Empty');
                    }
                }
                if (hintCell && hintCell.row === r && hintCell.col === c) {
                    cell.classList.add('hint');
                }
                bindCell(cell, r, c);
                boardEl.appendChild(cell);
            }
        }
        updateHeader();
        syncHintButton();
    }

    function giveHint() {
        if (won || lost || paused) return;
        window.App.closePopouts();
        if (!started) {
            setStatus('Open a few squares first.');
            return;
        }
        const candidates = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!mines[r][c] || flags[r][c] || revealed[r][c]) continue;
                const bordersExplored = neighbors(r, c).some((cell) => revealed[cell.r][cell.c] && !mines[cell.r][cell.c]);
                if (bordersExplored) candidates.push({ row: r, col: c });
            }
        }
        if (!candidates.length) {
            setStatus('No border mines to flag yet.');
            return;
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        flags[pick.row][pick.col] = true;
        hintCell = pick;
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => {
            hintCell = null;
            render();
        }, 2000);
        setStatus('Hint: flagged a border mine.');
        render();
        saveDaily();
    }

    function bindCell(cell, row, col) {
        cell.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            if (Date.now() - flagStamp < 400) return;
            toggleFlag(row, col);
        });
        cell.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            suppressClick = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                suppressClick = true;
                if (Date.now() - flagStamp >= 400) toggleFlag(row, col);
            }, 450);
        });
        const cancelPress = () => clearTimeout(pressTimer);
        cell.addEventListener('pointerup', cancelPress);
        cell.addEventListener('pointerleave', cancelPress);
        cell.addEventListener('pointercancel', cancelPress);
        cell.addEventListener('click', () => {
            if (suppressClick) {
                suppressClick = false;
                return;
            }
            openCell(row, col);
        });
    }

    function toggleFlag(row, col) {
        if (paused || won || lost || revealed[row][col]) return;
        flagStamp = Date.now();
        flags[row][col] = !flags[row][col];
        render();
        if (started) saveDaily();
    }

    function flood(row, col) {
        if (row < 0 || col < 0 || row >= rows || col >= cols) return;
        if (revealed[row][col] || flags[row][col] || mines[row][col]) return;
        revealed[row][col] = true;
        if (counts[row][col] === 0) neighbors(row, col).forEach((cell) => flood(cell.r, cell.c));
    }

    function remainingSafe() {
        let hidden = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!mines[r][c] && !revealed[r][c]) hidden += 1;
            }
        }
        return hidden;
    }

    function finish(didWin) {
        won = didWin;
        lost = !didWin;
        paused = false;
        stopTimer();
        if (didWin) {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (mines[r][c]) flags[r][c] = true;
                }
            }
        }
        saveDaily();
        render();
        let trophy = '';
        if (didWin) {
            window.Store.recordBest(PUZZLE_ID, level, secondsElapsed);
            if (gameMode === 'daily') {
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
        setStatus(didWin
            ? (window.Store.hideTimers() ? 'Solved.' : `Solved in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`)
            : 'Mine hit.');
        window.App.showVictory({
            title: didWin ? 'Puzzle solved' : 'Mine hit',
            seconds: secondsElapsed,
            trophy,
            again: gameMode === 'daily' ? 'Back to Minesweeper' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') window.Mines.leave();
                else window.Mines.startFree(level);
            }
        });
    }

    function explode(row, col) {
        hit = { row, col };
        flags[row][col] = false;
        revealed[row][col] = true;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (mines[r][c] && !flags[r][c]) revealed[r][c] = true;
            }
        }
        finish(false);
    }

    function openCell(row, col) {
        if (paused || won || lost) return;
        if (!started) {
            if (flags[row][col]) return;
            placeMines(row, col, rng);
            started = true;
            flood(row, col);
            render();
            startTimer();
            saveDaily();
            if (remainingSafe() === 0) finish(true);
            return;
        }
        if (flags[row][col]) return;
        if (revealed[row][col]) {
            chord(row, col);
            return;
        }
        if (mines[row][col]) {
            explode(row, col);
            return;
        }
        flood(row, col);
        render();
        saveDaily();
        if (remainingSafe() === 0) finish(true);
    }

    function chord(row, col) {
        if (!revealed[row][col] || mines[row][col] || !counts[row][col]) return;
        const around = neighbors(row, col);
        const flagged = around.filter((cell) => flags[cell.r][cell.c]).length;
        if (flagged !== counts[row][col]) return;
        const boom = around.find((cell) => !flags[cell.r][cell.c] && !revealed[cell.r][cell.c] && mines[cell.r][cell.c]);
        around.forEach((cell) => {
            if (flags[cell.r][cell.c] || revealed[cell.r][cell.c] || mines[cell.r][cell.c]) return;
            flood(cell.r, cell.c);
        });
        if (boom) {
            explode(boom.r, boom.c);
            return;
        }
        render();
        saveDaily();
        if (remainingSafe() === 0) finish(true);
    }

    function applySize(nextLevel) {
        const size = SIZES[nextLevel] || SIZES.easy;
        level = SIZES[nextLevel] ? nextLevel : 'easy';
        rows = size.rows;
        cols = size.cols;
        mineCount = size.mines;
    }

    function freshBoard() {
        mines = blank(false);
        counts = blank(0);
        revealed = blank(false);
        flags = blank(false);
        started = false;
        lost = false;
        won = false;
        hit = null;
        secondsElapsed = 0;
        paused = false;
    }

    function showBoard() {
        window.App.preparePlay(PUZZLE_ID);
        const label = window.PuzzleUtil.difficultyLabel(level);
        document.getElementById('play-title').textContent = gameMode === 'daily' ? `Daily · ${label}` : `New game · ${label}`;
        render();
        if (won || lost) {
            stopTimer();
            setStatus(won ? 'Completed.' : 'Mine hit.');
            return;
        }
        setStatus('');
        if (!paused) startTimer();
        else stopTimer();
    }

    function hashString(value) {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function mulberry32(seed) {
        let state = seed >>> 0;
        return function random() {
            state = (state + 0x6D2B79F5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function seedRng() {
        const seed = gameMode === 'daily'
            ? hashString(`${playDate}:${level}`)
            : (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0));
        rng = mulberry32(seed);
    }

    function restore(saved) {
        freshBoard();
        if (!saved || !saved.started || !Array.isArray(saved.mines) || !saved.mines.length) {
            seedRng();
            showBoard();
            return;
        }
        rows = saved.mines.length;
        cols = saved.mines[0].length;
        mines = saved.mines;
        revealed = saved.revealed;
        flags = saved.flags;
        mineCount = mines.reduce((total, line) => total + line.filter(Boolean).length, 0);
        started = true;
        secondsElapsed = saved.seconds || 0;
        won = saved.status === 'completed';
        lost = saved.status === 'failed';
        hit = saved.hit || null;
        if (hit && mines[hit.row] && mines[hit.row][hit.col]) revealed[hit.row][hit.col] = true;
        counts = blank(0);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (mines[r][c]) continue;
                counts[r][c] = neighbors(r, c).filter((cell) => mines[cell.r][cell.c]).length;
            }
        }
        paused = saved.status === 'in-progress';
        showBoard();
    }

    window.Mines = {
        bind() {
            pauseButton.addEventListener('click', () => {
                if (won || lost) return;
                setPaused(!paused);
            });
            boardEl.addEventListener('contextmenu', (event) => event.preventDefault());
            window.addEventListener('resize', () => {
                if (!document.getElementById('minesweeper-play').hidden) render();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) saveDaily();
            });
            window.addEventListener('pagehide', () => saveDaily());
        },
        startDaily(nextLevel) {
            gameMode = 'daily';
            playDate = window.PuzzleUtil.localDateKey();
            applySize(nextLevel);
            restore(window.Store.getDaily(PUZZLE_ID, playDate, level));
        },
        startFree(nextLevel) {
            gameMode = 'free';
            playDate = '';
            applySize(nextLevel);
            freshBoard();
            seedRng();
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
