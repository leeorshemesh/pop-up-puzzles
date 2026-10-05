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
        if (record.revealed) return hideTime ? 'Solution revealed' : `Solution revealed · ${time}`;
        return hideTime ? 'Resume' : `Resume · ${time}`;
    }
};
