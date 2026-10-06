window.Profile = (function () {
    const SKINS = ['#f3c6a5', '#d8a07a', '#8d5524', '#f8e1c8', '#c68642'];
    const SHIRTS = ['#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#111827'];

    function renderAvatars() {
        const profile = window.Store.getProfile();
        document.querySelectorAll('[data-avatar]').forEach((node) => {
            node.style.setProperty('--skin', profile.skin);
            node.style.setProperty('--shirt', profile.shirt);
            node.dataset.outfit = profile.outfit || 'default';
        });
    }

    function renderSwatches(container, colors, current, onPick) {
        container.innerHTML = '';
        colors.forEach((color) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'swatch' + (color === current ? ' selected' : '');
            button.style.background = color;
            button.addEventListener('click', () => onPick(color));
            container.appendChild(button);
        });
    }

    function refresh() {
        const profile = window.Store.getProfile();
        const nameInput = document.getElementById('profile-name');
        if (nameInput && document.activeElement !== nameInput) nameInput.value = profile.name;
        document.getElementById('profile-trophies').textContent = String(window.Store.getTrophies());
        renderAvatars();
        renderSwatches(document.getElementById('skin-swatches'), SKINS, profile.skin, (skin) => {
            window.Store.setProfile({ skin });
            refresh();
        });
        renderSwatches(document.getElementById('shirt-swatches'), SHIRTS, profile.shirt, (shirt) => {
            window.Store.setProfile({ shirt });
            refresh();
        });

        const stats = window.Store.dailyStats();
        const list = document.getElementById('profile-stats');
        list.innerHTML = '';
        window.Puzzles.forEach((puzzle) => {
            const entry = stats[puzzle.id] || { total: 0, easy: 0, medium: 0, hard: 0 };
            const item = document.createElement('li');
            if (puzzle.difficulties.length) {
                item.textContent = `${puzzle.name}: ${entry.total} dailies  ·  Easy ${entry.easy} · Medium ${entry.medium} · Hard ${entry.hard}`;
            } else {
                item.textContent = `${puzzle.name}: ${entry.total} dailies`;
            }
            const bests = window.Store.getBests(puzzle.id);
            const hasBest = puzzle.difficulties.some((level) => bests[level] != null);
            if (hasBest && !window.Store.hideTimers()) {
                const best = document.createElement('div');
                best.className = 'best-line';
                best.textContent = `Best · ${puzzle.difficulties.map((level) => {
                    const time = bests[level];
                    const label = window.PuzzleUtil.difficultyLabel(level);
                    return `${label} ${time == null ? '—' : window.PuzzleUtil.formatTime(time)}`;
                }).join(' · ')}`;
                item.appendChild(best);
            }
            list.appendChild(item);
        });
    }

    function bind() {
        document.getElementById('profile-name').addEventListener('input', (event) => {
            window.Store.setProfile({ name: event.target.value.trim() || 'Player' });
        });
    }

    return { refresh, renderAvatars, bind };
})();
