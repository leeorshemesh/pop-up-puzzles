window.Placeholders = {
    open(puzzleId, label) {
        const puzzle = window.PuzzleUtil.get(puzzleId);
        document.getElementById('sudoku-play').hidden = true;
        document.getElementById('coming-soon').hidden = false;
        document.getElementById('play-menu-wrap').hidden = true;
        document.getElementById('play-title').textContent = `${puzzle.name} · ${label}`;
        document.getElementById('coming-soon-copy').textContent = `${puzzle.name} is coming soon.`;
        window.App.showPlay(puzzleId);
    }
};
