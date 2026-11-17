import pool from '../data/pool.json';
import { hashString, mulberry32, shuffle } from './rng.js';

export const PLAYERS = pool.players;
export const TRAINERS = pool.trainers;
export const CHART = pool.chart;
export const POOL_VERSION = pool.version;
export const TEAM_SIZE = 3;
export const ROUNDS = 3;
export const FIELD = 8;
export const ROUND_NAMES = ['Round 1', 'Semifinal', 'Final'];
export const ROUND_SHORT = ['R1', 'SF', 'F'];

// The daily three: a seeded Fisher-Yates shuffle of the player pool, first three.
export function dailyTeam(date) {
  const random = mulberry32(hashString(`${date}:team:v${POOL_VERSION}`));
  return shuffle(structuredClone(PLAYERS), random).slice(0, TEAM_SIZE);
}

// The cups a day can be, with the seven-NPC field each one draws, as the game's
// built-in constructors do: a regional cup draws seven of that region's Leaders,
// World Leaders draws seven of all 46 Leaders (who bring their World Leaders
// six), and the Champions cup is always all seven Champions.
const leaders = TRAINERS.filter((t) => t.priority === 3);
export const CUPS = [
  ...['Unova', 'Kanto', 'Johto', 'Hoenn', 'Sinnoh'].map((region) => ({
    id: region.toLowerCase(),
    name: `${region} Leaders`,
    roster: 'regional',
    pool: leaders.filter((t) => t.region === region),
  })),
  { id: 'world', name: 'World Leaders', roster: 'world', pool: leaders },
  { id: 'champions', name: 'Champions', roster: 'regional', pool: TRAINERS.filter((t) => t.priority === 4) },
];

// Key into matchups.json for a trainer's current roster.
export const rosterKey = (trainer) => (trainer.roster === 'world' ? `${trainer.id}@world` : trainer.id);

const info = ({ pool: _p, world: _w, ...t }) => t;

// A trainer's three for a Single battle: the ace always leads, the rest are drawn
// without replacement from the remaining six, skipping anything that would repeat
// a held item already on the team (the in-game party builder's exclusion rule).
function pickTeam(trainer, mons, random) {
  const team = [];
  const used = new Set();
  const items = new Set();
  const take = (i) => {
    team.push(structuredClone(mons[i]));
    used.add(i);
    if (mons[i].item) items.add(mons[i].item);
  };
  const ace = trainer.ace ? mons.findIndex((m) => m.name === trainer.ace) : -1;
  if (ace >= 0) take(ace);
  while (team.length < TEAM_SIZE) {
    let open = mons.map((_, i) => i).filter((i) => !used.has(i) && !(mons[i].item && items.has(mons[i].item)));
    if (!open.length) open = mons.map((_, i) => i).filter((i) => !used.has(i));
    take(open[Math.floor(random() * open.length)]);
  }
  return team;
}

// The game's private PWT random context: a 64-bit LCG, seeded once per
// tournament and replayed from the stored seed for the result pass.
const MASK = (1n << 64n) - 1n;
function pwtRandom(hi, lo) {
  let state = (BigInt(hi) << 32n) | BigInt(lo);
  return (range) => {
    state = (state * 0x5d588b656c078965n + 0x269ec3n) & MASK;
    return Number(((state >> 32n) * BigInt(range)) >> 32n);
  };
}

// Type-chart score of `a` attacking `b` (0 no effect … 3 super effective);
// a type-neutral record (Champions, the player) scores neutral both ways.
const affinity = (a, b) => (a && b ? CHART[a][b] : 2);

// wbt_calc_result: higher priority wins outright; otherwise the better type
// affinity wins 70% of the time and equal affinities are a coin flip. The player
// is then forced through, after any random value the comparison consumed.
function calcResult(a, b, rand) {
  let aWins;
  let odds = 100;
  if (a.priority !== b.priority) aWins = a.priority > b.priority;
  else {
    const fa = affinity(a.type, b.type);
    const fb = affinity(b.type, a.type);
    if (fa === fb) {
      aWins = rand(2) === 0;
      odds = 50;
    } else {
      aWins = fa > fb;
      const reversed = rand(10) >= 7;
      if (reversed) aWins = !aWins;
      odds = reversed ? 30 : 70;
    }
  }
  if (a.player) aWins = true;
  else if (b.player) aWins = false;
  return { winner: aWins ? a : b, odds };
}

// Exchange sort by descending priority, swaps included, as wbt_makematch does.
function sortByPriority(list) {
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (list[i].priority < list[j].priority) [list[i], list[j]] = [list[j], list[i]];
  return list;
}

const PLAYER = { player: true, id: 'you', name: 'You', priority: 3, type: null };

// The daily tournament: a cup, its eight-slot bracket (you plus seven NPCs), the
// simulated NPC results that decide who reaches you, and your three opponents
// with the three Pokémon each brings. Seeded by date, so everyone gets the same.
const cache = new Map();
export function dailyTournament(date) {
  if (cache.has(date)) return cache.get(date);
  const random = mulberry32(hashString(`${date}:bracket:v${POOL_VERSION}`));
  const cup = CUPS[Math.floor(random() * CUPS.length)];
  const seven = shuffle([...cup.pool], random).slice(0, FIELD - 1);
  // Eight participant pointers are shuffled, the player's slot is recorded, then
  // the NPCs are sorted by priority: the top three take the final, semifinal and
  // first-round slots on the player's path and the rest fill the remainder.
  const npcs = sortByPriority(shuffle(seven.map(info), random));
  const playerPos = Math.floor(random() * FIELD);
  const field = new Array(FIELD);
  field[playerPos] = PLAYER;
  field[playerPos ^ 4] = npcs[0];
  field[playerPos ^ 2] = npcs[1];
  field[playerPos ^ 1] = npcs[2];
  const rest = [playerPos ^ 3, playerPos ^ 5, playerPos ^ 6, playerPos ^ 7].sort((a, b) => a - b);
  rest.forEach((slot, i) => (field[slot] = npcs[3 + i]));

  const rand = pwtRandom(hashString(`${date}:pwt:hi`), hashString(`${date}:pwt:lo`));
  const matchOf = (a, b) => ({ a, b, ...calcResult(field[a], field[b], rand) });
  const r1 = [0, 2, 4, 6].map((i) => matchOf(i, i + 1));
  const sf = [0, 2].map((i) => matchOf(field.indexOf(r1[i].winner), field.indexOf(r1[i + 1].winner)));
  const opponents = [field[playerPos ^ 1], r1[(playerPos >> 1) ^ 1].winner, sf[(playerPos >> 2) ^ 1].winner];
  const bracket = opponents.map((t) => {
    const mons = cup.roster === 'world' ? TRAINERS.find((x) => x.id === t.id).world : TRAINERS.find((x) => x.id === t.id).pool;
    return { ...t, roster: cup.roster, team: pickTeam(t, mons, random) };
  });
  const tournament = {
    cup: { id: cup.id, name: cup.name, roster: cup.roster },
    field,
    playerPos,
    r1: r1.map((m) => ({ a: m.a, b: m.b, winner: field.indexOf(m.winner), odds: m.odds })),
    sf: sf.map((m) => ({ a: m.a, b: m.b, winner: field.indexOf(m.winner), odds: m.odds })),
    bracket,
  };
  cache.set(date, tournament);
  return tournament;
}

// The three opponents in order, each with their three Pokémon (the first leads).
export const dailyBracket = (date) => dailyTournament(date).bracket;
