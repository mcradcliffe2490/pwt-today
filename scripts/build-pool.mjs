// Expands data/sets.mjs, data/trainers.mjs, data/pwt-teams.txt,
// data/pwt-world-teams.txt and data/pwt-text.json into src/data/pool.json: validates every set with
// Showdown's [Gen 5] OU validator, then precomputes stats, types, dex numbers,
// move data and the Gen 5 type chart so the UI never needs the simulator.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Dex, TeamValidator } from '@pkmn/sim';
import * as calc from '@smogon/calc';
import { PLAYERS } from '../data/sets.mjs';
import { TRAINERS } from '../data/trainers.mjs';
import text from '../data/pwt-text.json' with { type: 'json' };

// Bump when a change should stop old journals from replaying against new data.
export const POOL_VERSION = 3;

const GEN = 5;
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const dex = Dex.forGen(GEN);
const validator = new TeamValidator(`gen${GEN}ou`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Abilities that are never worth picking when the species has an alternative.
const DEAD_ABILITIES = new Set(['Illuminate', 'Run Away', 'Pickup', 'Honey Gather', 'Stench', 'Klutz', 'Damp', 'Early Bird', 'Big Pecks', 'Tangled Feet', 'Leaf Guard', 'Rivalry', 'Healer', 'Frisk', 'Forewarn', 'Anticipation', 'Unaware', 'Oblivious', 'Insomnia', 'Shed Skin', 'Hustle', 'Immunity', 'Cute Charm', 'Keen Eye', 'Soundproof']);

const parseEvs = (text) => {
  const evs = Object.fromEntries(STATS.map((s) => [s, 0]));
  for (const part of text.split('/')) {
    const [n, stat] = part.trim().split(/\s+/);
    evs[stat.toLowerCase()] = Number(n);
  }
  return evs;
};

// Fallback for sets that give no nature, EVs or ability. The World Tournament
// files carry natures and EVs read from the ROM (scripts/import-rom.mjs) but
// leave the ability blank, because the game rolls it per Pokémon; the pick here
// is the first standard ability unless it is a dud. Nature and EVs are guessed
// from the moveset only for hand-written lines: offense side by move categories
// (base stats break a tie), speed investment when the species has base 80+
// Speed, 510 EVs split over the two chosen stats.
function derive(species, moves) {
  const cats = moves.map((m) => dex.moves.get(m).category);
  const phys = cats.filter((c) => c === 'Physical').length;
  const spec = cats.filter((c) => c === 'Special').length;
  const bs = species.baseStats;
  const fast = bs.spe >= 80;
  const evs = Object.fromEntries(STATS.map((s) => [s, 0]));
  let nature;
  if (!phys && !spec) {
    const wall = bs.def >= bs.spd ? 'def' : 'spd';
    nature = wall === 'def' ? 'Bold' : 'Calm';
    evs.hp = 255;
    evs[wall] = 255;
  } else {
    const side = phys > spec ? 'atk' : spec > phys ? 'spa' : bs.atk >= bs.spa ? 'atk' : 'spa';
    const mixed = phys && spec;
    nature = fast
      ? mixed ? (side === 'atk' ? 'Naive' : 'Hasty') : side === 'atk' ? 'Jolly' : 'Timid'
      : mixed ? (side === 'atk' ? 'Lonely' : 'Mild') : side === 'atk' ? 'Adamant' : 'Modest';
    evs[side] = 255;
    evs[fast ? 'spe' : 'hp'] = 255;
  }
  const standard = ['0', '1'].map((k) => species.abilities[k]).filter(Boolean);
  const ability = standard.find((a) => !DEAD_ABILITIES.has(a)) || standard[0];
  return { nature, evs, ability };
}

// "Species @ Item | Ability | Nature | EVs | Moves" (full) or
// "Species @ Item | Moves" optionally followed by "| Ability | Nature | EVs" overrides.
function parseSet(line) {
  const parts = line.split('|').map((s) => s.trim());
  const [species, item] = parts[0].split('@').map((s) => s.trim());
  const sp = dex.species.get(species);
  if (parts.length === 5 && parts[4].includes(',')) {
    const [, ability, nature, evText, moveText] = parts;
    return { species, item, ability, nature, evs: parseEvs(evText), moves: moveText.split(',').map((m) => m.trim()) };
  }
  // The ROM lists Cilan's Jumpluff with Cotton Spore in two slots; Showdown wants each move once.
  const moves = [...new Set(parts[1].split(',').map((m) => m.trim()))];
  const d = sp.exists ? derive(sp, moves) : { nature: 'Serious', evs: parseEvs('0 HP'), ability: '' };
  return {
    species,
    item,
    ability: parts[2] || d.ability,
    nature: parts[3] || d.nature,
    evs: parts[4] ? parseEvs(parts[4]) : d.evs,
    moves,
  };
}

// Roster files: "## trainerId" headings followed by one set per line.
function readTeams(file) {
  const text = fs.readFileSync(path.join(root, 'data', file), 'utf8');
  const teams = {};
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') && !line.startsWith('## ')) continue;
    if (line.startsWith('## ')) {
      current = line.slice(3).trim();
      teams[current] = [];
    } else if (current) teams[current].push(line);
  }
  return teams;
}

// PokeAPI sprite ids for alternate forms (species.num is the base form's).
const FORM_SPRITES = { 'Rotom-Heat': 10008, 'Rotom-Wash': 10009, 'Rotom-Frost': 10010, 'Rotom-Fan': 10011, 'Rotom-Mow': 10012 };

