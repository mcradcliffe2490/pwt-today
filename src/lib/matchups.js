// Who on your team hits a given opponent hardest, from the damage table that
// scripts/matchups.mjs precomputes with @smogon/calc for today's exact sets.
// table[player][`${rosterKey}/${foe}`] =
//   [move, min%, max%, acc, foeMove, foeMin%, foeMax%, foeAcc, speed (-1 slower, 0 tie, 1 faster)]
import matchups from '../data/matchups.json';
import { rosterKey } from './bracket.js';

const hit = (row, i) => (row[i] ? { move: row[i], min: row[i + 1], max: row[i + 2], acc: row[i + 3] } : null);
const expected = (h) => (Math.min(100, (h.min + h.max) / 2) * h.acc) / 100;

export const damageLabel = (h) => {
  const lo = Math.min(100, Math.round(h.min));
  const hi = Math.min(100, Math.round(h.max));
  return lo >= 100 ? 'KO' : `${lo === hi ? hi : `${lo}-${hi}`}%`;
};

// Your Pokémon ranked by expected damage against `foeName` on `trainer`'s team.
export function bestAgainst(team, trainer, foeName) {
  const rows = [];
  for (const mon of team) {
    const row = matchups.table[mon.name]?.[`${rosterKey(trainer)}/${foeName}`];
    const h = row && hit(row, 0);
    if (h) rows.push({ mon, hit: h, back: hit(row, 4), speed: row[8], score: expected(h) });
  }
  return rows.sort((a, b) => b.score - a.score);
}
