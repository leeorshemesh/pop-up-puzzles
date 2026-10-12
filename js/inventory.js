window.Inventory = (function () {
    const BUILTINS = [
        {
            id: 'theme-light',
            name: 'Default theme',
            description: 'Clean light panels for everyday play.',
            kind: 'theme',
            value: 'light',
            builtin: true
        },
        {
            id: 'theme-dark',
            name: 'Dark theme',
            description: 'Dim panels with soft contrast.',
            kind: 'theme',
            value: 'dark',
            builtin: true
        },
        {
            id: 'bg-none',
            name: 'No background',
            description: 'Plain background with no pattern.',
            kind: 'background',
            value: 'none',
            builtin: true
        },
        {
            id: 'outfit-default',
            name: 'Default outfit',
            description: 'Your avatar with no extra outfit.',
            kind: 'outfit',
            value: 'default',
            builtin: true
        }
    ];

    function inventoryItems() {
        const ownedShop = window.Shop.ITEMS.filter((item) => window.Shop.isOwned(item));
        return BUILTINS.concat(ownedShop);
    }

    function isEquipped(item) {
        const equip = window.Store.getEquip();
        if (item.kind === 'theme') return equip.theme === item.value;
        if (item.kind === 'background') return (equip.background || 'none') === item.value;
        if (item.kind === 'cards') return (equip.cards || 'classic') === item.value;
        return window.Store.getProfile().outfit === item.value;
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

    function makeCard(item) {
        const equipped = isEquipped(item);
        const card = document.createElement('article');
        card.className = `inventory-card shop-card shop-kind-${item.kind}`;
        card.dataset.kind = item.kind;
        card.dataset.value = item.value;

        const front = document.createElement('div');
        front.className = 'shop-card-front';
        front.appendChild(window.Shop.makePreview(item));

        const body = document.createElement('div');
        body.className = 'shop-card-body';
        const title = document.createElement('h2');
        title.textContent = item.name;
        const copy = document.createElement('p');
        copy.textContent = item.description;
        const action = document.createElement('button');
        action.type = 'button';
        if (equipped) {
            action.className = 'btn';
            action.textContent = 'Equipped';
            action.disabled = true;
        } else {
            action.className = 'btn btn-primary';
            action.textContent = 'Equip';
            action.addEventListener('click', () => equip(item));
        }
        body.append(title, copy, action);
        front.appendChild(body);
        card.appendChild(front);
        return card;
    }

    function refresh() {
        const list = document.getElementById('inventory-list');
        if (!list) return;
        list.innerHTML = '';
        const items = inventoryItems();

        window.Shop.KIND_ORDER.forEach((kind) => {
            const kindItems = items.filter((item) => item.kind === kind);
            if (!kindItems.length) return;
            const section = document.createElement('section');
            section.className = 'shop-section';
            const heading = document.createElement('h2');
            heading.className = 'shop-section-title';
            heading.textContent = window.Shop.KIND_LABELS[kind];
            const grid = document.createElement('div');
            grid.className = 'shop-grid';
            kindItems.forEach((item) => grid.appendChild(makeCard(item)));
            section.append(heading, grid);
            list.appendChild(section);
        });
    }

    function bind() {}

    return { refresh, bind };
})();
