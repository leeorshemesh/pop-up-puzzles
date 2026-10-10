window.Shop = (function () {
    const ITEMS = [
        {
            id: 'sunset-theme',
            name: 'Sunset theme',
            description: 'Warm evening colors for the whole app.',
            cost: 3,
            kind: 'theme',
            value: 'sunset'
        },
        {
            id: 'ocean-theme',
            name: 'Ocean theme',
            description: 'Cool blues like a clear coastal day.',
            cost: 4,
            kind: 'theme',
            value: 'ocean'
        },
        {
            id: 'forest-theme',
            name: 'Forest theme',
            description: 'Deep greens with mossy accents.',
            cost: 5,
            kind: 'theme',
            value: 'forest'
        },
        {
            id: 'midnight-theme',
            name: 'Midnight theme',
            description: 'Near-black panels with soft violet light.',
            cost: 6,
            kind: 'theme',
            value: 'midnight'
        },
        {
            id: 'grid-paper',
            name: 'Grid paper',
            description: 'A notebook background behind the puzzles.',
            cost: 5,
            kind: 'background',
            value: 'grid-paper'
        },
        {
            id: 'dots-bg',
            name: 'Dots',
            description: 'A soft dotted pattern behind the puzzles.',
            cost: 5,
            kind: 'background',
            value: 'dots'
        },
        {
            id: 'soft-waves',
            name: 'Soft waves',
            description: 'Gentle wave lines across the background.',
            cost: 6,
            kind: 'background',
            value: 'soft-waves'
        },
        {
            id: 'corkboard',
            name: 'Corkboard',
            description: 'A warm cork texture behind the puzzles.',
            cost: 7,
            kind: 'background',
            value: 'corkboard'
        },
        {
            id: 'star-outfit',
            name: 'Star shirt',
            description: 'A gold star for your avatar.',
            cost: 8,
            kind: 'outfit',
            value: 'star'
        },
        {
            id: 'stripe-outfit',
            name: 'Stripe shirt',
            description: 'Bold stripes on your avatar shirt.',
            cost: 8,
            kind: 'outfit',
            value: 'stripe'
        },
        {
            id: 'heart-outfit',
            name: 'Heart pin',
            description: 'A small heart pin on your shirt.',
            cost: 9,
            kind: 'outfit',
            value: 'heart'
        },
        {
            id: 'cap-outfit',
            name: 'Cap',
            description: 'A little cap for your avatar.',
            cost: 10,
            kind: 'outfit',
            value: 'cap'
        },
        {
            id: 'cards-classic',
            name: 'Classic cards',
            description: 'Default blue patterned card backs.',
            cost: 0,
            kind: 'cards',
            value: 'classic',
            free: true
        },
        {
            id: 'cards-stars',
            name: 'Star cards',
            description: 'Gold star card backs for Solitaire.',
            cost: 6,
            kind: 'cards',
            value: 'stars'
        },
        {
            id: 'cards-geo',
            name: 'Geometric cards',
            description: 'Bold geometric card backs.',
            cost: 8,
            kind: 'cards',
            value: 'geo'
        }
    ];

    const KIND_ORDER = ['theme', 'background', 'outfit', 'cards'];
    const KIND_LABELS = {
        theme: 'Themes',
        background: 'Backgrounds',
        outfit: 'Outfits',
        cards: 'Cards'
    };

    let inventoryOnly = false;

    function isOwned(item) {
        return item.free === true || window.Store.hasUnlock(item.id);
    }

    function equippedValue(item) {
        const equip = window.Store.getEquip();
        if (item.kind === 'theme') return equip.theme === item.value;
        if (item.kind === 'background') return equip.background === item.value;
        if (item.kind === 'cards') return (equip.cards || 'classic') === item.value;
        return window.Store.getProfile().outfit === item.value;
    }

    function buy(item) {
        if (isOwned(item)) return;
        if (window.Store.getTrophies() < item.cost) return;
        window.Store.addTrophies(-item.cost);
        window.Store.addUnlock(item.id);
        equip(item);
    }

    function equip(item) {
        if (item.kind === 'theme') {
            window.Store.setTheme(item.value);
            window.Store.setEquip({ theme: item.value });
        } else if (item.kind === 'background') {
            window.Store.setEquip({ background: item.value });
        } else if (item.kind === 'outfit') {
            window.Store.setProfile({ outfit: item.value });
            window.Store.setEquip({ outfit: item.value });
        } else if (item.kind === 'cards') {
            window.Store.setEquip({ cards: item.value });
        }
        window.App.applyAppearance();
        window.App.refreshChrome();
        refresh();
    }

    function makePreview(item) {
        const preview = document.createElement('div');
        preview.className = `shop-preview shop-preview-${item.kind}`;
        preview.dataset.value = item.value;
        if (item.kind === 'outfit') {
            const avatar = document.createElement('span');
            avatar.className = 'avatar avatar-sm';
            avatar.dataset.outfit = item.value;
            const profile = window.Store.getProfile();
            avatar.style.setProperty('--skin', profile.skin);
            avatar.style.setProperty('--shirt', profile.shirt);
            preview.appendChild(avatar);
        }
        return preview;
    }

    function makeCard(item) {
        const owned = isOwned(item);
        const card = document.createElement('article');
        card.className = `shop-card shop-kind-${item.kind}`;
        card.dataset.kind = item.kind;
        card.dataset.value = item.value;

        const preview = makePreview(item);
        const body = document.createElement('div');
        body.className = 'shop-card-body';
        const title = document.createElement('h2');
        title.textContent = item.name;
        const copy = document.createElement('p');
        copy.textContent = item.free ? item.description : `${item.description} · ${item.cost} trophies`;
        const action = document.createElement('button');
        action.type = 'button';
        if (!owned) {
            action.className = 'btn btn-primary';
            action.textContent = `Buy · ${item.cost}`;
            action.disabled = window.Store.getTrophies() < item.cost;
            action.addEventListener('click', () => buy(item));
        } else if (equippedValue(item)) {
            action.className = 'btn';
            action.textContent = 'Equipped';
            action.disabled = true;
        } else {
            action.className = 'btn btn-primary';
            action.textContent = 'Equip';
            action.addEventListener('click', () => equip(item));
        }
        body.append(title, copy, action);
        card.append(preview, body);
        return card;
    }

    function refresh() {
        document.getElementById('shop-trophies').textContent = String(window.Store.getTrophies());
        const inventoryToggle = document.getElementById('shop-inventory-only');
        if (inventoryToggle) inventoryToggle.checked = inventoryOnly;

        const list = document.getElementById('shop-list');
        list.innerHTML = '';

        KIND_ORDER.forEach((kind) => {
            const items = ITEMS.filter((item) => item.kind === kind && (!inventoryOnly || isOwned(item)));
            if (!items.length) return;
            const section = document.createElement('section');
            section.className = 'shop-section';
            const heading = document.createElement('h2');
            heading.className = 'shop-section-title';
            heading.textContent = KIND_LABELS[kind];
            const grid = document.createElement('div');
            grid.className = 'shop-grid';
            items.forEach((item) => grid.appendChild(makeCard(item)));
            section.append(heading, grid);
            list.appendChild(section);
        });
    }

    function bind() {
        const toggle = document.getElementById('shop-inventory-only');
        if (!toggle || toggle.dataset.bound) return;
        toggle.dataset.bound = '1';
        toggle.addEventListener('change', () => {
            inventoryOnly = toggle.checked;
            refresh();
        });
    }

    return { ITEMS, refresh, bind };
})();
