(function () {
    const PUZZLE_ID = 'sliding';
    const SIZES = { easy: 3, medium: 4, hard: 5 };

    const boardEl = document.getElementById('sliding-board');
    const statusEl = document.getElementById('sliding-status');
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

    function setStatus(text) {
        statusEl.textContent = text;
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
            size,
            tiles: tiles.slice()
        });
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
            cell.addEventListener('click', () => slide(index));
            boardEl.appendChild(cell);
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
        setStatus(window.Store.hideTimers()
            ? 'Solved.'
            : `Solved in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`);
        window.App.showVictory({
            title: 'Puzzle solved',
            seconds: secondsElapsed,
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
        render();
        saveDaily();
        if (isSolved(tiles)) finish();
        else setStatus('');
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
        setStatus('Slide tiles into order.');
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
        won = saved.status === 'completed';
        paused = saved.status === 'in-progress';
        showBoard();
    }

    window.Sliding = {
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
        setPaused,
        isPaused: () => paused,
        onKeyDown() {}
    };
})();
