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

    function applyAppearance() {
        const equip = window.Store.getEquip();
        const theme = window.Store.hasUnlock('sunset-theme') && equip.theme === 'sunset'
            ? 'sunset'
            : (window.Store.getTheme() === 'dark' ? 'dark' : 'light');
        if (theme === 'light') document.body.removeAttribute('data-theme');
        else document.body.setAttribute('data-theme', theme);
        window.Store.setTheme(theme);
        const useGrid = window.Store.hasUnlock('grid-paper') && equip.background === 'grid-paper';
        if (useGrid) document.body.setAttribute('data-bg', 'grid-paper');
        else document.body.removeAttribute('data-bg');
        document.body.setAttribute('data-hide-timer', String(window.Store.hideTimers()));
        document.getElementById('theme-home').checked = theme === 'dark';
        document.getElementById('theme-play').checked = theme === 'dark';
        document.getElementById('hide-timer').checked = window.Store.hideTimers();
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
            name.textContent = level === 'default' ? 'Play' : window.PuzzleUtil.difficultyLabel(level);
            const state = document.createElement('small');
            state.className = record && !window.Store.hideTimers() ? 'time-label' : '';
            state.textContent = window.PuzzleUtil.dailyStateText(record);
            button.append(name, state);
            button.addEventListener('click', () => startPuzzle(id, 'daily', level === 'default' ? null : level));
            row.appendChild(button);
        });
    }

    function startPuzzle(id, mode, level) {
        if (id === 'sudoku') {
            if (mode === 'daily') window.Sudoku.startDaily(level);
            else window.Sudoku.startFree(level);
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
                        <select class="new-game-select">
                            <option value="">New game</option>
                        </select>
                    </div>
                </div>
            `;
            const select = card.querySelector('.new-game-select');
            if (puzzle.difficulties.length) {
                puzzle.difficulties.forEach((level) => {
                    const option = document.createElement('option');
                    option.value = level;
                    option.textContent = window.PuzzleUtil.difficultyLabel(level);
                    select.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = 'play';
                option.textContent = 'New game';
                select.appendChild(option);
            }
            card.querySelector('.card-front').addEventListener('click', () => flipCard(puzzle.id, true));
            card.querySelector('.btn-unflip').addEventListener('click', () => flipCard(puzzle.id, false));
            select.addEventListener('change', () => {
                const value = select.value;
                select.value = '';
                if (!value) return;
                startPuzzle(puzzle.id, 'free', value === 'play' ? null : value);
            });
            grid.appendChild(card);
            if (openId === puzzle.id) fillCardBack(puzzle.id);
        });
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
        if (currentPuzzle === 'sudoku') {
            window.Sudoku.leave();
            return;
        }
        const id = currentPuzzle;
        showHome(id);
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
        document.getElementById('theme-home').addEventListener('change', () => {
            window.Store.setTheme(document.getElementById('theme-home').checked ? 'dark' : 'light');
            window.Store.setEquip({ theme: window.Store.getTheme() });
            applyAppearance();
        });
        document.getElementById('theme-play').addEventListener('change', () => {
            window.Store.setTheme(document.getElementById('theme-play').checked ? 'dark' : 'light');
            window.Store.setEquip({ theme: window.Store.getTheme() });
            applyAppearance();
        });
        document.getElementById('hide-timer').addEventListener('change', () => {
            window.Store.setHideTimers(document.getElementById('hide-timer').checked);
            applyAppearance();
            renderCards();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closePopouts();
            if (!screens.play.hidden) window.Sudoku.onKeyDown(event);
        });
    }

    return {
        applyAppearance,
        refreshChrome,
        closePopouts,
        showHome,
        showPlay,
        renderCards,
        bind
    };
})();

window.Profile.bind();
window.Sudoku.bind();
window.App.bind();
window.App.applyAppearance();
window.App.showHome();
