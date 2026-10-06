window.Puzzles = [
    {
        id: 'sudoku',
        name: 'Sudoku',
        description: 'Fill the grid so every row, column, and box has 1 through 9.',
        difficulties: ['easy', 'medium', 'hard'],
        trophies: { easy: 1, medium: 2, hard: 3 }
    },
    {
        id: 'wordle',
        name: 'Wordle',
        description: 'Guess the hidden five-letter word in six tries.',
        difficulties: [],
        trophies: { default: 2 }
    },
    {
        id: 'minesweeper',
        name: 'Minesweeper',
        description: 'Clear the board without hitting a mine.',
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
