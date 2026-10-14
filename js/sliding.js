(function () {
    const PUZZLE_ID = 'sliding';
    const SIZES = { easy: 3, medium: 4, hard: 5 };

    const boardEl = document.getElementById('sliding-board');
    const statusEl = document.getElementById('sliding-status');
    const scoreEl = document.getElementById('sliding-score');
    const timerEl = document.getElementById('sliding-timer');
    const pauseButton = document.getElementById('btn-sliding-pause');
    const pauseOverlay = document.getElementById('sliding-pause');

    let size = 3;
    let tiles = [];
    let blank = 0;
    let level = 'easy';
    let gameMode = 'daily';
    let playDate = '';
    let secondsElapsed = 0;
    let timerId = null;
    let started = false;
    let won = false;
    let paused = false;
    let rng = null;
    let puzzleRevealed = false;
    let drag = null;
    let moves = 0;

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function syncHintButton() {
        const button = document.getElementById('btn-hint');
        if (!document.getElementById('sliding-play').hidden) {
            button.disabled = won || paused;
        }
    }

    function indexOfBlank(list) {
        return list.indexOf(0);
    }

    function isSolved(list) {
        for (let i = 0; i < list.length - 1; i++) {
            if (list[i] !== i + 1) return false;
        }
        return list[list.length - 1] === 0;
    }

    function inversionCount(list) {
        const flat = list.filter((n) => n !== 0);
        let count = 0;
        for (let i = 0; i < flat.length; i++) {
            for (let j = i + 1; j < flat.length; j++) {
                if (flat[i] > flat[j]) count += 1;
            }
        }
        return count;
    }

    function blankRowFromBottom(list, n) {
        const index = indexOfBlank(list);
        const rowFromTop = Math.floor(index / n);
        return n - rowFromTop;
    }

    function isSolvable(list, n) {
        const inv = inversionCount(list);
        if (n % 2 === 1) return inv % 2 === 0;
        const blankRow = blankRowFromBottom(list, n);
        return blankRow % 2 === 0 ? inv % 2 === 1 : inv % 2 === 0;
    }

    function scramble() {
        const total = size * size;
        const list = Array.from({ length: total }, (_, i) => (i + 1) % total);
        do {
            for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                const swap = list[i];
                list[i] = list[j];
                list[j] = swap;
            }
        } while (!isSolvable(list, size) || isSolved(list));
        tiles = list;
        blank = indexOfBlank(tiles);
    }

    function neighbors(index) {
        const row = Math.floor(index / size);
        const col = index % size;
        const list = [];
        if (row > 0) list.push(index - size);
        if (row < size - 1) list.push(index + size);
        if (col > 0) list.push(index - 1);
        if (col < size - 1) list.push(index + 1);
        return list;
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
        scoreEl.textContent = String(moves);
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
            size,
            tiles: tiles.slice(),
            moves,
            revealed: puzzleRevealed && !won
        });
    }

    function manhattan(list) {
        let total = 0;
        for (let i = 0; i < list.length; i++) {
            const value = list[i];
            if (!value) continue;
            const goal = value - 1;
            const row = Math.floor(i / size);
            const col = i % size;
            const goalRow = Math.floor(goal / size);
            const goalCol = goal % size;
            total += Math.abs(row - goalRow) + Math.abs(col - goalCol);
        }
        return total;
    }

    function findHintMove() {
        if (isSolved(tiles)) return null;
        const key = (list) => list.join(',');
        const start = tiles.slice();
        const queue = [{ state: start, blankAt: indexOfBlank(start), firstMove: null }];
        const seen = new Set([key(start)]);
        let best = null;
        let bestScore = manhattan(start);

        while (queue.length) {
            const node = queue.shift();
            const around = neighbors(node.blankAt);
            for (let i = 0; i < around.length; i++) {
                const swapIndex = around[i];
                const next = node.state.slice();
                next[node.blankAt] = next[swapIndex];
                next[swapIndex] = 0;
                const nextKey = key(next);
                if (seen.has(nextKey)) continue;
                seen.add(nextKey);
                const firstMove = node.firstMove == null ? swapIndex : node.firstMove;
                if (isSolved(next)) return firstMove;
                const score = manhattan(next);
                if (score < bestScore) {
                    bestScore = score;
                    best = firstMove;
                }
                if (seen.size < 4000) {
                    queue.push({ state: next, blankAt: swapIndex, firstMove });
                }
            }
            if (seen.size >= 4000) break;
        }
        if (best != null) return best;
        const adjacent = neighbors(blank);
        return adjacent.length ? adjacent[0] : null;
    }

    function giveHint() {
        if (paused || won) return;
        window.App.closePopouts();
        const moveIndex = findHintMove();
        if (moveIndex == null) {
            setStatus('No hint available.');
            return;
        }
        puzzleRevealed = true;
        setStatus(gameMode === 'daily'
            ? 'Hint used — this daily will not award trophies.'
            : 'Hint applied.');
        slide(moveIndex, true);
    }

    function render() {
        boardEl.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
        boardEl.innerHTML = '';
        tiles.forEach((value, index) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'sliding-tile' + (value === 0 ? ' blank' : '');
            cell.textContent = value === 0 ? '' : String(value);
            cell.disabled = value === 0 || paused || won;
            cell.dataset.index = String(index);
            if (value !== 0) {
                cell.addEventListener('click', () => {
                    if (drag && drag.moved) return;
                    slide(index);
                });
                cell.addEventListener('pointerdown', (event) => beginDrag(event, index, cell));
            }
            boardEl.appendChild(cell);
        });
        updateHeader();
    }

    function beginDrag(event, index, cell) {
        if (paused || won || event.button !== 0) return;
        if (!neighbors(blank).includes(index)) return;
        event.preventDefault();
        const blankRow = Math.floor(blank / size);
        const blankCol = blank % size;
        const tileRow = Math.floor(index / size);
        const tileCol = index % size;
        const towardX = blankCol - tileCol;
        const towardY = blankRow - tileRow;
        const tileRect = cell.getBoundingClientRect();
        const blankCell = boardEl.querySelector(`[data-index="${blank}"]`);
        const blankRect = blankCell
            ? blankCell.getBoundingClientRect()
            : tileRect;
        const maxX = towardX === 0 ? 0 : blankRect.left - tileRect.left;
        const maxY = towardY === 0 ? 0 : blankRect.top - tileRect.top;
        drag = {
            index,
            cell,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
            pointerId: event.pointerId,
            towardX,
            towardY,
            maxX,
            maxY,
            gap: Math.max(Math.abs(maxX), Math.abs(maxY))
        };
        try { cell.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
        cell.classList.add('sliding-drag');
    }

    function onPointerMove(event) {
        if (!drag) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true;
        let tx = 0;
        let ty = 0;
        if (drag.towardX !== 0) {
            if (drag.maxX > 0) tx = Math.max(0, Math.min(drag.maxX, dx));
            else tx = Math.min(0, Math.max(drag.maxX, dx));
        }
        if (drag.towardY !== 0) {
            if (drag.maxY > 0) ty = Math.max(0, Math.min(drag.maxY, dy));
            else ty = Math.min(0, Math.max(drag.maxY, dy));
        }
        drag.cell.style.transform = `translate(${tx}px, ${ty}px)`;
    }

    function onPointerUp(event) {
        if (!drag) return;
        const { index, cell, startX, startY, moved, pointerId, towardX, towardY, gap } = drag;
        try { cell.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
        cell.classList.remove('sliding-drag');
        cell.style.transform = '';
        drag = null;
        if (!moved) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const aligned = (towardX !== 0 && towardY === 0) || (towardY !== 0 && towardX === 0);
        if (!aligned) return;
        const projected = towardX !== 0 ? dx * Math.sign(towardX) : dy * Math.sign(towardY);
        const threshold = Math.max(24, gap * 0.4);
        if (projected > threshold) slide(index);
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
                window.Store.recordScoreBest(PUZZLE_ID, level, moves, scoring.better);
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
            window.Store.recordScoreBest(PUZZLE_ID, level, moves, scoring.better);
            bestScore = window.Store.getScoreBests(PUZZLE_ID)[level];
        }
        setStatus(window.Store.hideTimers()
            ? `Solved · ${moves} moves.`
            : `Solved in ${window.PuzzleUtil.formatTime(secondsElapsed)} · ${moves} moves.`);
        window.App.showVictory({
            title: 'Puzzle solved',
            seconds: secondsElapsed,
            score: moves,
            bestScore,
            scoring,
            trophy,
            again: gameMode === 'daily' ? 'Back to Sliding Puzzle' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') window.Sliding.leave();
                else window.Sliding.startFree(level);
            }
        });
    }

    function slide(index) {
        if (paused || won) return;
        if (!neighbors(blank).includes(index)) return;
        if (!started) {
            started = true;
            startTimer();
        }
        tiles[blank] = tiles[index];
        tiles[index] = 0;
        blank = index;
        moves += 1;
        render();
        saveDaily();
        if (isSolved(tiles)) finish();
        else if (!puzzleRevealed) setStatus('');
    }

    function applyLevel(nextLevel) {
        level = SIZES[nextLevel] ? nextLevel : 'easy';
        size = SIZES[level];
    }

    function seedRng() {
        const seed = gameMode === 'daily'
            ? window.PuzzleUtil.hashString(`${playDate}:${level}:sliding`)
            : (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0));
        rng = window.PuzzleUtil.mulberry32(seed);
    }

    function freshBoard() {
        seedRng();
        scramble();
        started = false;
        won = false;
        paused = false;
        puzzleRevealed = false;
        secondsElapsed = 0;
        moves = 0;
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
        if (!saved || !saved.started || !Array.isArray(saved.tiles)) {
            freshBoard();
            showBoard();
            return;
        }
        size = saved.size || size;
        tiles = saved.tiles.slice();
        blank = indexOfBlank(tiles);
        started = true;
        secondsElapsed = saved.seconds || 0;
        moves = saved.moves || 0;
        won = saved.status === 'completed';
        paused = saved.status === 'in-progress';
        puzzleRevealed = !!(saved.revealed);
        showBoard();
    }

    window.Sliding = {
        bind() {
            pauseButton.addEventListener('click', () => {
                if (won) return;
                setPaused(!paused);
            });
            boardEl.addEventListener('pointermove', onPointerMove);
            boardEl.addEventListener('pointerup', onPointerUp);
            boardEl.addEventListener('pointercancel', () => {
                if (!drag) return;
                drag.cell.classList.remove('sliding-drag');
                drag.cell.style.transform = '';
                drag = null;
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
