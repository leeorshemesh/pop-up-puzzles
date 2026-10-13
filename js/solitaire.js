(function () {
    const PUZZLE_ID = 'solitaire';
    const SUITS = ['♠', '♥', '♦', '♣'];
    const SUIT_CLASS = { '♠': 'suit-spade', '♥': 'suit-heart', '♦': 'suit-diamond', '♣': 'suit-club' };
    const RED = { '♥': true, '♦': true, '♠': false, '♣': false };
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    const statusEl = document.getElementById('sol-status');
    const timerEl = document.getElementById('sol-timer');
    const boardEl = document.getElementById('sol-board');
    const pauseButton = document.getElementById('btn-sol-pause');
    const pauseOverlay = document.getElementById('sol-pause');

    let stock = [];
    let waste = [];
    let foundations = [[], [], [], []];
    let tableau = [[], [], [], [], [], [], []];
    let selected = null;
    let gameMode = 'daily';
    let playDate = '';
    let secondsElapsed = 0;
    let timerId = null;
    let started = false;
    let won = false;
    let paused = false;
    let drag = null;
    let suppressClick = false;

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function makeDeck() {
        const deck = [];
        SUITS.forEach((suit) => {
            RANKS.forEach((rank, index) => {
                deck.push({ suit, rank, value: index + 1, id: `${rank}${suit}` });
            });
        });
        return deck;
    }

    function shuffle(deck, random) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const swap = deck[i];
            deck[i] = deck[j];
            deck[j] = swap;
        }
        return deck;
    }

    function cloneCard(card) {
        return { suit: card.suit, rank: card.rank, value: card.value, id: card.id, faceUp: !!card.faceUp };
    }

    function clonePile(pile) {
        return pile.map(cloneCard);
    }

    function deal(random) {
        const deck = shuffle(makeDeck(), random);
        tableau = [[], [], [], [], [], [], []];
        foundations = [[], [], [], []];
        waste = [];
        let index = 0;
        for (let col = 0; col < 7; col++) {
            for (let row = 0; row <= col; row++) {
                const card = deck[index++];
                card.faceUp = row === col;
                tableau[col].push(card);
            }
        }
        stock = deck.slice(index).map((card) => {
            card.faceUp = false;
            return card;
        });
    }

    function isRed(card) {
        return RED[card.suit];
    }

    function canStackTableau(moving, target) {
        if (!target) return moving.value === 13;
        return isRed(moving) !== isRed(target) && moving.value === target.value - 1;
    }

    function canStackFoundation(moving, pile) {
        if (!pile.length) return moving.value === 1;
        const top = pile[pile.length - 1];
        return moving.suit === top.suit && moving.value === top.value + 1;
    }

    function clearSelection() {
        selected = null;
    }

    function sameSelection(next) {
        if (!selected || !next) return false;
        return selected.from === next.from
            && selected.index === next.index
            && selected.col === next.col
            && selected.foundation === next.foundation;
    }

    function getSelectedCards() {
        if (!selected) return [];
        if (selected.from === 'waste') return waste.length ? [waste[waste.length - 1]] : [];
        if (selected.from === 'foundation') {
            const pile = foundations[selected.foundation];
            return pile.length ? [pile[pile.length - 1]] : [];
        }
        if (selected.from === 'tableau') return tableau[selected.col].slice(selected.index);
        return [];
    }

    function removeSelected() {
        if (!selected) return [];
        let cards = [];
        if (selected.from === 'waste') {
            cards = [waste.pop()];
        } else if (selected.from === 'foundation') {
            cards = [foundations[selected.foundation].pop()];
        } else if (selected.from === 'tableau') {
            cards = tableau[selected.col].splice(selected.index);
            const pile = tableau[selected.col];
            if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
        }
        clearSelection();
        return cards.filter(Boolean);
    }

    function isWon() {
        return foundations.every((pile) => pile.length === 13);
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
        window.Store.setDaily(PUZZLE_ID, playDate, 'default', {
            status: won ? 'completed' : 'in-progress',
            seconds: secondsElapsed,
            started: true,
            stock: clonePile(stock),
            waste: clonePile(waste),
            foundations: foundations.map(clonePile),
            tableau: tableau.map(clonePile)
        });
    }

    function markStarted() {
        if (started) return;
        started = true;
        startTimer();
    }

    function finish() {
        won = true;
        paused = false;
        clearSelection();
        endDrag(true);
        stopTimer();
        saveDaily();
        render();
        let trophy = '';
        window.Store.recordBest(PUZZLE_ID, 'default', secondsElapsed);
        if (gameMode === 'daily') {
            const award = window.Store.awardIfNeeded(
                PUZZLE_ID,
                playDate,
                'default',
                window.PuzzleUtil.trophyFor(PUZZLE_ID, 'default')
            );
            trophy = award
                ? `+${award} ${award === 1 ? 'trophy' : 'trophies'}`
                : 'Trophies already claimed for this daily.';
        }
        setStatus(window.Store.hideTimers()
            ? 'Cleared.'
            : `Cleared in ${window.PuzzleUtil.formatTime(secondsElapsed)}.`);
        window.App.showVictory({
            title: 'Puzzle solved',
            seconds: secondsElapsed,
            trophy,
            again: gameMode === 'daily' ? 'Back to Solitaire' : 'Play again',
            onAgain: () => {
                if (gameMode === 'daily') window.Solitaire.leave();
                else window.Solitaire.startFree();
            }
        });
    }

    function afterMove() {
        markStarted();
        render();
        saveDaily();
        if (isWon()) finish();
        else setStatus('');
    }

    function drawStock() {
        if (paused || won) return;
        clearSelection();
        markStarted();
        if (stock.length) {
            const card = stock.pop();
            card.faceUp = true;
            waste.push(card);
        } else if (waste.length) {
            stock = waste.reverse().map((card) => {
                card.faceUp = false;
                return card;
            });
            waste = [];
        }
        afterMove();
    }

    function tryMoveToFoundation(foundationIndex) {
        const cards = getSelectedCards();
        if (cards.length !== 1) return false;
        if (!canStackFoundation(cards[0], foundations[foundationIndex])) return false;
        const moved = removeSelected();
        foundations[foundationIndex].push(moved[0]);
        afterMove();
        return true;
    }

    function tryMoveToTableau(col) {
        const cards = getSelectedCards();
        if (!cards.length) return false;
        const target = tableau[col];
        const top = target.length ? target[target.length - 1] : null;
        if (!canStackTableau(cards[0], top)) return false;
        const moved = removeSelected();
        tableau[col].push(...moved);
        afterMove();
        return true;
    }

    function selectOrMove(next) {
        if (paused || won || suppressClick) return;
        if (selected && sameSelection(next)) {
            clearSelection();
            render();
            return;
        }
        if (selected) {
            if (next.from === 'foundation' && tryMoveToFoundation(next.foundation)) return;
            if (next.from === 'tableau' && tryMoveToTableau(next.col)) return;
        }
        selected = next;
        render();
    }

    function fillCardFace(node, card) {
        const corner = document.createElement('span');
        corner.className = 'sol-corner';
        corner.textContent = `${card.rank}${card.suit}`;
        const pip = document.createElement('span');
        pip.className = 'sol-pip';
        pip.textContent = card.suit;
        node.append(corner, pip);
    }

    function cardNode(card, options) {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'sol-card' + (card.faceUp ? ' up' : ' down') + (isRed(card) && card.faceUp ? ' red' : '');
        if (options && options.selected) node.classList.add('selected');
        if (options && options.stackClass) node.classList.add(options.stackClass);
        if (card.faceUp) fillCardFace(node, card);
        node.setAttribute('aria-label', card.faceUp ? `${card.rank} of ${card.suit}` : 'Face down card');
        if (options && options.onClick) node.addEventListener('click', options.onClick);
        if (options && options.onPointerDown) {
            node.addEventListener('pointerdown', options.onPointerDown);
        }
        return node;
    }

    function emptySlot(label, className, onClick) {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'sol-slot' + (className ? ` ${className}` : '');
        node.setAttribute('aria-label', label);
        if (onClick) node.addEventListener('click', onClick);
        return node;
    }

    function endDrag(cancelOnly) {
        if (!drag) return;
        if (drag.ghost && drag.ghost.parentNode) drag.ghost.remove();
        if (drag.pointerId != null) {
            try { boardEl.releasePointerCapture(drag.pointerId); } catch (_) { /* ignore */ }
        }
        drag = null;
        if (!cancelOnly) render();
    }

    function dropTargetAt(x, y) {
        const under = document.elementFromPoint(x, y);
        if (!under) return null;
        const pile = under.closest('[data-drop]');
        if (!pile) return null;
        const type = pile.dataset.drop;
        if (type === 'foundation') return { from: 'foundation', foundation: Number(pile.dataset.index) };
        if (type === 'tableau') return { from: 'tableau', col: Number(pile.dataset.index) };
        return null;
    }

    function beginDrag(event, selection) {
        if (paused || won || event.button !== 0) return;
        selected = selection;
        const cards = getSelectedCards();
        if (!cards.length) return;
        event.preventDefault();
        const origin = event.currentTarget.getBoundingClientRect();
        const ghost = document.createElement('div');
        ghost.className = 'sol-drag-ghost';
        ghost.style.setProperty('--ghost-w', `${origin.width}px`);
        cards.forEach((card, index) => {
            const face = document.createElement('div');
            face.className = 'sol-card up' + (isRed(card) ? ' red' : '');
            face.style.top = `${index * 28}px`;
            fillCardFace(face, card);
            ghost.appendChild(face);
        });
        document.body.appendChild(ghost);
        drag = {
            selection: { ...selection },
            ghost,
            offsetX: event.clientX - origin.left,
            offsetY: event.clientY - origin.top,
            pointerId: event.pointerId,
            moved: false,
            startX: event.clientX,
            startY: event.clientY
        };
        ghost.style.left = `${event.clientX - drag.offsetX}px`;
        ghost.style.top = `${event.clientY - drag.offsetY}px`;
        try { boardEl.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
    }

    function onPointerMove(event) {
        if (!drag) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
        drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
        drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;
    }

    function onPointerUp(event) {
        if (!drag) return;
        const moved = drag.moved;
        selected = drag.selection;
        const target = dropTargetAt(event.clientX, event.clientY);
        endDrag(true);
        if (moved) {
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            let ok = false;
            if (target && target.from === 'foundation') ok = tryMoveToFoundation(target.foundation);
            else if (target && target.from === 'tableau') ok = tryMoveToTableau(target.col);
            if (!ok) {
                clearSelection();
                render();
            }
            return;
        }
        render();
    }

    function render() {
        boardEl.innerHTML = '';

        const top = document.createElement('div');
        top.className = 'sol-top';

        const stockWrap = document.createElement('div');
        stockWrap.className = 'sol-pile';
        if (stock.length) {
            stockWrap.appendChild(cardNode({ faceUp: false, suit: '', rank: '', value: 0, id: 'stock' }, {
                onClick: drawStock
            }));
        } else {
            stockWrap.appendChild(emptySlot(waste.length ? 'Recycle waste' : 'Empty stock', 'stock-hint', drawStock));
        }
        top.appendChild(stockWrap);

        const wasteWrap = document.createElement('div');
        wasteWrap.className = 'sol-pile';
        if (waste.length) {
            const topWaste = waste[waste.length - 1];
            wasteWrap.appendChild(cardNode(topWaste, {
                selected: selected && selected.from === 'waste',
                onClick: () => selectOrMove({ from: 'waste' }),
                onPointerDown: (event) => beginDrag(event, { from: 'waste' })
            }));
        } else {
            wasteWrap.appendChild(emptySlot('Waste pile', 'waste-hint'));
        }
        top.appendChild(wasteWrap);

        const spacer = document.createElement('div');
        spacer.className = 'sol-spacer';
        top.appendChild(spacer);

        foundations.forEach((pile, index) => {
            const wrap = document.createElement('div');
            wrap.className = 'sol-pile';
            wrap.dataset.drop = 'foundation';
            wrap.dataset.index = String(index);
            if (pile.length) {
                const topCard = pile[pile.length - 1];
                wrap.appendChild(cardNode(topCard, {
                    selected: selected && selected.from === 'foundation' && selected.foundation === index,
                    onClick: () => selectOrMove({ from: 'foundation', foundation: index }),
                    onPointerDown: (event) => beginDrag(event, { from: 'foundation', foundation: index })
                }));
            } else {
                wrap.appendChild(emptySlot(`${SUITS[index]} foundation`, SUIT_CLASS[SUITS[index]], () => {
                    if (selected) tryMoveToFoundation(index);
                }));
            }
            top.appendChild(wrap);
        });
        boardEl.appendChild(top);

        const rows = document.createElement('div');
        rows.className = 'sol-tableau';
        tableau.forEach((pile, col) => {
            const wrap = document.createElement('div');
            wrap.className = 'sol-column';
            wrap.dataset.drop = 'tableau';
            wrap.dataset.index = String(col);
            if (!pile.length) {
                wrap.appendChild(emptySlot('Empty column', '', () => {
                    if (selected) tryMoveToTableau(col);
                    else clearSelection();
                    render();
                }));
            } else {
                let faceBase = 0;
                let faceIndex = 0;
                pile.forEach((card, index) => {
                    const isSelected = selected
                        && selected.from === 'tableau'
                        && selected.col === col
                        && index >= selected.index;
                    const stackClass = card.faceUp ? 'face-up-stack' : 'face-down-stack';
                    const node = cardNode(card, {
                        selected: isSelected,
                        stackClass,
                        onClick: () => {
                            if (!card.faceUp) return;
                            if (selected && !(selected.from === 'tableau' && selected.col === col && selected.index === index)) {
                                if (selected.from === 'tableau' && selected.col !== col && tryMoveToTableau(col)) return;
                                if (selected.from !== 'tableau' && tryMoveToTableau(col)) return;
                            }
                            selectOrMove({ from: 'tableau', col, index });
                        },
                        onPointerDown: (event) => {
                            if (!card.faceUp) return;
                            beginDrag(event, { from: 'tableau', col, index });
                        }
                    });
                    if (card.faceUp) {
                        node.style.setProperty('--face-base', `${faceBase}px`);
                        node.style.setProperty('--face-index', String(faceIndex));
                        faceIndex += 1;
                    } else {
                        node.style.setProperty('--stack', String(index));
                        faceBase = (index + 1) * 12;
                        faceIndex = 0;
                    }
                    wrap.appendChild(node);
                });
                const downCount = pile.filter((card) => !card.faceUp).length;
                const upCount = pile.length - downCount;
                wrap.style.minHeight = `${Math.max(220, downCount * 12 + upCount * 32 + 96)}px`;
            }
            rows.appendChild(wrap);
        });
        boardEl.appendChild(rows);
        updateHeader();
    }

    function seedRandom() {
        const seed = gameMode === 'daily'
            ? window.PuzzleUtil.hashString(`${playDate}:solitaire`)
            : (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0));
        return window.PuzzleUtil.mulberry32(seed);
    }

    function freshDeal() {
        deal(seedRandom());
        selected = null;
        started = false;
        won = false;
        paused = false;
        secondsElapsed = 0;
        stopTimer();
    }

    function showBoard() {
        window.App.preparePlay(PUZZLE_ID);
        document.getElementById('play-title').textContent = gameMode === 'daily' ? 'Daily' : 'New game';
        render();
        if (won) {
            stopTimer();
            setStatus('Completed.');
            return;
        }
        setStatus('Drag cards or tap to move.');
        if (!paused) {
            started = true;
            startTimer();
        } else {
            stopTimer();
        }
    }

    function restore(saved) {
        if (!saved || !saved.started || !Array.isArray(saved.tableau)) {
            freshDeal();
            showBoard();
            return;
        }
        stock = (saved.stock || []).map(cloneCard);
        waste = (saved.waste || []).map(cloneCard);
        foundations = (saved.foundations || [[], [], [], []]).map(clonePile);
        tableau = (saved.tableau || [[], [], [], [], [], [], []]).map(clonePile);
        selected = null;
        started = true;
        secondsElapsed = saved.seconds || 0;
        won = saved.status === 'completed';
        paused = saved.status === 'in-progress';
        showBoard();
    }

    window.Solitaire = {
        bind() {
            pauseButton.addEventListener('click', () => {
                if (won) return;
                setPaused(!paused);
            });
            boardEl.addEventListener('pointermove', onPointerMove);
            boardEl.addEventListener('pointerup', onPointerUp);
            boardEl.addEventListener('pointercancel', () => {
                endDrag(true);
                clearSelection();
                render();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) saveDaily();
            });
            window.addEventListener('pagehide', () => saveDaily());
        },
        startDaily() {
            gameMode = 'daily';
            playDate = window.PuzzleUtil.localDateKey();
            restore(window.Store.getDaily(PUZZLE_ID, playDate, 'default'));
        },
        startFree() {
            gameMode = 'free';
            playDate = '';
            freshDeal();
            showBoard();
        },
        leave() {
            saveDaily();
            stopTimer();
            paused = false;
            clearSelection();
            endDrag(true);
            window.App.showHome(PUZZLE_ID);
        },
        setPaused,
        isPaused: () => paused,
        onKeyDown() {}
    };
})();
