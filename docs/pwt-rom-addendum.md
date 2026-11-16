# Pokémon World Tournament: what the retail ROM adds to bw2-pwt-research

This note records what was read out of a retail *Pokémon Black 2* (USA/Europe,
game code `IREO`, SHA-256 beginning `2e6b2415354aa414`) and the Project Pokémon
RawDB text dump while building Daily Tournament, and compares it with
[DavidAGInnovation/bw2-pwt-research](https://github.com/DavidAGInnovation/bw2-pwt-research).
It is written so that the parts that are new can be offered upstream. Every
decoded table is in `docs/rom/` (`wbt1-parties.md`, `wbt2-parties.md`,
`wbt3-parties.md`, `wbt-trainer-table.md`); `scripts/import-rom.mjs`
regenerates them from any Black 2 / White 2 ROM. The ROM itself is not
distributed.

Method: the NDS file table (FNT/FAT) was parsed directly, the NARC containers
inside `/a/2/4` and `/a/2/5` opened, and their fixed-size members decoded with
the `BSUBWAY_POKEMON_ROM_DATA` layout that the research repo documents for the
Rental archive. Decoded species, items and moves were checked against Serebii's
transcriptions of all 594 Leader and Champion sets; they agree except for one
record noted below. The generic reverse-engineering tooling tried first
(rea-agents `open_binary`) does not recognise the `.nds` container, so no
disassembly was done here; everything below is data, not code.

## 1. Retail paths of the normal party archives (new)

The research repo names the runtime archives (`wbt1n_pd.narc`, `wbt2n_pd.narc`,
`wbt3n_pd.narc`) and the ace trainer tables (`wbt1a_tr.tdm` …) from the
source tree but does not give their retail file-system locations. They are:

| Retail path | Members | Content |
| --- | ---: | --- |
| `/a/2/4/7` | 1 × 2048 B | WBT trainer table, 128 rows × 16 B (already documented) |
| `/a/2/4/8` | 120 × 6 B | `wbt1` trainer headers (Driftveil Tournament) |
| `/a/2/4/9` | 120, 6–16 B | `wbt1` party index lists |
| `/a/2/5/0` | 1000 × 16 B | `wbt1` Pokémon records (988 used) |
| `/a/2/5/1` | 120 × 6 B | `wbt2` trainer headers (Unova/Kanto/Johto/Hoenn/Sinnoh Leaders cups) |
| `/a/2/5/2` | 120, 6–16 B | `wbt2` party index lists |
| `/a/2/5/3` | 1000 × 16 B | `wbt2` Pokémon records (988 used) |
| `/a/2/5/4` | 69 × 6 B | `wbt3` trainer headers (World Leaders, Champions, Type Expert, Mix Master) |
| `/a/2/5/5` | 69, 6–16 B | `wbt3` party index lists |
| `/a/2/5/6` | 1000 × 16 B | `wbt3` Pokémon records (384 used) |
| `/a/2/5/7` | 1000 × 16 B | Rental records (documented) |
| `/a/2/1/1` | 1000 × 16 B | Byte-identical copy of `/a/2/5/7` |
| `/a/2/6/1` | 1000 × 16 B | 369 records, no items, no EVs (Wooper, Makuhita …); not a PWT table, as the research repo already says |

Member counts match the research repo's row counts (119 + dummy for `wbt1`
and `wbt2`, 68 + dummy for `wbt3`).

## 2. Trainer-table member format (new)

Both trainer tables of a set have a dummy member 0; trainer-table row *N* is
member *N + 1*, as the repo states for `FBI_TOOL_GetTrainerRomData`.

* Header member (6 bytes): `u16 2, u16 1, u16 ace`. The third field is the
  **record index of the ace**, the Pokémon the fixed-first path puts in slot 0.
  It is not always the first record of the party: Clair's header names record
  164 (Kingdra), the second of her six, in both `wbt2` and `wbt3`, which matches
  the repo's ace list. Blue's and Red's headers name Alakazam (346) and Pikachu
  (382) even though their trainer rows have the ace flag cleared, so the value is
  present but unused for them.
* Index member: `u16 2, u16 count, u16 record[count]`. Every battling trainer
  has six records; they are consecutive in the Pokémon archive.
* In `wbt1` the header's third field is *not* an ace record for most members
  (it repeats the member number). Driftveil parties were not investigated
  further.
* Placeholder members. Champions have no `wbt2` party: members 15–20 (and the
  Hilda/Rival/Cheren/Colress rows 54–56, 58, and all generic rows 59–68) share the
  four-record list `[1, 3, 4, 18]` and headers pointing at 73 or 64–68. The
  Champions' and Red's real parties are `wbt3` members 15–20 and 54. `wbt3`
  members 55–58 likewise alias member 1's records, and `wbt2` member 57
  (Colress) is a real six-record Unova party (Breloom, Unfezant, Haxorus,
  Serperior, Emboar, Samurott) with three-stat EV masks.

## 3. The Leaders' and Champions' own records (new)

The research repo decodes the Rental pool but not the trainers' normal parties,
so natures and EV masks for the 46 Leaders and 7 Champions were not available
anywhere public (Serebii and Bulbapedia list only species, items and moves).
They are now in `docs/rom/wbt2-parties.md` and `wbt3-parties.md`. Highlights:

