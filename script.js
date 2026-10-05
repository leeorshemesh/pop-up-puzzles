let board = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
];

function isValid(board, row, col, num){
    for(let i = 0; i < 9; i++){
        if(board[row][i] === num || board[i][col] === num){
            return false;
        }
        let boxRow = 3*Math.floor(row/3) + Math.floor(i/3);
        let boxCol = 3*Math.floor(col/3) + i%3;
        if(board[boxRow][boxCol] === num){
            return false;
        }
    }
    return true;
}

function solve(board){
    for(let row = 0; row < 9; row++){
        for(let col = 0; col < 9; col++){
            if(board[row][col]===0){
                for(let num=1; num <= 9; num++){
                    if(isValid(board,row,col,num)){
                        board[row][col] = num;

                        if(solve(board)){
                            return true;
                        }

                        board[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

const boardContainer = document.getElementById('sudoku-board');

let boardState = Array(9).fill(null).map(() => Array(9).fill(0));

function createBoardDOM() {
    const boardElement = document.getElementById('sudoku-board');
    if (!boardElement) return;

    boardElement.innerHTML = '';

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const wrapper = document.createElement('div');
            wrapper.className = 'cell-wrapper';

            // Apply 3x3 grid section borders to the wrapper, not the input
            if ((r + 1) % 3 === 0 && r < 8) wrapper.classList.add('border-bottom');
            if ((c + 1) % 3 === 0 && c < 8) wrapper.classList.add('border-right');

            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 1;
            input.classList.add('cell');
            input.dataset.row = r;
            input.dataset.col = c;

            // Direct input handler
            input.addEventListener('input', (e) => {
                if (isPaused) {
                    e.target.value = '';
                    return;
                }

                const r = parseInt(e.target.dataset.row);
                const c = parseInt(e.target.dataset.col);
                boardState[r][c] = parseInt(e.target.value) || 0;

                updateKeypadState();
                checkWinCondition();
            });

            // Focus & active tracking
            input.addEventListener('focus', (e) => {
                activeCell = e.target;
                highlightGroup(parseInt(e.target.dataset.row), parseInt(e.target.dataset.col));
            });
            input.addEventListener('blur', clearHighlights);
            input.addEventListener('keydown', handleArrowNavigation);

            // Notes mode & keyboard entry
            input.addEventListener('keydown', (e) => {
                if (isPaused) return;

                if (e.key >= '1' && e.key <= '9') {
                    const num = parseInt(e.key);
                    const r = parseInt(e.target.dataset.row);
                    const c = parseInt(e.target.dataset.col);

                    if (notesMode) {
                        e.preventDefault();
                        togglePencilNote(r, c, num);
                    } else {
                        clearCellNotes(r, c);
                    }
                }
            });

            wrapper.appendChild(input);
            boardElement.appendChild(wrapper); // Clean single append to grid
        }
    }
}

function handleCellInput(e){
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    const value = parseInt(e.target.value);

    if(isNaN(value) || value < 1 || value > 9){
        e.target.value = '';
        boardState[row][col] = 0;
    } else{
        boardState[row][col] = value;
        e.target.classList.add('user-input');
    }
}

function updateBoardDOM(){
    const inputs = boardContainer.querySelectorAll('.cell');
    inputs.forEach(input => {
        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);
        const val = boardState[r][c];

        if(val != 0){
            input.value = val;
        } else{
            input.value = '';
        }
    });
    updateKeypadState()
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function solveVisualized(board){
    for(let row = 0; row < 9; row++){
        for(let col = 0; col < 9; col++){
            if(board[row][col] === 0){
                for(let num = 1; num <= 9; num++){
                    if(isValid(board, row, col, num)){
                        board[row][col]=num;
                        updateBoardDOM();

                        await sleep(3);
                        if(await solveVisualized(board)){
                            return true;
                        }

                        board[row][col] = 0;
                        updateBoardDOM();
                        await sleep(3);
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function highlightGroup(activeRow, activeCol){
    const inputs = document.querySelectorAll('.cell');
    inputs.forEach(input=> {
        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);

        const isSameRow = r === activeRow;
        const isSameCol = c === activeCol;
        const isSameBox = Math.floor(r/3) === Math.floor(activeRow/3) && Math.floor(c/3) === Math.floor(activeCol / 3);
        
        if(isSameRow || isSameCol || isSameBox){
            input.classList.add('highlighted');
        } else{
            input.classList.remove('highlighted');
        }
    });
}

function clearHighlights(){
    document.querySelectorAll('.cell').forEach(i => i.classList.remove('highlighted'));
}

function checkPuzzle(){
    let hasErrors = false;
    let newlyLocked = 0;
    const inputs = document.querySelectorAll('.cell');

    inputs.forEach(input => {
        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);
        const val = boardState[r][c];

        input.classList.remove('invalid');

        if(val !== 0 && !input.classList.contains('given')){
            boardState[r][c] = 0;
            if(isValid(boardState, r, c, val)){
                boardState[r][c] = val;
                input.classList.remove('user-input');
                input.classList.add('given');
                input.readOnly = true;
                newlyLocked++;
            } else{
                boardState[r][c] = val;
                input.classList.add('invalid');
                hasErrors = true;
            }
        }
    });

    if(!hasErrors){
        alert("Nice job! Correct entries are now locked in.");
    }

    updateKeypadState()
}

function resetToGiven(){
    for(let r = 0; r < 9; r++){
        for(let c = 0; c < 9; c++){
            const input = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if(!input.classList.contains('given')){
                boardState[r][c] = 0;
                input.classList.remove('user-input', 'invalid');
            }
        }
    }
    updateBoardDOM();
}

function shuffle(array){
    for(let i = array.length - 1; i>0; i--){
        const j = Math.floor(Math.random()*(i+1));
        [array[i], array[j]] = [array[j],array[i]];
    }
    return array;
}

function solveRandomized(board){
    for(let row = 0; row < 9; row++){
        for(let col = 0; col < 9; col++){
            if(board[row][col] === 0){
                const numbers = shuffle([1,2,3,4,5,6,7,8,9]);
                for(let num of numbers){
                    if(isValid(board, row, col, num)){
                        board[row][col] = num;
                        if(solveRandomized(board)){
                            return true;
                        }
                        board[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function generateNewPuzzle(){
    const difficultyMap = {
        'easy': 35,
        'medium': 45,
        'hard': 55
    };

    const selectedDifficulty = document.getElementById('difficulty-select').value;
    const attempts = difficultyMap[selectedDifficulty] || 45;

    boardState = Array(9).fill(null).map(() => Array(9).fill(0));
    
    for(let box = 0; box < 9; box += 3){
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        let idx = 0;
        for(let r = 0; r < 3; r++){
            for(let c = 0; c < 3; c++){
                boardState[box + r][box + c] = nums[idx++];
            }
        }
    }

    solveRandomized(boardState);

    let removed = 0;
    while(removed < attempts){
        const r = Math.floor(Math.random() * 9);
        const c = Math.floor(Math.random() * 9);

        if(boardState[r][c] !== 0){
            boardState[r][c] = 0;
            removed++;
        }
    }

    const inputs = document.querySelectorAll('.cell');
    inputs.forEach(input =>{
        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);

        input.classList.remove('given', 'user-input', 'invalid');

        if(boardState[r][c] !== 0){
            input.classList.add('given');
            input.readOnly = true;
        } else{
            input.readOnly = false;
        }
    });

    updateBoardDOM();
    startTimer();
}

function handleArrowNavigation(e){
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if(!keys.includes(e.key)){
        return;
    }

    e.preventDefault();

    let r = parseInt(e.target.dataset.row);
    let c = parseInt(e.target.dataset.col);

    if(e.key === 'ArrowUp'){
        r = Math.max(0, r - 1);
    }
    if(e.key === 'ArrowDown'){
        r = Math.min(8, r + 1);
    }
    if(e.key === 'ArrowLeft'){
        c = Math.max(0, c - 1);
    }
    if(e.key === 'ArrowRight'){
        c = Math.min(8, c + 1);
    }

    const nextCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);

    if(nextCell){
        nextCell.focus();
    }
}

let timerInterval = null;
let secondsElapsed = 0;
let isPaused = false;

function startTimer(){
    clearInterval(timerInterval);
    secondsElapsed = 0;
    isPaused = false;
    updateTimerDisplay();

    timerInterval  = setInterval(() => {
        if(!isPaused){
            secondsElapsed++;
            updateTimerDisplay();
        }
    }, 1000);
}

function updateTimerDisplay(){
    const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
    const secs = (secondsElapsed % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').textContent = `${mins}:${secs}`;
}

function togglePause(){
    const board = document.getElementById('sudoku-board');
    const pauseBtn = document.getElementById('btn-pause');

    isPaused = !isPaused;

    if(isPaused){
        board.classList.add('paused');
        pauseBtn.textContent = 'Play';
    } else{
        board.classList.remove('paused');
        pauseBtn.textContent = 'Pause';
    }
}

let activeCell = null;

function handleKeypadClick(e) {
    if (isPaused || !activeCell || activeCell.readOnly) return;

    const val = e.target.dataset.value;
    const r = parseInt(activeCell.dataset.row);
    const c = parseInt(activeCell.dataset.col);

    if (val === 'erase') {
        boardState[r][c] = 0;
        activeCell.value = '';
        activeCell.classList.remove('user-input', 'invalid');
    } else {
        const num = parseInt(val);
        boardState[r][c] = num;
        activeCell.value = num;
        activeCell.classList.add('user-input');
        activeCell.classList.remove('invalid');
    }

    if (notesMode) {
        if (val === 'erase') {
            clearCellNotes(r, c);
        } else {
            const num = parseInt(val);
            togglePencilNote(r, c, num);
        }
        return; // Stop execution so standard number placement isn't triggered
    }

    // If placing a real value, wipe existing notes in that cell
    clearCellNotes(r, c);

    updateKeypadState();
    checkWinCondition();
}

function updateKeypadState() {
    const counts = {};
    for (let i = 1; i <= 9; i++) counts[i] = 0;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const num = boardState[r][c];
            if (num >= 1 && num <= 9) {
                counts[num]++;
            }
        }
    }

    document.querySelectorAll('.key[data-value]').forEach(key => {
        const val = parseInt(key.dataset.value);
        if (val) {
            key.disabled = counts[val] >= 9;
        }
    });
}

function checkWinCondition() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (boardState[r][c] === 0) return false;
        }
    }

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const val = boardState[r][c];
            boardState[r][c] = 0;
            const valid = isValid(boardState, r, c, val);
            boardState[r][c] = val;
            if (!valid) return false;
        }
    }

    triggerVictory();
    return true;
}

function triggerVictory() {
    clearInterval(timerInterval);
    
    const board = document.getElementById('sudoku-board');
    board.classList.add('victory');

    const winTime = document.getElementById('timer-display').textContent;
    document.getElementById('win-time').textContent = winTime;
    
    setTimeout(() => {
        document.getElementById('victory-modal').classList.remove('hidden');
    }, 400);
}

function initTheme() {
    const themeBtn = document.getElementById('btn-theme');
    
    themeBtn.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });
}

let notesMode = false;
let cellNotes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));

document.getElementById('btn-notes').addEventListener('click', () => {
    notesMode = !notesMode;
    const btn = document.getElementById('btn-notes');
    btn.textContent = `Notes Mode: ${notesMode ? 'ON' : 'OFF'}`;
    btn.classList.toggle('active', notesMode);
});

function togglePencilNote(r, c, val) {
    if (boardState[r][c] !== 0) return; // Ignore locked/filled cells

    const notes = cellNotes[r][c];
    if (notes.has(val)) {
        notes.delete(val);
    } else {
        notes.add(val);
    }

    // Keep active board value empty while taking candidate notes
    const input = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (input) input.value = '';

    renderCellNotes(r, c);
}

function renderCellNotes(r, c) {
    const input = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (!input) return;

    let cellWrapper = input.parentElement;
    let notesGrid = cellWrapper.querySelector('.notes-grid');

    if (!notesGrid) {
        notesGrid = document.createElement('div');
        notesGrid.className = 'notes-grid';
        for (let i = 1; i <= 9; i++) {
            const span = document.createElement('span');
            span.className = `note-digit note-${i}`;
            span.textContent = i;
            notesGrid.appendChild(span);
        }
        cellWrapper.appendChild(notesGrid);
    }

    const currentNotes = cellNotes[r][c];
    for (let i = 1; i <= 9; i++) {
        const digitSpan = notesGrid.querySelector(`.note-${i}`);
        if (digitSpan) {
            digitSpan.classList.toggle('visible', currentNotes.has(i));
        }
    }
}

function clearCellNotes(r, c) {
    cellNotes[r][c].clear();
    renderCellNotes(r, c);
}

function findSmartestCell() {
    let bestCell = null;
    let minCandidates = 10;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const input = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            const isGiven = input && (input.readOnly || input.classList.contains('given'));

            if (boardState[r][c] === 0 && !isGiven) {
                const candidates = getValidCandidates(r, c);
                
                if (candidates.length === 1) {
                    return { row: r, col: c, value: candidates[0] };
                }

                if (candidates.length < minCandidates && candidates.length > 0) {
                    minCandidates = candidates.length;
                    bestCell = { row: r, col: c, value: null };
                }
            }
        }
    }

    if (bestCell) {
        const solution = solveCopy(boardState);
        if (solution) {
            bestCell.value = solution[bestCell.row][bestCell.col];
            return bestCell;
        }
    }

    return null;
}

function getValidCandidates(r, c){
    const candidates = [];
    for(let num = 1; num <= 9; num++){
        if(isValid(boardState, r, c, num)){
            candidates.push(num);
        }
    }
    return candidates;
}

function solveCopy(board){
    const copy = board.map(row => [...row]);
    if(solveSudoku(cooy)){
        return copy;
    }
    return null;
}

function giveHint() {
    if (isPaused) return;

    const hint = findSmartestCell();
    if (!hint || !hint.value) {
        alert("No obvious hints available or board has errors!");
        return;
    }

    const { row, col, value } = hint;
    const input = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);

    if (input && (input.readOnly || input.classList.contains('given'))) {
        return;
    }

    boardState[row][col] = value;
    clearCellNotes(row, col);

    if (input) {
        input.value = value;
        input.classList.add('user-input', 'hint-highlight');

        setTimeout(() => {
            input.classList.remove('hint-highlight');
        }, 2000);
    }

    updateKeypadState();
    checkWinCondition();
}




document.addEventListener('DOMContentLoaded', () => {
    createBoardDOM();
    generateNewPuzzle();
    updateKeypadState()

    document.getElementById('btn-generate').addEventListener('click', ()=> generateNewPuzzle());
    document.getElementById('btn-solve').addEventListener('click', async () =>{
        document.querySelectorAll('button').forEach(b => b.disabled = true);

        await solveVisualized(boardState);

        document.querySelectorAll('button').forEach(b => b.disabled = false);
    });
    document.getElementById('btn-check').addEventListener('click', checkPuzzle);
    document.getElementById('btn-clear').addEventListener('click', resetToGiven);
    document.getElementById('difficulty-select').addEventListener('change', generateNewPuzzle);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-hint')?.addEventListener('click', giveHint);
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', handleKeypadClick);
    });
    startTimer();

    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.body.removeAttribute('data-theme');
                themeBtn.textContent = '🌙';
            } else {
                document.body.setAttribute('data-theme', 'dark');
                themeBtn.textContent = '☀️';
            }
        });
    }

    const playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            document.getElementById('victory-modal').classList.add('hidden');
            document.getElementById('sudoku-board').classList.remove('victory');
            generateNewPuzzle();
        });
    }
});