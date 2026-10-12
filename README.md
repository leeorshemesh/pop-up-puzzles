# Pop Up Puzzles

A static puzzle site with nine playable games, daily challenges, trophies, a shop, and a customizable profile.

## Run

Serve the folder and open `index.html`:

```
py -m http.server 8080
```

Then visit `http://127.0.0.1:8080/`.

## Screens

- **Home**: puzzle cards. Opening a card shows a centered overlay with today’s daily and a new-game option (or difficulty dropdown when the puzzle has levels). Settings include a theme dropdown and hide-timers toggle.
- **Profile**: view-only name, avatar, trophy count, and per-game stats (expandable). **Edit Profile** drafts changes (name, skin, shirt, face, outfit) and saves with a discard confirm if you leave dirty.
- **Shop**: spend trophies on themes, backgrounds, avatar outfits, and Solitaire card backs. Cards flip open to confirm a purchase; “Inventory only” filters to owned items.
- **Inventory**: equip owned themes, backgrounds, outfits, and card backs (plus free defaults).
- **Play**: one of the nine puzzles below.

## Puzzles

| Puzzle | Difficulties | Daily trophies |
| --- | --- | --- |
| Sudoku | Easy / Medium / Hard | 1 / 2 / 3 |
| Wordle | — | 2 |
| Minesweeper | Easy / Medium / Hard | 1 / 2 / 3 |
| 2048 | — | Reach 512 / 1024 / 2048 / 4096 → 1 / 2 / 3 / 4 (each threshold once per day) |
| Hangman | — | 2 |
| Lights Out | Easy / Medium / Hard | 1 / 2 / 3 |
| Solitaire | — | 3 |
| Sliding Puzzle | Easy / Medium / Hard | 1 / 2 / 3 |
| Memory Match | Easy / Medium / Hard | 1 / 2 / 3 |

## Trophies

Only a fair daily solve awards trophies, once per date and award key (difficulty, or a 2048 tile threshold).

Reveal Solution and free “New game” runs do not award trophies. Spend trophies in the shop; equip purchased items from Inventory or the shop’s inventory filter.

## Files

- `index.html`: shell and screens
- `css/base.css`, `css/home.css`, `css/play.css`
- `js/storage.js`: localStorage helpers
- `js/puzzles.js`: puzzle registry and shared helpers
- `js/profile.js`: avatar, profile view/edit, stats
- `js/shop.js`: shop catalog and purchases
- `js/inventory.js`: equip owned cosmetics
- `js/sudoku.js`, `js/wordle.js`, `js/minesweeper.js`
- `js/game2048.js`, `js/hangman.js`, `js/lightsout.js`
- `js/solitaire.js`, `js/sliding.js`, `js/memory.js`
- `js/words.js`, `js/phrases.js`: Wordle / Hangman word lists
- `js/placeholders.js`: coming-soon page for unfinished registry entries
- `js/app.js`: screens, home cards, settings, routing into games

## Storage keys

`popup-theme`, `popup-hide-timer`, `popup-profile`, `popup-trophies`, `popup-unlocks`, `popup-equip`, `popup-daily-progress`, `popup-trophy-awards`, `popup-active-session`, `popup-best-times`.

Older `puzzle-theme` and `sudoku-daily-progress` values are copied on first load.

## Add a puzzle

1. Add an entry to `window.Puzzles` in `js/puzzles.js`.
2. If it is not ready, `js/placeholders.js` will show Coming soon.
3. When it is ready, add a module, include it from `index.html`, and call it from `startPuzzle` in `js/app.js`.