* **Unova Leaders have no EVs in their regional cup.** All 14 Unova rows'
  `wbt2` parties (Cheren through Brycen, plus Bianca) store EV mask `0x00`,
  while every Kanto, Johto, Hoenn and Sinnoh `wbt2` party and every `wbt3`
  party uses two or more stats. Driftveil (`wbt1`) parties have no held items
  and no EVs at all.
* **Masks with three and four stats exist** and follow the `510 / count` rule
  (170 or 127 each): Lenora's Braviary, Brock's Tyranitar, Misty's Lapras,
  Whitney's Ursaring, Morty's Mismagius, Chuck's Poliwrath, Clair's Kingdra,
  Janine's Weezing and Nidoqueen, Flannery's Camerupt, Norman's Slaking,
  Winona's Altaria and Tropius, Liza's Xatu (all World Leaders sets) and
  Colress's `wbt2` party.
* Nature mix: `wbt2` is dominated by Adamant (211 of 572 records) and Jolly
  (202); `wbt3` by Adamant (95 of 408), Jolly (75), Timid (54) and Modest (52).
* **Forms.** Blaine's Rotom is form 1 (Heat), Wattson's form 2 (Wash),
  Volkner's form 4 (Fan), confirming Serebii. Wattson's Ampharos stores form
  `5`, which Ampharos does not have; the game shows the base form.
* **One data error on Serebii.** Cilan's regional-cup Jumpluff (record 64 of
  `wbt2`) has Leech Seed, Cotton Spore, Cotton Spore, Sleep Powder; Serebii
  lists Giga Drain in place of the duplicate. All other 593 sets agree with
  Serebii in species, item and all four moves.

## 4. Trainer-table row fields beyond those documented (partly new)

The repo documents byte 0 (result category), byte 1 (sex), bytes 2–3
(`mmdl_id`), byte 4 (`btl_tr_type`), byte 5 (cup mask), byte 6 (family), byte 7
(Type Expert type) and byte 8 (`PowerRnd << 3 | priority`). The remaining bytes
of the 128 rows (`docs/rom/wbt-trainer-table.md`):

* Bytes 10–11 (`u16`): battle music. Kanto Leaders 1245, Johto 1247, Hoenn
  1249, Sinnoh 1251, Blue 1246, Lance and Red 1248, Steven and Wallace 1250,
  Cynthia 1252, Alder 1136, Cheren/Bianca/Unova Leaders 1132–1133 (BW2 Gym
  Leader theme), generic trainers 1254, Type Expert trainers 1131.
* Bytes 12–13 (`u16`): 1263 on every row; presumably a second sound id
  (not identified).
* Byte 14: **ace flag**, 1 for every row with a forced lead and 0 for Blue, Red,
  Hilda, the Rival and all generic rows 78–127. This is the retail location of
  the `エースポケモン` mark in the repo's source listing.
* Byte 9 and byte 15 are 0 everywhere.

All priority, `PowerRnd` and ace values agree with the repo's tables
(Leaders 3/20, Champions 4/25, Red 4/30, Type Expert 2/16 or 2/8, generic
1/0, Rival 3/12, Cheren-as-rival 4/12, Colress 5/12, Hilda 4/0).

## 5. Text (new)

The repo has no dialogue. Project Pokémon's RawDB publishes the English text
NARC `/a/0/0/2`; the PWT files are:

* **File 407**: 1008 entries, 126 blocks of eight lines, one per trainer:
  `+0 +1 +2` before the battle in round 1, round 2 and the final (the game
  varies the line by round, which explains Bulbapedia's note that Chuck's
  quotes "seem to vary"), `+3` after losing to the player, `+4` after beating
  the player, `+5 / +6` in the lobby after losing / winning (prefixed with the
  speaker's name), `+7` the announcer's introduction. Blocks 0–52 follow the
  name table order (Cheren … Volkner, Bianca at 8); 53–54 are the unused
  Hilbert/Hilda sets; 55 is the player (`VAR(256, 1)`); 56 Cheren again; 57
  Colress; 58–77 the Type Expert and Rental-pool trainers; 78–124 the Rental
  and Mix variants of the Leaders; **Red is block 125**, the last one, and says
  only "..." / "...!" / "...?". Morty's introduction is the only one that does
  not contain the trainer's name.
* **File 406**: announcer lines. 1 "These are the Pokémon Trainers who entered
  this tournament!", 2 "The `cup` starts now!", 5–7 round openers ("The first /
  second / final round... A vs. B!"), 8–32 twenty-five result calls, ordered
  from rout ("That was a lopsided battle!") through close ("It was a
  jaw-dropping seesaw match!") and summit ("Is this the showdown at the
  summit?") to come-from-behind ("What a come-from-behind victory!"). How the
  game indexes into 8–32 was not traced.
* **File 409**: the 128-entry PWT name table (row order of the trainer table);
  file 410 is the matching class-label table the repo mentions.

## 6. Still open

* The code path that picks the announcer's result call (which of entries 8–32)
  and the trainer-side lines when the player is an NPC's opponent.
* The meaning of the constant 1263 at bytes 12–13 and of the `wbt1` header
  field.
* The per-move "Expert" AI adjustments, beyond the shared Strong scoring the
  repo describes.
* Nothing here covers White 2 separately; paths are expected to be identical
  (`IRDO`), and the importer accepts either.
