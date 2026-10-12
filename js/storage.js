window.Store = (function () {
    const KEYS = {
        THEME: 'popup-theme',
        HIDE_TIMER: 'popup-hide-timer',
        PROFILE: 'popup-profile',
        TROPHIES: 'popup-trophies',
        UNLOCKS: 'popup-unlocks',
        EQUIP: 'popup-equip',
        DAILY: 'popup-daily-progress',
        AWARDS: 'popup-trophy-awards',
        SESSION: 'popup-active-session',
        BESTS: 'popup-best-times'
    };

    const DEFAULT_PROFILE = {
        name: 'Player',
        skin: '#f3c6a5',
        shirt: '#3b82f6',
        outfit: 'default',
        face: 'happy'
    };

    function readJson(key, fallback) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key));
            return parsed == null ? fallback : parsed;
        } catch {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function migrate() {
        if (!localStorage.getItem(KEYS.THEME) && localStorage.getItem('puzzle-theme')) {
            localStorage.setItem(KEYS.THEME, localStorage.getItem('puzzle-theme'));
        }
        if (!localStorage.getItem(KEYS.DAILY) && localStorage.getItem('sudoku-daily-progress')) {
            writeJson(KEYS.DAILY, { sudoku: readJson('sudoku-daily-progress', {}) });
        }
    }

    migrate();

    function getTheme() {
        const value = localStorage.getItem(KEYS.THEME);
        return typeof value === 'string' && value ? value : 'light';
    }

    function setTheme(theme) {
        localStorage.setItem(KEYS.THEME, theme);
    }

    function hideTimers() {
        return localStorage.getItem(KEYS.HIDE_TIMER) === 'true';
    }

    function setHideTimers(hidden) {
        localStorage.setItem(KEYS.HIDE_TIMER, hidden ? 'true' : 'false');
    }

    function getProfile() {
        return { ...DEFAULT_PROFILE, ...readJson(KEYS.PROFILE, {}) };
    }

    function setProfile(next) {
        writeJson(KEYS.PROFILE, { ...getProfile(), ...next });
    }

    function getTrophies() {
        return Math.max(0, Number(localStorage.getItem(KEYS.TROPHIES)) || 0);
    }

    function setTrophies(amount) {
        localStorage.setItem(KEYS.TROPHIES, String(Math.max(0, amount)));
    }

    function addTrophies(amount) {
        setTrophies(getTrophies() + amount);
        return getTrophies();
    }

    function getUnlocks() {
        const list = readJson(KEYS.UNLOCKS, []);
        return Array.isArray(list) ? list : [];
    }

    function addUnlock(id) {
        const list = new Set(getUnlocks());
        list.add(id);
        writeJson(KEYS.UNLOCKS, [...list]);
    }

    function hasUnlock(id) {
        return getUnlocks().includes(id);
    }

    function getEquip() {
        return {
            theme: getTheme(),
            background: 'none',
            outfit: getProfile().outfit,
            cards: 'classic',
            ...readJson(KEYS.EQUIP, {})
        };
    }

    function setEquip(next) {
        writeJson(KEYS.EQUIP, { ...getEquip(), ...next });
    }

    function dailyStore() {
        const store = readJson(KEYS.DAILY, {});
        return store && typeof store === 'object' ? store : {};
    }

    function getDaily(puzzleId, date, level) {
        const store = dailyStore();
        const puzzle = store[puzzleId] || {};
        const day = puzzle[date] || {};
        return level ? (day[level] || null) : day;
    }

    function setDaily(puzzleId, date, level, record) {
        const store = dailyStore();
        store[puzzleId] = store[puzzleId] || {};
        store[puzzleId][date] = store[puzzleId][date] || {};
        store[puzzleId][date][level] = record;
        writeJson(KEYS.DAILY, store);
    }

    function awardKey(date, puzzleId, level) {
        return `${date}:${puzzleId}:${level}`;
    }

    function awardIfNeeded(puzzleId, date, level, amount) {
        const awards = readJson(KEYS.AWARDS, {});
        const key = awardKey(date, puzzleId, level);
        if (awards[key] || amount <= 0) return 0;
        awards[key] = true;
        writeJson(KEYS.AWARDS, awards);
        addTrophies(amount);
        return amount;
    }

    function getSession() {
        const session = readJson(KEYS.SESSION, null);
        return session && typeof session === 'object' ? session : null;
    }

    function setSession(session) {
        writeJson(KEYS.SESSION, session);
    }

    function clearSession() {
        localStorage.removeItem(KEYS.SESSION);
    }

    function getBests(puzzleId) {
        const bests = readJson(KEYS.BESTS, {});
        const entry = bests && typeof bests === 'object' ? bests[puzzleId] : null;
        return entry && typeof entry === 'object' ? { ...entry } : {};
    }

    function recordBest(puzzleId, level, seconds) {
        const time = Math.max(0, seconds | 0);
        const bests = readJson(KEYS.BESTS, {});
        const store = bests && typeof bests === 'object' ? bests : {};
        store[puzzleId] = store[puzzleId] && typeof store[puzzleId] === 'object' ? store[puzzleId] : {};
        const current = store[puzzleId][level];
        if (current != null && time >= current) return false;
        store[puzzleId][level] = time;
        writeJson(KEYS.BESTS, store);
        return true;
    }

    function dailyStats() {
        const store = dailyStore();
        const stats = {};
        Object.keys(store).forEach((puzzleId) => {
            stats[puzzleId] = { total: 0, easy: 0, medium: 0, hard: 0, default: 0 };
            Object.values(store[puzzleId] || {}).forEach((day) => {
                Object.entries(day || {}).forEach(([level, record]) => {
                    if (!record || record.status !== 'completed') return;
                    stats[puzzleId].total += 1;
                    if (stats[puzzleId][level] != null) stats[puzzleId][level] += 1;
                    else stats[puzzleId].default += 1;
                });
            });
        });
        return stats;
    }

    return {
        KEYS,
        getTheme,
        setTheme,
        hideTimers,
        setHideTimers,
        getProfile,
        setProfile,
        getTrophies,
        addTrophies,
        getUnlocks,
        addUnlock,
        hasUnlock,
        getEquip,
        setEquip,
        getDaily,
        setDaily,
        awardIfNeeded,
        getSession,
        setSession,
        clearSession,
        getBests,
        recordBest,
        dailyStats
    };
})();
