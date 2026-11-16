// Precomputes src/data/matchups.json: for every player-pool Pokémon against
// every trainer Pokémon, its best single hit and the foe's best hit back.
// table[player][`${rosterKey}/${foe}`] =
//   [move, min%, max%, acc, foeMove, foeMin%, foeMax%, foeAcc, speed(-1 slower | 0 tie | 1 faster)]
// rosterKey is the trainer id for regional/Champion sets and `${id}@world` for
// World Leaders sets (see rosterKey() in src/lib/bracket.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as calc from '@smogon/calc';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pool = JSON.parse(fs.readFileSync(path.join(root, 'src/data/pool.json'), 'utf8'));
const GEN = pool.gen;
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const toCalc = (m) =>
  new calc.Pokemon(GEN, m.name, {
    level: 100,
    ability: m.ability,
    item: m.item,
    nature: m.nature,
    evs: Object.fromEntries(STATS.map((s, i) => [s, m.evs[i]])),
    ivs: Object.fromEntries(STATS.map((s, i) => [s, m.ivs[i]])),
  });

// Best damaging move by expected damage (mean percent × accuracy); null if none lands.
function bestHit(attacker, defender) {
  let best = null;
  for (const mv of attacker.moves) {
    if (mv.data.category === 'Status') continue;
    let range;
    try {
      range = calc.calculate(GEN, toCalc(attacker), toCalc(defender), new calc.Move(GEN, mv.name)).range();
    } catch {
      continue;
    }
    const [min, max] = range.map((d) => (d / defender.max) * 100);
    if (max <= 0) continue;
    const acc = mv.data.acc || 100;
    const score = (Math.min(100, (min + max) / 2) * acc) / 100;
    if (!best || score > best.score) best = { move: mv.name, min, max, acc, score };
  }
  return best;
}

const round1 = (n) => Math.round(n * 10) / 10;
const table = {};
for (const player of pool.players) {
  const row = (table[player.name] = {});
  for (const trainer of pool.trainers) {
    for (const [key, mons] of [[trainer.id, trainer.pool], [`${trainer.id}@world`, trainer.world || []]]) {
      for (const foe of mons) {
        const hit = bestHit(player, foe);
        const back = bestHit(foe, player);
        const speed = Math.sign(player.stats.spe - foe.stats.spe);
        row[`${key}/${foe.name}`] = [
          hit?.move ?? null,
          hit ? round1(hit.min) : 0,
          hit ? round1(hit.max) : 0,
          hit?.acc ?? 0,
          back?.move ?? null,
          back ? round1(back.min) : 0,
          back ? round1(back.max) : 0,
          back?.acc ?? 0,
          speed,
        ];
      }
    }
  }
}

fs.writeFileSync(path.join(root, 'src/data/matchups.json'), JSON.stringify({ poolVersion: pool.version, table }));
console.log(`matchups.json: ${Object.keys(table).length} players × ${Object.keys(Object.values(table)[0]).length} foes`);
