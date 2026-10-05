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
            id: 'grid-paper',
            name: 'Grid paper',
            description: 'A notebook background behind the puzzles.',
            cost: 5,
            kind: 'background',
            value: 'grid-paper'
        },
        {
            id: 'star-outfit',
            name: 'Star shirt',
            description: 'A gold star for your avatar.',
            cost: 8,
            kind: 'outfit',
            value: 'star'
        }
    ];

    function equippedValue(item) {
        const equip = window.Store.getEquip();
        if (item.kind === 'theme') return equip.theme === item.value;
        if (item.kind === 'background') return equip.background === item.value;
        return window.Store.getProfile().outfit === item.value;
    }

    function buy(item) {
        if (window.Store.hasUnlock(item.id)) return;
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
        }
        window.App.applyAppearance();
        window.App.refreshChrome();
        refresh();
    }

    function refresh() {
        document.getElementById('shop-trophies').textContent = String(window.Store.getTrophies());
        const list = document.getElementById('shop-list');
        list.innerHTML = '';
        ITEMS.forEach((item) => {
            const owned = window.Store.hasUnlock(item.id);
            const card = document.createElement('article');
            card.className = 'shop-card';
            const title = document.createElement('h2');
            title.textContent = item.name;
            const copy = document.createElement('p');
            copy.textContent = `${item.description} · ${item.cost} trophies`;
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
            card.append(title, copy, action);
            list.appendChild(card);
        });
    }

    return { ITEMS, refresh };
})();
