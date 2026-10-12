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
    let openItemId = null;

    function isOwned(item) {
        return item.free === true || window.Store.hasUnlock(item.id);
    }

    function costLabel(item) {
        if (item.free || item.cost === 0) return 'Free';
        return `${item.cost} ${item.cost === 1 ? 'trophy' : 'trophies'}`;
    }

    function makePreview(item, detailed) {
        const preview = document.createElement('div');
        preview.className = `shop-preview shop-preview-${item.kind}`;
        if (detailed) preview.classList.add('shop-preview-detailed');
        preview.dataset.value = item.value;
        if (item.kind === 'outfit') {
            const avatar = document.createElement('span');
            avatar.className = detailed ? 'avatar avatar-lg' : 'avatar avatar-sm';
            avatar.dataset.outfit = item.value;
            const profile = window.Store.getProfile();
            avatar.style.setProperty('--skin', profile.skin);
            avatar.style.setProperty('--shirt', profile.shirt);
            avatar.dataset.face = profile.face || 'happy';
            window.Profile.ensureFaceLayer(avatar);
            preview.appendChild(avatar);
        }
        if (item.kind === 'cards') {
            const hand = document.createElement('div');
            hand.className = detailed ? 'shop-card-hand shop-card-hand-fan' : 'shop-card-hand';
            hand.setAttribute('aria-hidden', 'true');
            const count = detailed ? 3 : 1;
            for (let i = 0; i < count; i++) {
                const face = document.createElement('span');
                face.className = 'shop-card-face';
                hand.appendChild(face);
            }
            preview.appendChild(hand);
        }
        return preview;
    }

    function flipShopItem(id, open) {
        openItemId = open ? id : null;
        document.querySelectorAll('.shop-card.flip-card').forEach((card) => {
            const shouldOpen = open && card.dataset.shopItem === id;
            card.classList.toggle('flipped', shouldOpen);
        });
        const scrim = document.getElementById('shop-scrim');
        if (scrim) scrim.hidden = !open;
    }

    function closeFlip() {
        flipShopItem(null, false);
    }

    function completePurchase(item) {
        if (isOwned(item)) return;
        if (window.Store.getTrophies() < item.cost) return;
        window.Store.addTrophies(-item.cost);
        window.Store.addUnlock(item.id);
        window.App.refreshChrome();
        closeFlip();
        refresh();
    }

    function requestPurchase(item) {
        if (isOwned(item)) return;
        if (window.Store.getTrophies() < item.cost) return;
        const trophies = item.cost === 1 ? 'trophy' : 'trophies';
        window.App.askConfirm(
            `Buy ${item.name} for ${item.cost} ${trophies}?`,
            'Confirm'
        ).then((accepted) => {
            if (accepted) completePurchase(item);
        });
    }

    function makeCard(item) {
        const owned = isOwned(item);
        const canAfford = window.Store.getTrophies() >= item.cost;
        const card = document.createElement('article');
        card.className = `shop-card flip-card shop-kind-${item.kind}`;
        card.dataset.kind = item.kind;
        card.dataset.value = item.value;
        card.dataset.shopItem = item.id;

        const inner = document.createElement('div');
        inner.className = 'flip-inner';

        const front = document.createElement('div');
        front.className = 'shop-card-front';
        front.appendChild(makePreview(item));

        const body = document.createElement('div');
        body.className = 'shop-card-body';
        const title = document.createElement('h2');
        title.textContent = item.name;
        const cost = document.createElement('p');
        cost.className = 'shop-cost';
        cost.textContent = costLabel(item);
        const action = document.createElement('button');
        action.type = 'button';
        if (owned) {
            action.className = 'btn';
            action.textContent = 'Purchased';
            action.disabled = true;
        } else {
            action.className = 'btn btn-primary';
            action.textContent = 'Buy';
            action.disabled = !canAfford;
            action.addEventListener('click', () => flipShopItem(item.id, true));
        }
        body.append(title, cost, action);
        front.appendChild(body);

        const back = document.createElement('div');
        back.className = 'card-back shop-card-back';
        const head = document.createElement('div');
        head.className = 'card-back-head';
        const unflip = document.createElement('button');
        unflip.type = 'button';
        unflip.className = 'text-btn btn-unflip';
        unflip.textContent = 'Back';
        unflip.addEventListener('click', () => flipShopItem(item.id, false));
        const backTitle = document.createElement('h2');
        backTitle.textContent = item.name;
        head.append(unflip, backTitle);

        const backPreview = makePreview(item, true);
        const desc = document.createElement('p');
        desc.className = 'shop-desc';
        desc.textContent = item.description;

        const buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        if (owned) {
            buyBtn.className = 'btn';
            buyBtn.textContent = 'Purchased';
            buyBtn.disabled = true;
        } else {
            buyBtn.className = 'btn btn-primary';
            buyBtn.textContent = `Buy for ${costLabel(item)}`;
            buyBtn.disabled = !canAfford;
            buyBtn.addEventListener('click', () => requestPurchase(item));
        }

        back.append(head, backPreview, desc, buyBtn);
        inner.append(front, back);
        card.appendChild(inner);
        return card;
    }

    function refresh() {
        const trophiesEl = document.getElementById('shop-trophies');
        if (trophiesEl) trophiesEl.textContent = String(window.Store.getTrophies());
        const inventoryToggle = document.getElementById('shop-inventory-only');
        if (inventoryToggle) inventoryToggle.checked = inventoryOnly;

        const list = document.getElementById('shop-list');
        if (!list) return;
        const keepOpen = openItemId;
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

        if (keepOpen && ITEMS.some((item) => item.id === keepOpen && isOwned(item) === false)) {
            flipShopItem(keepOpen, true);
        } else {
            closeFlip();
        }
    }

    function bind() {
        const toggle = document.getElementById('shop-inventory-only');
        if (toggle && !toggle.dataset.bound) {
            toggle.dataset.bound = '1';
            toggle.addEventListener('change', () => {
                inventoryOnly = toggle.checked;
                refresh();
            });
        }
        const scrim = document.getElementById('shop-scrim');
        if (scrim && !scrim.dataset.bound) {
            scrim.dataset.bound = '1';
            scrim.addEventListener('click', () => closeFlip());
        }
    }

    return {
        ITEMS,
        KIND_ORDER,
        KIND_LABELS,
        isOwned,
        makePreview,
        refresh,
        bind,
        closeFlip
    };
})();
