window.App = (function () {
    const screens = {
        home: document.getElementById('screen-home'),
        profile: document.getElementById('screen-profile'),
        shop: document.getElementById('screen-shop'),
        play: document.getElementById('screen-play')
    };

    let currentPuzzle = null;

    function showScreen(name) {
        Object.entries(screens).forEach(([key, node]) => {
            node.hidden = key !== name;
        });
    }

    function closePopouts() {
        document.getElementById('home-settings').hidden = true;
        document.getElementById('play-menu').hidden = true;
        document.getElementById('btn-home-settings').setAttribute('aria-expanded', 'false');
        document.getElementById('btn-menu').setAttribute('aria-expanded', 'false');
    }

    function themeOptions() {
        const builtIn = [
            { value: 'light', label: 'Default', locked: false },
            { value: 'dark', label: 'Dark', locked: false }
        ];
        const shopThemes = window.Shop.ITEMS.filter((item) => item.kind === 'theme').map((item) => {
            const locked = !window.Store.hasUnlock(item.id);
            const name = item.name.replace(/ theme$/i, '');
            return {
                value: item.value,
                label: locked ? `${name} (locked)` : name,
                locked
            };
        });
        return builtIn.concat(shopThemes);
    }

    function resolvedTheme() {
        const saved = window.Store.getTheme();
        const match = themeOptions().find((option) => option.value === saved && !option.locked);
        return match ? match.value : 'light';
    }

    function fillThemeSelect(select, theme) {
        select.innerHTML = '';
        themeOptions().forEach((option) => {
            const node = document.createElement('option');
            node.value = option.value;
            node.textContent = option.label;
            node.disabled = option.locked;
            select.appendChild(node);
        });
        select.value = theme;
        if (select.value !== theme) select.value = 'light';
    }

    function applyAppearance() {
        const theme = resolvedTheme();
        if (window.Store.getTheme() !== theme) window.Store.setTheme(theme);
        if (window.Store.getEquip().theme !== theme) window.Store.setEquip({ theme });
        const equip = window.Store.getEquip();
        if (theme === 'light') document.body.removeAttribute('data-theme');
        else document.body.setAttribute('data-theme', theme);
        const bgItem = window.Shop.ITEMS.find(
            (item) => item.kind === 'background' && item.value === equip.background
        );
        const useBg = bgItem && equip.background && equip.background !== 'none'
            && window.Store.hasUnlock(bgItem.id);
        if (useBg) document.body.setAttribute('data-bg', equip.background);
        else document.body.removeAttribute('data-bg');
        const cards = equip.cards || 'classic';
        const cardsItem = window.Shop.ITEMS.find(
            (item) => item.kind === 'cards' && item.value === cards
        );
        const cardsOk = cards === 'classic' || (cardsItem && (
            cardsItem.free === true || window.Store.hasUnlock(cardsItem.id)
        ));
        document.body.setAttribute('data-cards', cardsOk ? cards : 'classic');
        document.body.setAttribute('data-hide-timer', String(window.Store.hideTimers()));
        fillThemeSelect(document.getElementById('theme-home'), theme);
        fillThemeSelect(document.getElementById('theme-play'), theme);
        document.getElementById('hide-timer').checked = window.Store.hideTimers();
    }

    function chooseTheme(value) {
        const option = themeOptions().find((item) => item.value === value);
        if (!option || option.locked) {
            applyAppearance();
            return;
        }
        window.Store.setTheme(option.value);
        window.Store.setEquip({ theme: option.value });
        applyAppearance();
    }

    function refreshChrome() {
        document.getElementById('trophy-chip').textContent = String(window.Store.getTrophies());
        window.Profile.renderAvatars();
        renderCards();
    }

    function flipCard(id, open) {
        document.querySelectorAll('.flip-card').forEach((card) => {
            const shouldOpen = open && card.dataset.puzzle === id;
            card.classList.toggle('flipped', shouldOpen);
        });
        document.getElementById('card-scrim').hidden = !open;
        if (open) fillCardBack(id);
    }

    function fillCardBack(id) {
        const puzzle = window.PuzzleUtil.get(id);
        const card = document.querySelector(`.flip-card[data-puzzle="${id}"]`);
        if (!puzzle || !card) return;
        card.querySelector('.daily-title').textContent = window.PuzzleUtil.dailyTitle();
        const row = card.querySelector('.daily-row');
        row.innerHTML = '';
        const date = window.PuzzleUtil.localDateKey();
        const levels = puzzle.difficulties.length ? puzzle.difficulties : ['default'];
        levels.forEach((level) => {
            const record = window.Store.getDaily(id, date, level);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'choice';
            if (record && record.status === 'completed') button.classList.add('completed');
            const name = document.createElement('span');
            name.textContent = level === 'default' ? 'Daily' : window.PuzzleUtil.difficultyLabel(level);
            const state = document.createElement('small');
            state.className = record && !window.Store.hideTimers() ? 'time-label' : '';
            state.textContent = window.PuzzleUtil.dailyStateText(record);
            button.append(name, state);
            button.addEventListener('click', () => startPuzzle(id, 'daily', level === 'default' ? null : level));
            row.appendChild(button);
        });
        renderBestLine(card, puzzle);
    }

    function renderBestLine(card, puzzle) {
        let line = card.querySelector('.best-line');
        if (puzzle.id !== 'sudoku') {
            if (line) line.remove();
            return;
        }
        if (!line) {
            line = document.createElement('p');
            line.className = 'best-line';
            card.querySelector('.new-game-select').insertAdjacentElement('beforebegin', line);
        }
        const bests = window.Store.getBests(puzzle.id);
        const hasAny = puzzle.difficulties.some((level) => bests[level] != null);
        if (!hasAny || window.Store.hideTimers()) {
            line.hidden = true;
            line.textContent = '';
            return;
        }
        const text = puzzle.difficulties.map((level) => {
            const time = bests[level];
            const label = window.PuzzleUtil.difficultyLabel(level);
            return `${label} ${time == null ? '—' : window.PuzzleUtil.formatTime(time)}`;
        }).join(' · ');
        line.hidden = false;
        line.textContent = `Best · ${text}`;
    }

    function startPuzzle(id, mode, level) {
        if (id === 'sudoku') {
            if (mode === 'daily') window.Sudoku.startDaily(level);
            else window.Sudoku.startFree(level);
            return;
        }
        if (id === 'wordle') {
            if (mode === 'daily') window.Wordle.startDaily();
            else window.Wordle.startFree();
            return;
        }
        if (id === 'minesweeper') {
            if (mode === 'daily') window.Mines.startDaily(level);
            else window.Mines.startFree(level);
            return;
        }
        if (id === '2048') {
            if (mode === 'daily') window.Game2048.startDaily();
            else window.Game2048.startFree();
            return;
        }
        if (id === 'hangman') {
            if (mode === 'daily') window.Hangman.startDaily();
            else window.Hangman.startFree();
            return;
        }
        if (id === 'lightsout') {
            if (mode === 'daily') window.LightsOut.startDaily(level);
            else window.LightsOut.startFree(level);
            return;
        }
        if (id === 'solitaire') {
            if (mode === 'daily') window.Solitaire.startDaily();
            else window.Solitaire.startFree();
            return;
        }
        if (id === 'sliding') {
            if (mode === 'daily') window.Sliding.startDaily(level);
            else window.Sliding.startFree(level);
            return;
        }
        if (id === 'memory') {
            if (mode === 'daily') window.Memory.startDaily(level);
            else window.Memory.startFree(level);
            return;
        }
        const label = mode === 'daily'
            ? (level ? `Daily · ${window.PuzzleUtil.difficultyLabel(level)}` : 'Daily')
            : (level ? `New game · ${window.PuzzleUtil.difficultyLabel(level)}` : 'New game');
        window.Placeholders.open(id, label);
    }

    function renderCards() {
        const grid = document.getElementById('puzzle-grid');
        const openId = [...document.querySelectorAll('.flip-card.flipped')].map((card) => card.dataset.puzzle)[0];
        grid.innerHTML = '';
        window.Puzzles.forEach((puzzle) => {
            const card = document.createElement('article');
            card.className = 'flip-card';
            card.dataset.puzzle = puzzle.id;
            if (openId === puzzle.id) card.classList.add('flipped');
            card.innerHTML = `
                <div class="flip-inner">
                    <button type="button" class="card-front">
                        <span class="card-title">${puzzle.name}</span>
                        <span class="card-copy">${puzzle.description}</span>
                    </button>
                    <div class="card-back">
                        <div class="card-back-head">
                            <button type="button" class="text-btn btn-unflip">Back</button>
                            <h2 class="daily-title"></h2>
                        </div>
                        <div class="daily-row"></div>
                    </div>
                </div>
            `;
            const back = card.querySelector('.card-back');
            if (puzzle.difficulties.length) {
                const select = document.createElement('select');
                select.className = 'new-game-select';
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'New game';
                select.appendChild(placeholder);
                puzzle.difficulties.forEach((level) => {
                    const option = document.createElement('option');
                    option.value = level;
                    option.textContent = window.PuzzleUtil.difficultyLabel(level);
                    select.appendChild(option);
                });
                select.addEventListener('change', () => {
                    const value = select.value;
                    select.value = '';
                    if (!value) return;
                    window.Sudoku.askConfirm('Start a new game?', 'Start').then((accepted) => {
                        if (!accepted) return;
                        startPuzzle(puzzle.id, 'free', value);
                    });
                });
                back.appendChild(select);
            } else {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn btn-primary new-game-btn';
                button.textContent = 'New game';
                button.addEventListener('click', () => {
                    window.Sudoku.askConfirm('Start a new game?', 'Start').then((accepted) => {
                        if (!accepted) return;
                        startPuzzle(puzzle.id, 'free', null);
                    });
                });
                back.appendChild(button);
            }
            card.querySelector('.card-front').addEventListener('click', () => flipCard(puzzle.id, true));
            card.querySelector('.btn-unflip').addEventListener('click', () => flipCard(puzzle.id, false));
            grid.appendChild(card);
            if (openId === puzzle.id) fillCardBack(puzzle.id);
        });
        document.getElementById('card-scrim').hidden = !openId;
    }

    function showHome(flipId) {
        currentPuzzle = null;
        showScreen('home');
        refreshChrome();
        if (flipId) flipCard(flipId, true);
    }

    function showPlay(puzzleId) {
        currentPuzzle = puzzleId;
        showScreen('play');
    }

    function leavePlay() {
        if (currentPuzzle === 'sudoku') window.Sudoku.leave();
        else if (currentPuzzle === 'wordle') window.Wordle.leave();
        else if (currentPuzzle === 'minesweeper') window.Mines.leave();
        else if (currentPuzzle === '2048') window.Game2048.leave();
        else if (currentPuzzle === 'hangman') window.Hangman.leave();
        else if (currentPuzzle === 'lightsout') window.LightsOut.leave();
        else if (currentPuzzle === 'solitaire') window.Solitaire.leave();
        else if (currentPuzzle === 'sliding') window.Sliding.leave();
        else if (currentPuzzle === 'memory') window.Memory.leave();
        else showHome(currentPuzzle);
    }

    let victoryNext = null;

    function preparePlay(puzzleId) {
        document.getElementById('sudoku-play').hidden = puzzleId !== 'sudoku';
        document.getElementById('wordle-play').hidden = puzzleId !== 'wordle';
        document.getElementById('minesweeper-play').hidden = puzzleId !== 'minesweeper';
        document.getElementById('game2048-play').hidden = puzzleId !== '2048';
        document.getElementById('hangman-play').hidden = puzzleId !== 'hangman';
        document.getElementById('lightsout-play').hidden = puzzleId !== 'lightsout';
        document.getElementById('solitaire-play').hidden = puzzleId !== 'solitaire';
        document.getElementById('sliding-play').hidden = puzzleId !== 'sliding';
        document.getElementById('memory-play').hidden = puzzleId !== 'memory';
        document.getElementById('coming-soon').hidden = true;
        document.getElementById('play-menu-wrap').hidden = false;
        document.querySelectorAll('[data-sudoku-only]').forEach((node) => {
            node.hidden = puzzleId !== 'sudoku';
        });
        document.getElementById('victory-modal').hidden = true;
        showPlay(puzzleId);
    }

    function showVictory(options) {
        document.getElementById('victory-title').textContent = options.title || 'Puzzle solved';
        document.getElementById('win-time').textContent = window.PuzzleUtil.formatTime(options.seconds || 0);
        document.getElementById('win-trophy').textContent = options.trophy || '';
        document.getElementById('btn-play-again').textContent = options.again || 'Play again';
        victoryNext = options.onAgain || null;
        closePopouts();
        document.getElementById('victory-modal').hidden = false;
        refreshChrome();
    }

    function togglePopout(popout, button) {
        const willOpen = popout.hidden;
        closePopouts();
        popout.hidden = !willOpen;
        button.setAttribute('aria-expanded', String(willOpen));
    }

    function bind() {
        document.getElementById('btn-profile').addEventListener('click', () => {
            showScreen('profile');
            window.Profile.refresh();
        });
        document.getElementById('btn-shop').addEventListener('click', () => {
            showScreen('shop');
            window.Shop.refresh();
        });
        document.querySelectorAll('[data-back-home]').forEach((button) => {
            button.addEventListener('click', () => showHome());
        });
        document.getElementById('btn-play-back').addEventListener('click', leavePlay);
        document.getElementById('btn-play-again').addEventListener('click', () => {
            document.getElementById('victory-modal').hidden = true;
            const next = victoryNext;
            victoryNext = null;
            if (next) next();
        });
        document.getElementById('btn-home-settings').addEventListener('click', (event) => {
            event.stopPropagation();
            togglePopout(document.getElementById('home-settings'), event.currentTarget);
        });
        document.getElementById('btn-menu').addEventListener('click', (event) => {
            event.stopPropagation();
            togglePopout(document.getElementById('play-menu'), event.currentTarget);
        });
        document.getElementById('home-settings').addEventListener('click', (event) => event.stopPropagation());
        document.getElementById('play-menu').addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('click', closePopouts);
        document.getElementById('card-scrim').addEventListener('click', () => flipCard(null, false));
        document.getElementById('theme-home').addEventListener('change', (event) => {
            chooseTheme(event.target.value);
        });
        document.getElementById('theme-play').addEventListener('change', (event) => {
            chooseTheme(event.target.value);
        });
        document.getElementById('hide-timer').addEventListener('change', () => {
            window.Store.setHideTimers(document.getElementById('hide-timer').checked);
            applyAppearance();
            renderCards();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closePopouts();
                if (!screens.home.hidden) flipCard(null, false);
            }
            if (screens.play.hidden) return;
            if (currentPuzzle === 'sudoku') window.Sudoku.onKeyDown(event);
            else if (currentPuzzle === 'wordle') window.Wordle.onKeyDown(event);
            else if (currentPuzzle === '2048') window.Game2048.onKeyDown(event);
            else if (currentPuzzle === 'hangman') window.Hangman.onKeyDown(event);
        });
    }

    return {
        applyAppearance,
        refreshChrome,
        closePopouts,
        showHome,
        showPlay,
        preparePlay,
        showVictory,
        renderCards,
        bind
    };
})();

window.Profile.bind();
window.Shop.bind();
window.Sudoku.bind();
window.Wordle.bind();
window.Mines.bind();
window.Game2048.bind();
window.Hangman.bind();
window.LightsOut.bind();
window.Solitaire.bind();
window.Sliding.bind();
window.Memory.bind();
window.App.bind();
window.App.applyAppearance();
window.Store.clearSession();
window.App.showHome();
