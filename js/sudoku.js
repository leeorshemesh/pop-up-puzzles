window.Sudoku = (function () {
    const REMOVALS = { easy: 35, medium: 45, hard: 55 };
    const PUZZLE_ID = 'sudoku';

    const playTitle = document.getElementById('play-title');
    const timerDisplay = document.getElementById('timer-display');
    const statusMessage = document.getElementById('status-message');
    const pauseButton = document.getElementById('btn-pause');
    const pauseOverlay = document.getElementById('pause-overlay');
    const notesButton = document.getElementById('btn-notes');
    const boardEl = document.getElementById('sudoku-board');
    const victoryModal = document.getElementById('victory-modal');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');

    let solution = null;
    let givens = null;
    let boardState = null;
    let cellNotes = null;
    let selected = null;
    let notesMode = false;
    let secondsElapsed = 0;
    let isPaused = false;
    let timerInterval = null;
    let gameMode = null;
    let difficulty = null;
    let puzzleRevealed = false;
    let gameCompleted = false;
    let puzzleReady = false;
    let hintTimer = null;
    let confirmResolver = null;
    let generationToken = 0;
    let lastAward = 0;
    let revealing = false;
    let revealTimer = null;
    let revealToken = 0;

    function emptyBoard() {
        return Array.from({ length: 9 }, () => Array(9).fill(0));
    }

    function cloneBoard(board) {
        return board.map((row) => row.slice());
    }

    function emptyNotes() {
        return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
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
        return function rng() {
            state = (state + 0x6D2B79F5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function shuffle(array, rng) {
        const random = rng || Math.random;
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function isValid(board, row, col, num) {
        for (let i = 0; i < 9; i++) {
            if (board[row][i] === num || board[i][col] === num) return false;
            const boxRow = 3 * Math.floor(row / 3) + Math.floor(i / 3);
            const boxCol = 3 * Math.floor(col / 3) + (i % 3);
            if (board[boxRow][boxCol] === num) return false;
        }
        return true;
    }

    function solveRandomized(board, rng) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] !== 0) continue;
                const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
                for (const num of numbers) {
                    if (!isValid(board, row, col, num)) continue;
                    board[row][col] = num;
                    if (solveRandomized(board, rng)) return true;
                    board[row][col] = 0;
                }
                return false;
            }
        }
        return true;
    }

    function countSolutions(board, limit) {
        let count = 0;
        function search() {
            if (count >= limit) return;
            let bestRow = -1;
            let bestCol = -1;
            let bestNums = null;
            for (let row = 0; row < 9 && !(bestNums && bestNums.length === 1); row++) {
                for (let col = 0; col < 9; col++) {
                    if (board[row][col] !== 0) continue;
                    const nums = [];
                    for (let num = 1; num <= 9; num++) {
                        if (isValid(board, row, col, num)) nums.push(num);
                    }
                    if (nums.length === 0) return;
                    if (!bestNums || nums.length < bestNums.length) {
                        bestNums = nums;
                        bestRow = row;
                        bestCol = col;
                        if (nums.length === 1) break;
                    }
                }
            }
            if (!bestNums) {
                count += 1;
                return;
            }
            for (const num of bestNums) {
                board[bestRow][bestCol] = num;
                search();
                board[bestRow][bestCol] = 0;
                if (count >= limit) return;
            }
        }
        search();
        return count;
    }

    function generateComplete(rng) {
        const board = emptyBoard();
        for (let box = 0; box < 9; box += 3) {
            const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
            let index = 0;
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    board[box + row][box + col] = nums[index++];
                }
            }
        }
        return solveRandomized(board, rng) ? board : null;
    }

    function generatePuzzle(level, rng) {
        const target = REMOVALS[level] || REMOVALS.medium;
        const solved = generateComplete(rng);
        if (!solved) return null;
        const puzzle = cloneBoard(solved);
        const cells = shuffle(Array.from({ length: 81 }, (_, index) => [Math.floor(index / 9), index % 9]), rng);
        let removed = 0;
        for (const [row, col] of cells) {
            if (removed >= target) break;
            const backup = puzzle[row][col];
            puzzle[row][col] = 0;
            if (countSolutions(puzzle, 2) === 1) removed += 1;
            else puzzle[row][col] = backup;
        }
        return { puzzle, solution: solved };
    }

    function inputLocked() {
        return gameCompleted || puzzleRevealed || revealing;
    }

    function isBoard(board) {
        return Array.isArray(board)
            && board.length === 9
            && board.every((row) => Array.isArray(row) && row.length === 9
                && row.every((value) => value >= 0 && value <= 9));
    }

    function setStatus(text) {
        statusMessage.textContent = text || '';
    }

    function updateTimerDisplay() {
        timerDisplay.textContent = window.PuzzleUtil.formatTime(secondsElapsed);
    }

    function stopTicking() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function startTicking() {
        stopTicking();
        isPaused = false;
        timerInterval = setInterval(() => {
            secondsElapsed += 1;
            updateTimerDisplay();
            persistProgress();
        }, 1000);
    }

    function saveCurrentDaily() {
        if (gameMode !== 'daily' || !difficulty || !boardState) return;
        window.Store.setDaily(PUZZLE_ID, window.PuzzleUtil.localDateKey(), difficulty, {
            status: gameCompleted ? 'completed' : 'in-progress',
            seconds: secondsElapsed,
            entries: cloneBoard(boardState),
            notes: cellNotes.map((row) => row.map((notes) => [...notes].sort((a, b) => a - b))),
            revealed: puzzleRevealed && !gameCompleted
        });
    }

    function saveActiveSession() {
        if (!puzzleReady || !boardState || !givens || !solution || !cellNotes || !difficulty || !gameMode) return;
        if (gameCompleted || puzzleRevealed || revealing) {
            window.Store.clearSession();
            return;
        }
        window.Store.setSession({
            puzzleId: PUZZLE_ID,
            mode: gameMode,
            level: difficulty,
            date: gameMode === 'daily' ? window.PuzzleUtil.localDateKey() : null,
            status: 'in-progress',
            seconds: secondsElapsed,
            entries: cloneBoard(boardState),
            notes: cellNotes.map((row) => row.map((notes) => [...notes].sort((a, b) => a - b))),
            givens: cloneBoard(givens),
            solution: cloneBoard(solution)
        });
    }

    function persistProgress() {
        saveCurrentDaily();
        saveActiveSession();
    }

    function cellElement(row, col) {
        return boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    }

    function isPeer(row, col) {
        if (!selected) return false;
        if (row === selected.row && col === selected.col) return false;
        const sameBox = Math.floor(row / 3) === Math.floor(selected.row / 3)
            && Math.floor(col / 3) === Math.floor(selected.col / 3);
        return row === selected.row || col === selected.col || sameBox;
    }

    function createBoard() {
        boardEl.innerHTML = '';
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                if ((col + 1) % 3 === 0 && col < 8) cell.classList.add('box-right');
                if ((row + 1) % 3 === 0 && row < 8) cell.classList.add('box-bottom');
                const value = document.createElement('span');
                value.className = 'cell-value';
                const notes = document.createElement('span');
                notes.className = 'notes-grid';
                notes.setAttribute('aria-hidden', 'true');
                for (let num = 1; num <= 9; num++) {
                    const mark = document.createElement('span');
                    mark.className = 'note';
                    mark.dataset.note = String(num);
                    mark.textContent = String(num);
                    notes.appendChild(mark);
                }
                cell.append(value, notes);
                cell.addEventListener('click', () => selectCell(row, col));
                boardEl.appendChild(cell);
            }
        }
    }

    function renderBoard() {
        if (!boardState || !givens) return;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = cellElement(row, col);
                const given = givens[row][col] !== 0;
                const value = boardState[row][col];
                cell.querySelector('.cell-value').textContent = value ? String(value) : '';
                cell.classList.toggle('given', given);
                cell.classList.toggle('user', !given && value !== 0);
                cell.classList.toggle('selected', !!selected && selected.row === row && selected.col === col);
                cell.classList.toggle('highlighted', isPeer(row, col));
                const notes = cellNotes[row][col];
                cell.classList.toggle('has-notes', value === 0 && notes.size > 0);
                cell.querySelectorAll('.note').forEach((mark) => {
                    mark.classList.toggle('on', notes.has(Number(mark.dataset.note)));
                });
                cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, ${given ? 'clue' : 'entry'} ${value || 'empty'}`);
            }
        }
    }

    function clearMarks() {
        boardEl.querySelectorAll('.cell').forEach((cell) => cell.classList.remove('invalid', 'hint'));
    }

    function setNotesMode(next) {
        notesMode = next;
        notesButton.setAttribute('aria-checked', String(notesMode));
    }

    function syncControls() {
        const locked = inputLocked();
        const blocked = !puzzleReady || locked || isPaused;
        document.querySelectorAll('.key').forEach((key) => { key.disabled = blocked; });
        notesButton.disabled = blocked;
        pauseButton.hidden = locked || !puzzleReady;
        pauseButton.setAttribute('aria-pressed', String(isPaused));
        pauseButton.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
        const showOverlay = puzzleReady && isPaused && !locked;
        pauseOverlay.hidden = !showOverlay;
        boardEl.classList.toggle('paused', showOverlay);
        document.getElementById('btn-hint').disabled = !puzzleReady || locked;
        document.getElementById('btn-solve').disabled = !puzzleReady || locked;
        document.getElementById('btn-check').disabled = !puzzleReady || gameCompleted || revealing;
    }

    function notesFromSaved(saved) {
        const notes = emptyNotes();
        if (!saved || !Array.isArray(saved.notes)) return notes;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const marks = saved.notes[row] && saved.notes[row][col];
                if (!Array.isArray(marks)) continue;
                marks.forEach((num) => {
                    if (num >= 1 && num <= 9) notes[row][col].add(num);
                });
            }
        }
        return notes;
    }

    function boardFromSaved(saved, puzzle) {
        if (!saved || !Array.isArray(saved.entries) || saved.entries.length !== 9) return cloneBoard(puzzle);
        const next = cloneBoard(puzzle);
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (puzzle[row][col] !== 0) continue;
                const value = Number(saved.entries[row][col]);
                next[row][col] = value >= 1 && value <= 9 ? value : 0;
            }
        }
        return next;
    }

    function haltRevealAnimation() {
        revealing = false;
        revealToken += 1;
        clearTimeout(revealTimer);
        revealTimer = null;
    }

    function commitReveal() {
        if (!revealing || !solution || !boardState || !cellNotes) return;
        haltRevealAnimation();
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                boardState[row][col] = solution[row][col];
                cellNotes[row][col].clear();
            }
        }
        puzzleRevealed = true;
        isPaused = false;
        stopTicking();
        if (puzzleReady) {
            clearMarks();
            renderBoard();
            syncControls();
            setStatus('Solution revealed. This run is not counted as solved.');
        }
    }

    function resetPlayState() {
        haltRevealAnimation();
        stopTicking();
        selected = null;
        setNotesMode(false);
        puzzleRevealed = false;
        gameCompleted = false;
        isPaused = false;
        secondsElapsed = 0;
        puzzleReady = false;
        lastAward = 0;
        clearTimeout(hintTimer);
        clearMarks();
        setStatus('');
        updateTimerDisplay();
        window.App.closePopouts();
        victoryModal.hidden = true;
    }

    function beginSession(mode, level, generated, saved) {
        gameMode = mode;
        difficulty = level;
        solution = generated.solution;
        givens = generated.puzzle;
        playTitle.textContent = `${mode === 'daily' ? 'Daily' : 'New game'} · ${window.PuzzleUtil.difficultyLabel(level)}`;

        if (saved && saved.status === 'completed') {
            boardState = cloneBoard(generated.solution);
            cellNotes = emptyNotes();
            secondsElapsed = saved.seconds || 0;
            gameCompleted = true;
            setStatus(window.Store.hideTimers() ? 'Completed' : `Completed in ${window.PuzzleUtil.formatTime(secondsElapsed)}`);
        } else if (saved && saved.revealed) {
            boardState = cloneBoard(generated.solution);
            cellNotes = emptyNotes();
            secondsElapsed = saved.seconds || 0;
            puzzleRevealed = true;
            setStatus('Solution revealed. This run is not counted as solved.');
        } else if (saved && Array.isArray(saved.entries)) {
            boardState = boardFromSaved(saved, givens);
            cellNotes = notesFromSaved(saved);
            secondsElapsed = saved.seconds || 0;
            isPaused = true;
            setStatus('');
        } else {
            boardState = cloneBoard(givens);
            cellNotes = emptyNotes();
            setStatus('');
        }

        puzzleReady = true;
        updateTimerDisplay();
        renderBoard();
        syncControls();
        if (!isPaused && !inputLocked()) startTicking();
        persistProgress();
    }

    function showSudokuScreen() {
        window.App.preparePlay(PUZZLE_ID);
    }

    function usableSession(saved) {
        if (!saved || saved.puzzleId !== PUZZLE_ID || saved.status !== 'in-progress') return false;
        if (saved.mode !== 'daily' && saved.mode !== 'free') return false;
        if (!['easy', 'medium', 'hard'].includes(saved.level)) return false;
        return isBoard(saved.givens) && isBoard(saved.solution) && isBoard(saved.entries);
    }

    function restoreSession(saved) {
        if (!usableSession(saved)) return false;
        generationToken += 1;
        resetPlayState();
        showSudokuScreen();
        beginSession(saved.mode, saved.level, {
            puzzle: saved.givens,
            solution: saved.solution
        }, {
            status: 'in-progress',
            seconds: saved.seconds || 0,
            entries: saved.entries,
            notes: saved.notes
        });
        isPaused = true;
        stopTicking();
        syncControls();
        persistProgress();
        return true;
    }

    function startGeneratedGame(mode, level, rng, saved) {
        if (revealing) {
            commitReveal();
            persistProgress();
        }
        const token = ++generationToken;
        resetPlayState();
        window.Store.clearSession();
        gameMode = null;
        difficulty = null;
        boardState = null;
        showSudokuScreen();
        playTitle.textContent = `${mode === 'daily' ? 'Daily' : 'New game'} · ${window.PuzzleUtil.difficultyLabel(level)}`;
        setStatus('Preparing puzzle…');
        syncControls();
        window.setTimeout(() => {
            if (token !== generationToken) return;
            const generated = generatePuzzle(level, rng);
            if (token !== generationToken) return;
            if (!generated) {
                setStatus('Could not build a puzzle.');
                return;
            }
            beginSession(mode, level, generated, saved);
        }, 30);
    }

    function startDaily(level) {
        const date = window.PuzzleUtil.localDateKey();
        startGeneratedGame('daily', level, mulberry32(hashString(`${date}:${level}`)), window.Store.getDaily(PUZZLE_ID, date, level));
    }

    function startFree(level) {
        startGeneratedGame('free', level, Math.random, null);
    }

    function leave() {
        if (revealing) commitReveal();
        persistProgress();
        generationToken += 1;
        stopTicking();
        puzzleReady = false;
        window.App.showHome(PUZZLE_ID);
    }

    function selectCell(row, col) {
        if (!puzzleReady || isPaused || inputLocked()) return;
        selected = { row, col };
        renderBoard();
    }

    function moveSelection(dRow, dCol) {
        if (!puzzleReady || isPaused || inputLocked()) return;
        const row = selected ? selected.row : 0;
        const col = selected ? selected.col : 0;
        selected = {
            row: Math.min(8, Math.max(0, row + dRow)),
            col: Math.min(8, Math.max(0, col + dCol))
        };
        renderBoard();
    }

    function canEditSelection() {
        return !!(puzzleReady && selected && !isPaused && !inputLocked() && givens[selected.row][selected.col] === 0);
    }

    function placeNumber(num) {
        if (!canEditSelection()) return;
        const { row, col } = selected;
        if (notesMode) {
            if (boardState[row][col] !== 0) return;
            const notes = cellNotes[row][col];
            if (notes.has(num)) notes.delete(num);
            else notes.add(num);
        } else {
            boardState[row][col] = num;
            cellNotes[row][col].clear();
        }
        clearMarks();
        renderBoard();
        persistProgress();
        if (!notesMode) checkWin();
    }

    function eraseSelection() {
        if (!canEditSelection()) return;
        const { row, col } = selected;
        clearMarks();
        if (notesMode) cellNotes[row][col].clear();
        else {
            boardState[row][col] = 0;
            cellNotes[row][col].clear();
        }
        renderBoard();
        persistProgress();
    }

    function pauseGame() {
        if (!puzzleReady || inputLocked() || isPaused) return;
        isPaused = true;
        stopTicking();
        syncControls();
        persistProgress();
    }

    function resumeGame() {
        if (!puzzleReady || inputLocked() || !isPaused) return;
        startTicking();
        syncControls();
    }

    function togglePause() {
        if (isPaused) resumeGame();
        else pauseGame();
    }

    function cellBreaksRules(row, col) {
        const value = boardState[row][col];
        boardState[row][col] = 0;
        const ok = isValid(boardState, row, col, value);
        boardState[row][col] = value;
        return !ok;
    }

    function findConflict() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const value = boardState[row][col];
                if (value === 0 || givens[row][col] !== 0) continue;
                if (value !== solution[row][col] || cellBreaksRules(row, col)) return { row, col };
            }
        }
        return null;
    }

    function candidatesFor(row, col) {
        const nums = [];
        for (let num = 1; num <= 9; num++) {
            if (isValid(boardState, row, col, num)) nums.push(num);
        }
        return nums;
    }

    function findNakedSingle() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (boardState[row][col] !== 0) continue;
                const nums = candidatesFor(row, col);
                if (nums.length === 1) return { row, col, num: nums[0] };
            }
        }
        return null;
    }

    function unitCells(kind, index) {
        const cells = [];
        for (let offset = 0; offset < 9; offset++) {
            if (kind === 'row') cells.push([index, offset]);
            else if (kind === 'col') cells.push([offset, index]);
            else cells.push([3 * Math.floor(index / 3) + Math.floor(offset / 3), 3 * (index % 3) + (offset % 3)]);
        }
        return cells;
    }

    function findHiddenSingle() {
        for (const kind of ['row', 'col', 'box']) {
            for (let index = 0; index < 9; index++) {
                const unit = unitCells(kind, index);
                for (let num = 1; num <= 9; num++) {
                    if (unit.some(([row, col]) => boardState[row][col] === num)) continue;
                    const spots = unit.filter(([row, col]) => boardState[row][col] === 0 && isValid(boardState, row, col, num));
                    if (spots.length === 1) return { row: spots[0][0], col: spots[0][1], num };
                }
            }
        }
        return null;
    }

    function findFewestSolutionCell() {
        const copy = cloneBoard(boardState);
        let best = null;
        let bestCount = 10;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (copy[row][col] !== 0) continue;
                let count = 0;
                for (let num = 1; num <= 9; num++) {
                    if (isValid(copy, row, col, num)) count += 1;
                }
                if (count > 0 && count < bestCount) {
                    bestCount = count;
                    best = { row, col, num: solution[row][col] };
                }
            }
        }
        return best;
    }

    function placeHint(spot) {
        boardState[spot.row][spot.col] = spot.num;
        cellNotes[spot.row][spot.col].clear();
        clearMarks();
        renderBoard();
        const cell = cellElement(spot.row, spot.col);
        cell.classList.add('hint');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => cell.classList.remove('hint'), 2000);
        setStatus('Hint placed.');
        persistProgress();
        checkWin();
    }

    function giveHint() {
        if (!puzzleReady || inputLocked()) return;
        window.App.closePopouts();
        const conflict = findConflict();
        if (conflict) {
            clearMarks();
            cellElement(conflict.row, conflict.col).classList.add('invalid');
            setStatus('There\'s a mistake in a filled cell.');
            return;
        }
        const spot = findNakedSingle() || findHiddenSingle() || findFewestSolutionCell();
        if (!spot) {
            setStatus('No empty cells left.');
            return;
        }
        placeHint(spot);
    }

    function revealSolution() {
        if (!puzzleReady || inputLocked()) return;
        window.App.closePopouts();
        const cells = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (boardState[row][col] !== solution[row][col]) cells.push([row, col]);
            }
        }
        revealing = true;
        isPaused = false;
        stopTicking();
        clearMarks();
        syncControls();
        setStatus('');
        const token = ++revealToken;
        let index = 0;
        const step = () => {
            if (!revealing || token !== revealToken) return;
            if (index >= cells.length) {
                revealing = false;
                puzzleRevealed = true;
                syncControls();
                setStatus('Solution revealed. This run is not counted as solved.');
                persistProgress();
                return;
            }
            const [row, col] = cells[index];
            index += 1;
            boardState[row][col] = solution[row][col];
            cellNotes[row][col].clear();
            renderBoard();
            revealTimer = setTimeout(step, 25);
        };
        step();
    }

    function checkPuzzle() {
        if (!puzzleReady || gameCompleted || revealing) return;
        window.App.closePopouts();
        clearMarks();
        let mistakes = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const value = boardState[row][col];
                if (value === 0 || givens[row][col] !== 0) continue;
                if (value !== solution[row][col]) {
                    mistakes += 1;
                    cellElement(row, col).classList.add('invalid');
                }
            }
        }
        setStatus(mistakes === 0
            ? 'No mistakes in the cells you have filled.'
            : `${mistakes} ${mistakes === 1 ? 'cell does' : 'cells do'} not match the solution.`);
    }

    function applyRestart() {
        haltRevealAnimation();
        boardState = cloneBoard(givens);
        cellNotes = emptyNotes();
        selected = null;
        setNotesMode(false);
        puzzleRevealed = false;
        gameCompleted = false;
        isPaused = false;
        secondsElapsed = 0;
        clearMarks();
        setStatus('');
        updateTimerDisplay();
        renderBoard();
        syncControls();
        startTicking();
        persistProgress();
    }

    function askConfirm(message, okLabel) {
        window.App.closePopouts();
        confirmMessage.textContent = message;
        const okButton = document.getElementById('btn-confirm-ok');
        okButton.textContent = okLabel || 'OK';
        confirmModal.hidden = false;
        return new Promise((resolve) => {
            confirmResolver = (accepted) => {
                confirmModal.hidden = true;
                confirmResolver = null;
                okButton.textContent = 'Restart';
                resolve(!!accepted);
            };
        });
    }

    function restartPuzzle() {
        if (!puzzleReady || !givens) return;
        window.App.closePopouts();
        if (gameMode !== 'daily') {
            applyRestart();
            return;
        }
        askConfirm("Restart today's puzzle? Your saved time and progress will be cleared.", 'Restart').then((accepted) => {
            if (accepted) applyRestart();
        });
    }

    function checkWin() {
        if (!puzzleReady || puzzleRevealed || gameCompleted || revealing) return;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (boardState[row][col] !== solution[row][col]) return;
            }
        }
        gameCompleted = true;
        isPaused = false;
        stopTicking();
        lastAward = 0;
        if (gameMode === 'daily') {
            lastAward = window.Store.awardIfNeeded(
                PUZZLE_ID,
                window.PuzzleUtil.localDateKey(),
                difficulty,
                window.PuzzleUtil.trophyFor(PUZZLE_ID, difficulty)
            );
            window.Store.recordBest(PUZZLE_ID, difficulty, secondsElapsed);
        }
        persistProgress();
        syncControls();
        setStatus(window.Store.hideTimers() ? 'Solved.' : `Solved in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`);
        window.App.refreshChrome();
        window.App.showVictory({
            title: 'Puzzle solved',
            seconds: secondsElapsed,
            trophy: gameMode === 'daily'
                ? (lastAward ? `+${lastAward} ${lastAward === 1 ? 'trophy' : 'trophies'}` : 'Trophies already claimed for this daily.')
                : '',
            again: gameMode === 'daily' ? 'Back to Sudoku' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') leave();
                else startFree(difficulty);
            }
        });
    }

    function onKeyDown(event) {
        if (!puzzleReady || isPaused || inputLocked()) return;
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
        if (event.key >= '1' && event.key <= '9') {
            event.preventDefault();
            if (selected) placeNumber(Number(event.key));
            return;
        }
        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            eraseSelection();
            return;
        }
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (moves[event.key]) {
            event.preventDefault();
            moveSelection(moves[event.key][0], moves[event.key][1]);
        }
    }

    function bind() {
        createBoard();
        document.getElementById('btn-pause').addEventListener('click', togglePause);
        notesButton.addEventListener('click', () => {
            if (notesButton.disabled) return;
            setNotesMode(!notesMode);
        });
        document.getElementById('btn-hint').addEventListener('click', giveHint);
        document.getElementById('btn-solve').addEventListener('click', revealSolution);
        document.getElementById('btn-check').addEventListener('click', checkPuzzle);
        document.getElementById('btn-restart').addEventListener('click', restartPuzzle);
        document.querySelectorAll('.key').forEach((key) => {
            key.addEventListener('click', () => {
                if (key.disabled) return;
                if (key.dataset.value === 'erase') eraseSelection();
                else placeNumber(Number(key.dataset.value));
            });
        });
        document.getElementById('btn-confirm-ok').addEventListener('click', () => {
            if (confirmResolver) confirmResolver(true);
        });
        document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
            if (confirmResolver) confirmResolver(false);
        });
        const saveForHide = () => {
            if (revealing) commitReveal();
            persistProgress();
        };
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') saveForHide();
        });
        window.addEventListener('pagehide', saveForHide);
        syncControls();
    }

    return {
        bind,
        startDaily,
        startFree,
        restoreSession,
        askConfirm,
        leave,
        onKeyDown,
        save: persistProgress
    };
})();
