// Everything the browser remembers lives in one localStorage record:
//   { version: 2, days: { [date]: Day }, practice: { [date]: PracticeRun[] } }
// Day: { status: 'won' | 'lost', result }  a finished official run
//      { status: 'started', journal }      an official run in progress
//      { status: 'void' }                  a run that broke and can't resume
// PracticeRun: { no, at, result, log }    today's practice ledger entries
// Daily PWT's record (dailytournament_v1) is read once and carried over.
import { previousDay } from './date.js';
import { POOL_VERSION, ROUNDS, TEAM_SIZE } from './bracket.js';

export const STORE_KEY = 'pwttoday_v1';
const LEGACY_KEY = 'dailytournament_v1';
const PRACTICE_KEEP = 8;
const LOG_KEEP = 600;

const empty = () => ({ version: 2, days: {}, practice: {} });
let cache = empty();
let broken = false;

// --- validation of what comes back out of localStorage ---------------------
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const bools = (a, n) => Array.isArray(a) && a.length === n && a.every((b) => typeof b === 'boolean');
const isMon = (m) =>
  !!m &&
  typeof m.name === 'string' &&
  Array.isArray(m.moves) &&
  m.moves.length >= 1 &&
  m.moves.length <= 4 &&
  m.moves.every((mv) => mv && typeof mv.name === 'string') &&
  Array.isArray(m.ivs) &&
  m.ivs.length === 6 &&
  Array.isArray(m.evs) &&
  m.evs.length === 6;
const isTeam = (team) =>
  Array.isArray(team) && team.length === TEAM_SIZE && new Set(team.map((m) => m?.name)).size === TEAM_SIZE && team.every(isMon);
const isAction = (a) =>
  !!a &&
  ['move', 'switch', 'lead'].includes(a.type) &&
  Number.isInteger(a.idx) &&
  a.idx >= -1 &&
  a.idx < (a.type === 'move' ? 4 : TEAM_SIZE);

const isJournal = (j) =>
  !!j &&
  j.version === 1 &&
  j.poolVersion === POOL_VERSION &&
  (j.cup === undefined || typeof j.cup === 'string') &&
  isDate(j.date) &&
  typeof j.seed === 'string' &&
  Number.isFinite(j.startedAt) &&
  isTeam(j.initialTeam) &&
  Array.isArray(j.bracket) &&
  j.bracket.length === ROUNDS &&
  j.bracket.every((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && t.quotes && isTeam(t.team)) &&
  Number.isInteger(j.initialLead) &&
  j.initialLead >= 0 &&
  j.initialLead < TEAM_SIZE &&
  Array.isArray(j.actions) &&
  j.actions.length <= 1e4 &&
  j.actions.every(isAction);

const isResult = (r) =>
  !!r &&
  (r.cup === undefined || typeof r.cup === 'string') &&
  typeof r.won === 'boolean' &&
  Number.isInteger(r.turns) &&
  r.turns >= 0 &&
  bools(r.pAlive, TEAM_SIZE) &&
  Array.isArray(r.pNames) &&
  r.pNames.length === TEAM_SIZE &&
  r.pNames.every((n) => typeof n === 'string') &&
  r.left === r.pAlive.filter(Boolean).length &&
  Array.isArray(r.rounds) &&
  r.rounds.length === ROUNDS &&
  r.rounds.every((x) => x && typeof x.name === 'string' && typeof x.id === 'string' && (x.won === null || typeof x.won === 'boolean') && bools(x.rDown, TEAM_SIZE)) &&
  r.roundsWon === r.rounds.filter((x) => x.won).length;

const isPracticeRun = (p) =>
  !!p && Number.isInteger(p.no) && Number.isFinite(p.at) && isResult(p.result) && Array.isArray(p.log) && p.log.every((l) => typeof l === 'string');

function clean(parsed) {
  const store = empty();
  if (!parsed || typeof parsed !== 'object') return store;
  for (const [date, entry] of Object.entries(parsed.days || {})) {
    if (!isDate(date) || !entry) continue;
    if ((entry.status === 'won' || entry.status === 'lost') && isResult(entry.result)) store.days[date] = { status: entry.status, result: entry.result };
    else if (entry.status === 'started') store.days[date] = isJournal(entry.journal) && entry.journal.date === date ? { status: 'started', journal: entry.journal } : { status: 'void' };
    else if (entry.status === 'void') store.days[date] = { status: 'void' };
  }
  for (const [date, runs] of Object.entries(parsed.practice || {}))
    if (isDate(date) && Array.isArray(runs)) store.practice[date] = runs.filter(isPracticeRun).slice(-PRACTICE_KEEP);
  return store;
}

// --- persistence -------------------------------------------------------------
export function load() {
  if (broken) return structuredClone(cache);
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    cache = raw ? clean(JSON.parse(raw)) : empty();
  } catch {
    // Unreadable record: set it aside before the next save overwrites it, so a
    // player's history can still be recovered by hand.
    try {
      if (raw && localStorage.getItem(`${STORE_KEY}_unreadable`) === null) localStorage.setItem(`${STORE_KEY}_unreadable`, raw);
    } catch {}
  }
  return structuredClone(cache);
}

