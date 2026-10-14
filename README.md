# Pop Up Puzzles

A static puzzle site with nine playable games, daily challenges, trophies, a shop, and a customizable profile.

**Repository:** [github.com/leeorshemesh/pop-up-puzzles](https://github.com/leeorshemesh/pop-up-puzzles)

## Play

Open the live site on GitHub Pages:

[https://leeorshemesh.github.io/pop-up-puzzles/](https://leeorshemesh.github.io/pop-up-puzzles/)

Progress is stored in your browser (`localStorage`). Clearing site data resets trophies, unlocks, and stats.

## Run locally

Serve the folder and open `index.html`:

```
py -m http.server 8080
```

Then visit `http://127.0.0.1:8080/`.

## Screens

- **Home**: flip cards with per-puzzle icons. Opening a card shows today’s daily (by difficulty when available) and a new-game option. Settings include a theme dropdown and a hide-timers toggle.
- **Profile**: view-only name, avatar, trophy count, and expandable per-game stats (daily clears, best times, and best scores). **Edit Profile** drafts changes (name, skin, shirt, face, outfit) and confirms before discarding unsaved edits.
- **Shop**: spend trophies on themes, backgrounds, avatar outfits, and Solitaire card backs. Cards flip open to confirm a purchase; “Inventory only” filters to owned items.
- **Inventory**: equip owned themes, backgrounds, outfits, and card backs (plus free defaults).
- **Play**: rules modal, pause, timers (optional), hints where supported, and a victory modal with time/score and trophy awards.

## Puzzles

| Puzzle | Difficulties | Daily trophies | Tracked score |
| --- | --- | --- | --- |
| Sudoku | Easy / Medium / Hard | 1 / 2 / 3 | Best time |
| Wordle | — | 2 | Best guesses |
| Minesweeper | Easy / Medium / Hard | 1 / 2 / 3 | Best time |
| 2048 | — | Reach 512 / 1024 / 2048 / 4096 → 1 / 2 / 3 / 4 (each threshold once per day) | Best score |
| Hangman | — | 2 | Best lives remaining |
| Lights Out | Easy / Medium / Hard | 1 / 2 / 3 | Best taps |
| Solitaire | — | 3 | Best score |
| Sliding Puzzle | Easy / Medium / Hard | 1 / 2 / 3 | Best moves |
| Memory Match | Easy / Medium / Hard | 1 / 2 / 3 | Best flips |

## Trophies

Only a fair daily solve awards trophies, once per date and award key (difficulty, or a 2048 tile threshold).

Reveal Solution and free “New game” runs do not award trophies. Spend trophies in the shop; equip purchased items from Inventory or the shop’s inventory filter.

## Files

- `index.html`: shell and screens
- `css/base.css`, `css/home.css`, `css/play.css`
- `assets/icons/`: home card icons (`{puzzle-id}.jpg`)
- `assets/previews/`: optional preview images
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

`popup-theme`, `popup-hide-timer`, `popup-profile`, `popup-trophies`, `popup-unlocks`, `popup-equip`, `popup-daily-progress`, `popup-trophy-awards`, `popup-active-session`, `popup-best-times`, `popup-best-scores`.

Older `puzzle-theme` and `sudoku-daily-progress` values are copied on first load.

## Add a puzzle

1. Add an entry to `window.Puzzles` in `js/puzzles.js`.
2. If it is not ready, `js/placeholders.js` will show Coming soon.
3. When it is ready, add a module, include it from `index.html`, and call it from `startPuzzle` in `js/app.js`.
4. Add a matching icon at `assets/icons/{id}.jpg` for the home card.
