window.Profile = (function () {
    const SKINS = ['#f3c6a5', '#d8a07a', '#8d5524', '#f8e1c8', '#c68642'];
    const SHIRTS = ['#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#111827'];
    const FACES = [
        { id: 'happy', label: 'Happy' },
        { id: 'sad', label: 'Sad' },
        { id: 'mad', label: 'Mad' },
        { id: 'grin', label: 'Grin' }
    ];

    let draft = null;
    let dirty = false;
    const openGames = new Set();

    function ensureFaceLayer(node) {
        let face = node.querySelector('.avatar-face');
        if (!face) {
            face = document.createElement('span');
            face.className = 'avatar-face';
            face.setAttribute('aria-hidden', 'true');
            node.appendChild(face);
        }
        if (!face.querySelector('.avatar-eyes')) {
            face.innerHTML = '';
            ['avatar-eyes', 'avatar-brows', 'avatar-mouth'].forEach((cls) => {
                const part = document.createElement('span');
                part.className = cls;
                face.appendChild(part);
            });
        }
        return face;
    }

    function applyAvatar(node, profile) {
        node.style.setProperty('--skin', profile.skin);
        node.style.setProperty('--shirt', profile.shirt);
        node.dataset.outfit = profile.outfit || 'default';
        node.dataset.face = profile.face || 'happy';
        ensureFaceLayer(node);
    }

    function renderAvatars() {
        const profile = window.Store.getProfile();
        document.querySelectorAll('[data-avatar]').forEach((node) => applyAvatar(node, profile));
    }

    function renderEditPreview() {
        if (!draft) return;
        document.querySelectorAll('[data-edit-avatar]').forEach((node) => applyAvatar(node, draft));
    }

    function updateSaveButton() {
        const button = document.getElementById('btn-save-profile');
        if (!button) return;
        button.disabled = !dirty;
        button.classList.toggle('btn-primary', dirty);
    }

    function profilesEqual(a, b) {
        return a.name === b.name
            && a.skin === b.skin
            && a.shirt === b.shirt
            && (a.face || 'happy') === (b.face || 'happy')
            && (a.outfit || 'default') === (b.outfit || 'default');
    }

    function syncDirtyFromDraft() {
        const saved = window.Store.getProfile();
        dirty = !profilesEqual(draft, saved);
        updateSaveButton();
    }

    function updateDraft(patch) {
        draft = { ...draft, ...patch };
        if (patch.name != null) {
            draft.name = String(patch.name).trim() || 'Player';
        }
        renderEditPreview();
        syncDirtyFromDraft();
        refreshEditControls();
    }

    function renderSwatches(container, colors, current, onPick) {
        if (!container) return;
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

    function renderFacePicker(container, current) {
        if (!container) return;
        container.innerHTML = '';
        FACES.forEach((face) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'face-option' + (face.id === current ? ' selected' : '');
            button.setAttribute('aria-label', face.label);
            button.title = face.label;
            const preview = document.createElement('span');
            preview.className = 'avatar avatar-face-preview';
            preview.dataset.face = face.id;
            preview.dataset.outfit = 'default';
            preview.style.setProperty('--skin', draft.skin);
            preview.style.setProperty('--shirt', draft.shirt);
            ensureFaceLayer(preview);
            const label = document.createElement('span');
            label.className = 'face-option-label';
            label.textContent = face.label;
            button.append(preview, label);
            button.addEventListener('click', () => updateDraft({ face: face.id }));
            container.appendChild(button);
        });
    }

    function ownedOutfits() {
        const items = [{ id: null, value: 'default', name: 'Default' }];
        window.Shop.ITEMS.filter((item) => item.kind === 'outfit').forEach((item) => {
            if (item.free === true || window.Store.hasUnlock(item.id)) {
                items.push({ id: item.id, value: item.value, name: item.name });
            }
        });
        return items;
    }

    function renderOutfitPicker(container, current) {
        if (!container) return;
        container.innerHTML = '';
        ownedOutfits().forEach((outfit) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'outfit-option' + (outfit.value === current ? ' selected' : '');
            button.setAttribute('aria-label', outfit.name);
            button.title = outfit.name;
            const preview = document.createElement('span');
            preview.className = 'avatar avatar-sm';
            preview.dataset.outfit = outfit.value;
            preview.dataset.face = draft.face || 'happy';
            preview.style.setProperty('--skin', draft.skin);
            preview.style.setProperty('--shirt', draft.shirt);
            ensureFaceLayer(preview);
            const label = document.createElement('span');
            label.className = 'outfit-option-label';
            label.textContent = outfit.name;
            button.append(preview, label);
            button.addEventListener('click', () => updateDraft({ outfit: outfit.value }));
            container.appendChild(button);
        });
    }

    function refreshEditControls() {
        if (!draft) return;
        const nameInput = document.getElementById('profile-name');
        if (nameInput && document.activeElement !== nameInput) nameInput.value = draft.name;
        renderSwatches(document.getElementById('skin-swatches'), SKINS, draft.skin, (skin) => {
            updateDraft({ skin });
        });
        renderSwatches(document.getElementById('shirt-swatches'), SHIRTS, draft.shirt, (shirt) => {
            updateDraft({ shirt });
        });
        renderFacePicker(document.getElementById('face-picker'), draft.face || 'happy');
        renderOutfitPicker(document.getElementById('outfit-picker'), draft.outfit || 'default');
    }

    function refresh() {
        const profile = window.Store.getProfile();
        const nameDisplay = document.getElementById('profile-name-display');
        if (nameDisplay) nameDisplay.textContent = profile.name;
        document.getElementById('profile-trophies').textContent = String(window.Store.getTrophies());
        renderAvatars();

        const stats = window.Store.dailyStats();
        const list = document.getElementById('profile-stats');
        list.innerHTML = '';

        window.Puzzles.forEach((puzzle) => {
            const entry = stats[puzzle.id] || { total: 0, easy: 0, medium: 0, hard: 0 };
            const gameOpen = openGames.has(puzzle.id);
            const item = document.createElement('li');
            item.className = 'stat-game' + (gameOpen ? ' open' : '');

            const gameBtn = document.createElement('button');
            gameBtn.type = 'button';
            gameBtn.className = 'stat-game-toggle';
            gameBtn.setAttribute('aria-expanded', String(gameOpen));
            gameBtn.innerHTML = `<span>${puzzle.name}</span><span class="stats-chevron" aria-hidden="true"></span>`;
            gameBtn.addEventListener('click', () => {
                if (openGames.has(puzzle.id)) openGames.delete(puzzle.id);
                else openGames.add(puzzle.id);
                refresh();
            });
            item.appendChild(gameBtn);

            const body = document.createElement('div');
            body.className = 'stat-game-body';
            body.hidden = !gameOpen;

            const counts = document.createElement('div');
            counts.className = 'stat-row-counts';
            if (puzzle.difficulties.length) {
                counts.textContent = puzzle.difficulties.map((level) => {
                    const label = window.PuzzleUtil.difficultyLabel(level);
                    return `${label} ${entry[level] || 0}`;
                }).join(' · ');
            } else {
                counts.textContent = `${entry.total} dailies`;
            }
            body.appendChild(counts);

            const bests = window.Store.getBests(puzzle.id);
            const levels = puzzle.difficulties.length ? puzzle.difficulties : [];
            const hasBest = levels.some((level) => bests[level] != null);
            if (hasBest && !window.Store.hideTimers()) {
                const best = document.createElement('div');
                best.className = 'best-line';
                best.textContent = levels.map((level) => {
                    const time = bests[level];
                    const label = window.PuzzleUtil.difficultyLabel(level);
                    return `${label} ${time == null ? '—' : window.PuzzleUtil.formatTime(time)}`;
                }).join(' · ');
                body.appendChild(best);
            }

            item.appendChild(body);
            list.appendChild(item);
        });
    }

    function refreshEdit() {
        const profile = window.Store.getProfile();
        draft = {
            name: profile.name,
            skin: profile.skin,
            shirt: profile.shirt,
            face: profile.face || 'happy',
            outfit: profile.outfit || 'default'
        };
        dirty = false;
        updateSaveButton();
        renderEditPreview();
        refreshEditControls();
    }

    function saveEdit() {
        if (!draft || !dirty) return;
        window.Store.setProfile({
            name: draft.name,
            skin: draft.skin,
            shirt: draft.shirt,
            face: draft.face || 'happy',
            outfit: draft.outfit || 'default'
        });
        window.Store.setEquip({ outfit: draft.outfit || 'default' });
        dirty = false;
        updateSaveButton();
        window.App.refreshChrome();
    }

    function leaveEdit() {
        draft = null;
        dirty = false;
        updateSaveButton();
        window.App.showScreen('profile');
        refresh();
    }

    function handleEditBack() {
        if (!dirty) {
            leaveEdit();
            return;
        }
        window.App.askConfirm(
            'Continue without saving your profile changes?',
            'Discard'
        ).then((accepted) => {
            if (accepted) leaveEdit();
        });
    }

    function bind() {
        const nameInput = document.getElementById('profile-name');
        if (nameInput && !nameInput.dataset.bound) {
            nameInput.dataset.bound = '1';
            nameInput.addEventListener('input', (event) => {
                if (!draft) return;
                draft = { ...draft, name: event.target.value.trim() || 'Player' };
                syncDirtyFromDraft();
            });
        }
        const saveBtn = document.getElementById('btn-save-profile');
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = '1';
            saveBtn.addEventListener('click', saveEdit);
        }
        const backBtn = document.getElementById('btn-edit-profile-back');
        if (backBtn && !backBtn.dataset.bound) {
            backBtn.dataset.bound = '1';
            backBtn.addEventListener('click', handleEditBack);
        }
    }

    return { refresh, refreshEdit, renderAvatars, bind, ensureFaceLayer };
})();
