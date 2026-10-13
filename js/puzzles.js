window.Puzzles = [
    {
        id: 'sudoku',
        name: 'Sudoku',
        description: 'Fill the grid so every row, column, and box has 1 through 9.',
        rules: 'Fill every empty cell with a digit from 1 to 9. Each row, each column, and each 3×3 box must contain every digit exactly once. Tap a cell, then use the keypad or keyboard. Notes mode lets you pencil in candidates.',
        difficulties: ['easy', 'medium', 'hard'],
        trophies: { easy: 1, medium: 2, hard: 3 }
    },
    {
        id: 'wordle',
        name: 'Wordle',
        description: 'Guess the hidden five-letter word in six tries.',
        rules: 'Guess the five-letter word in six tries. After each guess, tiles show green for a correct letter in the right spot, yellow for a correct letter in the wrong spot, and gray for letters not in the word. Use the on-screen keyboard or your keyboard.',
        difficulties: [],
        trophies: { default: 2 }
    },
    {
        id: 'minesweeper',
        name: 'Minesweeper',
        description: 'Clear the board without hitting a mine.',
        rules: 'Reveal all safe cells without detonating a mine. Numbers show how many mines touch that cell. Flag suspected mines with a right-click or long-press. Clear every non-mine cell to win.',
        difficulties: ['easy', 'medium', 'hard'],
        trophies: { easy: 1, medium: 2, hard: 3 }
    },
    {
        id: '2048',
        name: '2048',
        description: 'Slide and merge tiles for a high score.',
        rules: 'Swipe or use arrow keys to slide all tiles. Matching tiles merge into one with double the value. After each move, a new tile appears. Keep merging as long as you can — the run ends when no moves remain.',
        difficulties: [],
        trophies: { t512: 1, t1024: 2, t2048: 3, t4096: 4 }
    },
    {
        id: 'hangman',
        name: 'Hangman',
        description: 'Guess the hidden phrase one letter at a time.',
        rules: 'Reveal the hidden phrase by guessing letters. Correct letters fill in every matching blank. Each wrong guess adds to the hangman drawing. Guess the full phrase before the drawing is complete.',
        difficulties: [],
        trophies: { default: 2 }
    },
    {
        id: 'lightsout',
        name: 'Lights Out',
        description: 'Toggle cells until every light is off.',
        rules: 'Turn every light off. Tapping a cell toggles it and its orthogonal neighbors. Plan a sequence of taps so the whole board ends dark.',
        difficulties: ['easy', 'medium', 'hard'],
        trophies: { easy: 1, medium: 2, hard: 3 }
    },
    {
        id: 'solitaire',
        name: 'Solitaire',
        description: 'Clear the Klondike layout by building foundations.',
        rules: 'Build the four foundation piles up by suit from ace to king. In the tableau, stack cards down by alternating colors. Draw from the stock when stuck. Move sequences as allowed until all cards are on the foundations.',
        difficulties: [],
        trophies: { default: 3 }
    },
    {
        id: 'sliding',
        name: 'Sliding Puzzle',
        description: 'Slide numbered tiles back into order.',
        rules: 'Slide tiles into the empty space to restore ascending order. Tap a tile adjacent to the blank to move it. Finish when numbers read left to right, top to bottom, with the blank in the last spot.',
        difficulties: ['easy', 'medium', 'hard'],
        trophies: { easy: 1, medium: 2, hard: 3 }
    },
    {
        id: 'memory',
        name: 'Memory Match',
        description: 'Flip cards to find matching pairs.',
        rules: 'Flip two cards at a time. Matching pairs stay face up; mismatches flip back down. Clear the board by finding every pair. Remember positions to finish faster.',
        difficulties: ['easy', 'medium', 'hard'],
        trophies: { easy: 1, medium: 2, hard: 3 }
    }
];

window.PuzzleUtil = {
    get(id) {
        return window.Puzzles.find((puzzle) => puzzle.id === id);
    },
    trophyFor(id, level) {
        const puzzle = this.get(id);
        if (!puzzle) return 0;
        if (level && puzzle.trophies[level] != null) return puzzle.trophies[level];
        return puzzle.trophies.default || 0;
    },
    localDateKey(date = new Date()) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    },
    formatTime(totalSeconds) {
        const safe = Math.max(0, totalSeconds | 0);
        const mins = Math.floor(safe / 60).toString().padStart(2, '0');
        const secs = (safe % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    },
    difficultyLabel(level) {
        return level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Play';
    },
    hashString(value) {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    },
    mulberry32(seed) {
        let state = seed >>> 0;
        return function rng() {
            state = (state + 0x6D2B79F5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },
    dailyTitle() {
        const date = new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
        return `${date} Daily Puzzle`;
    },
    dailyStateText(record) {
        if (!record) return 'Play';
        const hideTime = window.Store.hideTimers();
        const time = window.PuzzleUtil.formatTime(record.seconds || 0);
        if (record.status === 'completed') return hideTime ? 'Completed' : `Completed · ${time}`;
        if (record.status === 'failed') return 'Failed';
        if (record.revealed === true) return hideTime ? 'Solution revealed' : `Solution revealed · ${time}`;
        return hideTime ? 'Resume' : `Resume · ${time}`;
    }
};
