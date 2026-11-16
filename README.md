# PWT Today

A daily Pokémon World Tournament in the browser. Everyone gets the same three level 100 Pokémon
with competitive Gen 5 sets and the same three trainers from Black 2 / White 2's World Tournament:
one of the game's cups each day, the real teams, dialogue, natures and EVs, and the game's own rule
for who meets you. One official run a day, unlimited practice, healed between rounds.

Inspired by [Daily Red](https://daily-red.com/) and its one-battle-a-day idea. Unofficial fan
project; not affiliated with Nintendo, Creatures Inc., GAME FREAK or The Pokémon Company.

## Running

```sh
npm install
npm run dev        # http://localhost:5173
npm test
npm run build && npm run preview
npm run build:data # regenerate src/data from data/ after editing sets or trainers
```

The first battle in dev mode takes a moment: Vite compiles the battle worker, which bundles the
whole simulator.

## Hosting

Cloudflare Pages serves `dist/` and runs `functions/` at https://pwt-today.com. One-time setup:

```sh
npx wrangler login
npx wrangler d1 create pwt-today          # put the printed database_id in wrangler.toml
npx wrangler d1 migrations apply pwt-today --remote
npx wrangler pages project create pwt-today --production-branch main
npm run deploy                            # build and upload
```

Then add `pwt-today.com` under the Pages project's Custom domains. Players' progress is stored per
domain, so keep the site on that address.

## Layout

```
index.html            page shell; the app renders into #root
src/main.jsx          mounts App, prefetches the battle worker
src/App.jsx           header, footer, screen router, run lifecycle (lock, journal, result)
src/screens/          Lobby (today's cup, your path, your party, practice ledger)
                      Battle (stadium, menus, log, settings)
                      Result (verdict, round grid, share text, battle log)
src/components/       ui (sprites, chips, clock), scene (stadium, HUDs, text box),
                      menus (moves, lead pick, forfeit, party dialog, next-up card)
src/battle/           engine (one tournament run on @pkmn/sim, trainer AI), narrate (protocol
                      log → text + animation cues), worker + client (runs the engine off-thread)
src/lib/              bracket (daily draw, cups, NPC results), storage (localStorage record),
                      matchups (best answers from the precomputed damage table), share, date, rng
src/data/             generated: pool.json, matchups.json, constants.js
data/                 sources: sets.mjs (player pool), trainers.mjs, pwt-teams.txt,
                      pwt-world-teams.txt, pwt-text.json
functions/            Cloudflare Pages Function for /api/stats; migrations/ holds its D1 table
scripts/              build-pool, matchups, import-rom (teams from a ROM), import-text (dialogue)
docs/                 ROM research notes (see docs/pwt-rom-addendum.md)
test/                 vitest: engine, bracket, narration, share text, storage
```

## How it works

| Piece | Where | Notes |
| --- | --- | --- |
| Daily draw | `lib/bracket.js` | `mulberry32(murmur("<date>:team:v3"))` over the 40-set player pool, first three. Local calendar date, so it rolls at local midnight. |
| Cup and bracket | `lib/bracket.js` | The same RNG picks one of seven cups and draws seven NPCs the way the game's constructors do. NPCs are sorted by priority and the top three take the slots on your path; the other matches are settled with the game's `wbt_calc_result` rule through its 64-bit LCG (higher priority wins; else the better type affinity wins 70%; else a coin flip). You fight your pair partner, then the two simulated winners. |
| Trainer teams | `pickTeam()` | Three of six, ace first (Blue and Red have none), no repeated held item, as in the game's party builder. Regional cups use the `wbt2` parties, Champions and World Leaders the `wbt3` parties, read from the ROM by `scripts/import-rom.mjs` with natures, EV masks and forms. IVs: Leaders 20, Champions 25, Red 30. |
| Engine | `battle/engine.js` | One `gen5customgame` battle per round, seeded from the run seed; team preview for the lead pick; a `between` phase with a full heal. The AI uses the game's shared Strong scoring: minimum-roll damage, +4 for a KO, -1 when another known move out-damages, random among the best. |
| Narration | `battle/narrate.js` | One handler per protocol command turns the log into text, each line with a snapshot of both sides so the screen replays HP and sprites in step. Trainer and announcer lines come from the game's text and carry `speaker`/`line` for the dialogue box and `fx` cues for the trainer walking on, the Poké Ball throw and the trainer returning. |
| Storage | `lib/storage.js` | `localStorage["pwttoday_v1"]`: official results, the in-progress official journal (action list, replayed on reload), and today's practice ledger (up to eight runs with their move logs). A Daily PWT record is carried over on first load. Web Locks keep an official run to one tab. |
| Matchups | `lib/matchups.js` | `scripts/matchups.mjs` precomputes one-hit damage for every player set against every trainer set with `@smogon/calc`; the lobby shows your two best answers under each opponent's set. |
| Global stats | `functions/api/stats.js` | The "N% won today" line (shown once 30 players have results). In production a Cloudflare Pages Function counts one result per visitor per day in D1, keyed by a salted hash of IP and date; in `npm run dev` a stand-in in `vite.config.js` writes `.data/stats.json`. |

## Data sources

- Trainer parties: the game's `wbt` party tables, read from a Black 2 ROM you supply
  (`node scripts/import-rom.mjs <rom.nds>`); nothing from the ROM is committed except the decoded
  tables under `docs/rom/`.
- Dialogue and announcer lines: Black 2 text files 407 and 406 as published by Project Pokémon's
  RawDB (`node scripts/import-text.mjs <407.html> <406.html>`).
- Mechanics: [DavidAGInnovation/bw2-pwt-research](https://github.com/DavidAGInnovation/bw2-pwt-research);
  `docs/pwt-rom-addendum.md` lists what this project added back.
- Sprites: PokeAPI (Pokémon, Black/White) and Pokémon Showdown (trainers), loaded at runtime.