function save(store) {
  cache = structuredClone(store);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    broken = false;
  } catch {
    broken = true;
  }
  return store;
}

// False once a write has failed (private window, storage full or blocked):
// progress is then kept for this visit only.
export const saving = () => !broken;

// Ask the browser not to evict this site's storage. Called once there is an
// official result worth keeping; browsers that would prompt decide for themselves.
export function keepStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

// --- stats -------------------------------------------------------------------
function computeStats(store) {
  const s = { played: 0, wins: 0, winStreak: 0, dayStreak: 0, lastDate: null, lastWon: false };
  for (const [date, d] of Object.entries(store.days).sort(([a], [b]) => a.localeCompare(b))) {
    if (!d.result) continue;
    const consecutive = s.lastDate === previousDay(date);
    s.played++;
    if (d.result.won) s.wins++;
    s.dayStreak = consecutive ? s.dayStreak + 1 : 1;
    s.winStreak = d.result.won ? (consecutive && s.lastWon ? s.winStreak + 1 : 1) : 0;
    s.lastDate = date;
    s.lastWon = d.result.won;
  }
  return s;
}

// Streaks shown on screen drop to 0 once a day has been skipped.
export function liveStats(stats, date) {
  const alive = stats.lastDate === date || stats.lastDate === previousDay(date);
  return { ...stats, winStreak: alive ? stats.winStreak : 0, dayStreak: alive ? stats.dayStreak : 0 };
}

export function view(date, store = load()) {
  const entry = store.days[date];
  return {
    stats: computeStats(store),
    today: entry?.result ? { ...entry.result, date, status: entry.status } : entry?.status === 'started' ? { date, status: 'started' } : null,
    practice: store.practice[date] || [],
  };
}

export function journalFor(date) {
  const entry = load().days[date];
  return entry?.status === 'started' ? entry.journal : null;
}

export function saveJournal(journal) {
  const store = load();
  if (store.days[journal.date]?.result) throw Error("Today's official run is already complete.");
  store.days[journal.date] = { status: 'started', journal };
  return save(store);
}

export function saveResult(date, result) {
  const store = load();
  if (!store.days[date]?.result) store.days[date] = { status: result.won ? 'won' : 'lost', result: { ...result, date } };
  keepStorage();
  return save(store);
}

export function voidDay(date) {
  const store = load();
  if (!store.days[date]?.result) store.days[date] = { status: 'void' };
  return save(store);
}

// Practice runs are kept for the current day only; the lobby ledger shows them.
export function savePractice(date, result, log) {
  const store = load();
  const runs = store.practice[date] || [];
  store.practice = { [date]: [...runs, { no: (runs.at(-1)?.no || 0) + 1, at: Date.now(), result, log: log.slice(-LOG_KEEP) }].slice(-PRACTICE_KEEP) };
  return save(store);
}

// The lead picked in the lobby, remembered for the rest of that day.
const LEAD_KEY = 'pwttoday_lead';
export function loadLead(date) {
  try {
    const saved = JSON.parse(localStorage.getItem(LEAD_KEY));
    return saved?.date === date && Number.isInteger(saved.lead) && saved.lead >= 0 && saved.lead < TEAM_SIZE ? saved.lead : 0;
  } catch {
    return 0;
  }
}
export function saveLead(date, lead) {
  try {
    localStorage.setItem(LEAD_KEY, JSON.stringify({ date, lead }));
  } catch {}
}

// --- one tab at a time ---------------------------------------------------------
const lockName = (date) => `pwttoday:${date}`;

// Runs left 'started' on earlier days can never be resumed: void them.
export async function voidStaleBattles(date) {
  if (!navigator.locks) return;
  for (const [day, d] of Object.entries(load().days)) {
    if (!(day < date && d.status === 'started')) continue;
    await navigator.locks.request(lockName(day), { ifAvailable: true }, (lock) => {
      if (lock && load().days[day]?.status === 'started') voidDay(day);
    });
  }
}

// Holds a Web Lock on the day's official run so two tabs can't both play it.
// Resolves with a release function.
export function lockDay(date) {
  if (!navigator.locks) return Promise.reject(Error('This browser cannot safely resume official runs. Please use a current browser.'));
  return new Promise((resolve, reject) => {
    navigator.locks
      .request(lockName(date), { ifAvailable: true }, (lock) => {
        if (!lock) return reject(Error('This official run is open in another tab.'));
        return new Promise((release) => resolve(release));
      })
      .catch(reject);
  });
}