const errors = [];
function expand(line, owner, iv) {
  const set = parseSet(line);
  const species = dex.species.get(set.species);
  if (!species.exists) errors.push(`${owner}: unknown species ${set.species}`);
  const ivs = Object.fromEntries(STATS.map((s) => [s, iv]));
  const showdown = {
    name: species.name,
    species: species.name,
    level: 100,
    gender: species.gender === 'N' ? 'N' : 'M',
    ability: set.ability,
    item: set.item,
    nature: set.nature,
    moves: set.moves,
    evs: set.evs,
    ivs,
  };
  const problems = validator.validateSet(showdown, {}) || [];
  // Only legality matters here; OU tier policy (bans, clauses) does not, and in-game
  // sets are exempt from breeding-chain rules.
  for (const p of problems) if (!/exactly 0 EVs|is banned|Clause|tagged Uber|egg move combination|chainbreeding/.test(p)) errors.push(`${owner}: ${p}`);
  const mon = new calc.Pokemon(GEN, species.name, {
    level: 100,
    ability: set.ability,
    item: set.item,
    nature: set.nature,
    evs: set.evs,
    ivs,
  });
  return {
    name: species.name,
    dexno: FORM_SPRITES[species.name] || species.num,
    types: [...species.types],
    bs: STATS.map((s) => species.baseStats[s]),
    item: set.item,
    ability: set.ability,
    nature: set.nature,
    evs: STATS.map((s) => set.evs[s]),
    ivs: STATS.map(() => iv),
    max: mon.maxHP(),
    hp: mon.maxHP(),
    stats: Object.fromEntries(STATS.slice(1).map((s) => [s, mon.stats[s]])),
    moves: set.moves.map((name) => {
      const m = dex.moves.get(name);
      if (!m.exists) errors.push(`${owner}: unknown move ${name}`);
      const pp = Math.floor((m.pp * 8) / 5);
      return {
        name: m.name,
        pp,
        max: pp,
        data: {
          type: m.type,
          category: m.category,
          pow: m.basePower,
          acc: m.accuracy === true ? 0 : m.accuracy,
          pp: m.pp,
          prio: m.priority,
        },
      };
    }),
  };
}

function checkPool(owner, pool, ace) {
  if (pool.length < 3) errors.push(`${owner} needs at least three Pokémon`);
  const seen = new Set();
  for (const p of pool) {
    if (seen.has(p.name)) errors.push(`${owner} lists ${p.name} twice`);
    seen.add(p.name);
  }
  if (ace && !pool.some((p) => p.name === ace)) errors.push(`${owner}: ace ${ace} is not on the team`);
}

const players = PLAYERS.map((line) => expand(line, 'player', 31));
const regional = readTeams('pwt-teams.txt');
const world = readTeams('pwt-world-teams.txt');
const trainers = TRAINERS.map((t) => {
  if (!regional[t.id]) errors.push(`${t.name}: no team in pwt-teams.txt`);
  const leader = t.priority === 3;
  if (leader && !world[t.id]) errors.push(`${t.name}: no team in pwt-world-teams.txt`);
  if (!leader && world[t.id]) errors.push(`${t.name}: Champions have no World Leaders team`);
  const pool = (regional[t.id] || []).map((line) => expand(line, t.name, t.ivs));
  checkPool(t.name, pool, t.ace);
  const quotes = text.trainers[t.id];
  if (!quotes) errors.push(`${t.name}: no dialogue in pwt-text.json`);
  else if (quotes.intro.length !== 3 || !['announce', 'lose', 'win', 'lobbyLose', 'lobbyWin'].every((k) => quotes[k]))
    errors.push(`${t.name}: incomplete dialogue`);
  const out = { ...t, quotes, pool };
  if (leader) {
    out.world = (world[t.id] || []).map((line) => expand(line, `${t.name} (World Leaders)`, t.ivs));
    checkPool(`${t.name} (World Leaders)`, out.world, t.ace);
  }
  return out;
});
for (const [file, teams] of [['pwt-teams.txt', regional], ['pwt-world-teams.txt', world]])
  for (const id of Object.keys(teams)) if (!TRAINERS.some((t) => t.id === id)) errors.push(`${file}: ${id} has no metadata`);

const names = new Set();
for (const p of players) {
  if (names.has(p.name)) errors.push(`player pool lists ${p.name} twice`);
  names.add(p.name);
}

// Gen 5 type chart as the bracket-result routine compares it: 0 no effect,
// 1 not very effective, 2 neutral, 3 super effective (attacking type → defending type).
const TYPES = dex.types.all().filter((t) => !t.isNonstandard && t.name !== 'Fairy').map((t) => t.name);
const chart = {};
for (const atk of TYPES) {
  chart[atk] = {};
  for (const def of TYPES) chart[atk][def] = dex.getImmunity(atk, [def]) ? 2 + dex.getEffectiveness(atk, [def]) : 0;
}
for (const t of trainers) if (t.type && !chart[t.type]) errors.push(`${t.name}: unknown type ${t.type}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const out = { version: POOL_VERSION, gen: GEN, players, trainers, chart, announcer: text.announcer };
fs.writeFileSync(path.join(root, 'src/data/pool.json'), JSON.stringify(out));
const count = (key) => trainers.reduce((n, t) => n + (t[key]?.length || 0), 0);
console.log(
  `pool.json: ${players.length} player sets, ${trainers.length} trainers, ${count('pool')} regional/Champion sets, ${count('world')} World Leaders sets`,
);
