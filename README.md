# Pop Up Puzzles

A static puzzle site. Sudoku is playable. Wordle and Minesweeper are placeholders.

## Run

Serve the folder and open `index.html`:

```
py -m http.server 8080
```

Then visit `http://127.0.0.1:8080/`.

## Screens

- Home: puzzle cards. A card flips to today’s daily and a new-game dropdown.
- Profile: name, avatar colors, trophies, and daily stats.
- Shop: spend trophies on a theme, background, or avatar outfit.
- Play: Sudoku, or a coming-soon page for the other puzzles.

## Trophies

Only a fair daily solve awards trophies, once per date and difficulty.

- Easy 1, Medium 2, Hard 3
- Puzzles without difficulty (Wordle later): 2

Reveal Solution and new games do not award trophies.

## Files

- `index.html`: shell
- `css/base.css`, `css/home.css`, `css/play.css`
- `js/storage.js`: localStorage
- `js/puzzles.js`: puzzle registry
- `js/profile.js`, `js/shop.js`
- `js/sudoku.js`: Sudoku generator and play
- `js/placeholders.js`: Wordle and Minesweeper stubs
- `js/app.js`: screens, cards, settings

## Storage keys

`popup-theme`, `popup-hide-timer`, `popup-profile`, `popup-trophies`, `popup-unlocks`, `popup-equip`, `popup-daily-progress`, `popup-trophy-awards`.

Older `puzzle-theme` and `sudoku-daily-progress` values are copied on first load.

## Add a puzzle

1. Add an entry to `window.Puzzles` in `js/puzzles.js`.
2. If it is not ready, `js/placeholders.js` will show Coming soon.
3. When it is ready, add a module and call it from `startPuzzle` in `js/app.js`.
