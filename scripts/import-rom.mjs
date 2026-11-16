// Reads the World Tournament party tables straight out of a Pokémon Black 2 /
// White 2 ROM and regenerates data/pwt-teams.txt and data/pwt-world-teams.txt
// with each Pokémon's nature and EV spread, plus reference dumps under
// docs/rom/. Usage: node scripts/import-rom.mjs <path to .nds>
//
// Retail file-system layout (USA/Europe Black 2, game code IREO; White 2 uses
// the same paths):
//   /a/2/4/7           WBT trainer table, 128 rows of 16 bytes
//   /a/2/4/8, /a/2/4/9 wbt1 trainer header + party index tables (Driftveil)
//   /a/2/5/0           wbt1 Pokémon records
//   /a/2/5/1, /a/2/5/2 wbt2 trainer tables (regional Leaders cups)
//   /a/2/5/3           wbt2 Pokémon records
//   /a/2/5/4, /a/2/5/5 wbt3 trainer tables (World Leaders, Champions, Type Expert)
//   /a/2/5/6           wbt3 Pokémon records
//   /a/2/5/7           Rental Pokémon records
// A trainer with table id N is member N+1 of its trainer tables (member 0 is a
// dummy). The header member is three u16s [2, 1, ace] where `ace` is the record
// index of the Pokémon that always leads (honoured only when the trainer row's
// ace flag, byte 14, is set). The index member is u16s [2, count, idx…], and
// each idx selects a 16-byte record in the matching Pokémon archive:
//   u16 species, u16 moves[4], u8 EV mask (bits: HP, Atk, Def, Spe, SpA, SpD),
//   u8 nature, u16 item, u16 form.
// Selected stats get floor(510 / count) EVs each, capped at 255.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Dex } from '@pkmn/sim';
import { TRAINERS } from '../data/trainers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const romPath = process.argv[2];
if (!romPath) {
  console.error('usage: node scripts/import-rom.mjs <rom.nds>');
  process.exit(1);
}
const dex = Dex.forGen(5);

// --- NitroFS -----------------------------------------------------------------
const rom = fs.readFileSync(romPath);
const gameCode = rom.toString('latin1', 0x0c, 0x10);
if (!['IREO', 'IRDO'].includes(gameCode)) {
  console.error(`not a Black 2 / White 2 ROM (game code ${gameCode})`);
  process.exit(1);
}
const fntOff = rom.readUInt32LE(0x40);
const fatOff = rom.readUInt32LE(0x48);
const files = new Map();
function walk(dirId, prefix) {
  const entry = fntOff + (dirId & 0xfff) * 8;
  let p = fntOff + rom.readUInt32LE(entry);
  let fileId = rom.readUInt16LE(entry + 4);
  for (;;) {
    const type = rom[p++];
    if (!type) break;
    const name = rom.toString('latin1', p, p + (type & 0x7f));
    p += type & 0x7f;
    if (type & 0x80) {
      walk(rom.readUInt16LE(p), `${prefix}${name}/`);
      p += 2;
    } else {
      files.set(prefix + name, [rom.readUInt32LE(fatOff + fileId * 8), rom.readUInt32LE(fatOff + fileId * 8 + 4)]);
      fileId++;
    }
  }
}
walk(0xf000, '/');
const file = (name) => {
  const [s, e] = files.get(name) || [];
  if (s === undefined) throw Error(`${name} not in ROM`);
  return rom.subarray(s, e);
};

// --- NARC --------------------------------------------------------------------
function narc(buf) {
  if (buf.toString('latin1', 0, 4) !== 'NARC') throw Error('not a NARC');
  let off = 0x10;
  let fat = [];
  let data = 0;
  while (off < buf.length) {
    const tag = buf.toString('latin1', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (tag === 'BTAF') {
      const n = buf.readUInt16LE(off + 8);
      fat = Array.from({ length: n }, (_, i) => [buf.readUInt32LE(off + 12 + i * 8), buf.readUInt32LE(off + 16 + i * 8)]);
    } else if (tag === 'GMIF') data = off + 8;
    off += size;
  }
  return fat.map(([s, e]) => buf.subarray(data + s, data + e));
}

// --- Records -----------------------------------------------------------------
const NATURES = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax', 'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash', 'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'];
const EV_BITS = ['HP', 'Atk', 'Def', 'Spe', 'SpA', 'SpD'];
const ROTOM = [null, 'Rotom-Heat', 'Rotom-Wash', 'Rotom-Frost', 'Rotom-Fan', 'Rotom-Mow'];
const speciesByNum = new Map();
const movesByNum = new Map();
const itemsByNum = new Map();
for (const s of dex.species.all()) if (!s.forme && !speciesByNum.has(s.num)) speciesByNum.set(s.num, s.name);
for (const m of dex.moves.all()) movesByNum.set(m.num, m.name);
for (const i of dex.items.all()) if (!itemsByNum.has(i.num) || !i.isNonstandard) itemsByNum.set(i.num, i.name);

const warnings = [];
function record(buf, where) {
  const species = buf.readUInt16LE(0);
  if (!species) return null;
  const form = buf.readUInt16LE(14);
  let name = speciesByNum.get(species) || `#${species}`;
  if (form) {
    const forme = name === 'Rotom' ? ROTOM[form] : null;
    if (forme) name = forme;
    else warnings.push(`${where}: ${name} has form ${form}, which it does not have; using the base form`);
  }
  const mask = buf[10];
  const picked = EV_BITS.filter((_, i) => mask & (1 << i));
  const each = picked.length ? Math.min(255, Math.floor(510 / picked.length)) : 0;
  return {
    species: name,
    moves: [2, 4, 6, 8].map((o) => movesByNum.get(buf.readUInt16LE(o)) || `#${buf.readUInt16LE(o)}`),
    mask,
    evs: picked.map((s) => `${each} ${s}`),
    nature: NATURES[buf[11]] || `#${buf[11]}`,
    item: buf.readUInt16LE(12) ? itemsByNum.get(buf.readUInt16LE(12)) || `#${buf.readUInt16LE(12)}` : '',
    form,
  };
}
function table(key, headerFile, indexFile, recordFile) {
  const headers = narc(file(headerFile));
  const lists = narc(file(indexFile));
  const records = narc(file(recordFile));
  return headers.map((h, i) => {
    const count = lists[i].readUInt16LE(2);
    const indices = Array.from({ length: count }, (_, k) => lists[i].readUInt16LE(4 + k * 2));
    const ace = h.readUInt16LE(4);
    return { member: i, header: h.toString('hex'), ace, indices, mons: indices.map((j) => record(records[j], `${key} #${i} record ${j}`)) };
  });
}
const WBT = {
  wbt1: table('wbt1', '/a/2/4/8', '/a/2/4/9', '/a/2/5/0'),
  wbt2: table('wbt2', '/a/2/5/1', '/a/2/5/2', '/a/2/5/3'),
  wbt3: table('wbt3', '/a/2/5/4', '/a/2/5/5', '/a/2/5/6'),
};

// --- Trainer table (/a/2/4/7) and name order ---------------------------------
// Rows 0-53 of the trainer table, in order; `null` marks rows not in our roster.
const ROWS = [
  'cheren', 'roxie', 'burgh', 'elesa', 'clay', 'skyla', 'drayden', 'marlon', null /* Bianca */, 'chili', 'cress', 'cilan', 'lenora', 'brycen',
  'blue', 'lance', 'steven', 'wallace', 'cynthia', 'alder',
  'brock', 'misty', 'ltsurge', 'erika', 'sabrina', 'blaine', 'giovanni',
  'falkner', 'bugsy', 'whitney', 'morty', 'chuck', 'jasmine', 'pryce', 'clair', 'janine',
  'roxanne', 'brawly', 'wattson', 'flannery', 'norman', 'winona', 'tate', 'liza', 'juan',
  'roark', 'gardenia', 'fantina', 'maylene', 'crasherwake', 'byron', 'candice', 'volkner', 'red',
];
const rows = narc(file('/a/2/4/7'))[0];
const row = (i) => rows.subarray(i * 16, i * 16 + 16);

const errors = [];
const teams = { regional: {}, world: {} };
for (const t of TRAINERS) {
  const id = ROWS.indexOf(t.id);
  if (id < 0) {
    errors.push(`${t.name}: no trainer-table row mapped`);
    continue;
  }
  const r = row(id);
  const priority = r[8] & 7;
  const ivs = r[8] >> 3;
  if (priority !== t.priority || ivs !== t.ivs) errors.push(`${t.name}: ROM row has priority ${priority} and IVs ${ivs}, trainers.mjs says ${t.priority}/${t.ivs}`);
  const leader = priority === 3;
  // Regional cups read wbt2; Champions, World Leaders and Type Expert read wbt3.
  const regional = (leader ? WBT.wbt2 : WBT.wbt3)[id + 1];
  if (!regional || regional.mons.length !== 6) errors.push(`${t.name}: no six-Pokémon party in ${leader ? 'wbt2' : 'wbt3'}`);
  else teams.regional[t.id] = regional.mons;
  if (leader) {
    const world = WBT.wbt3[id + 1];
    if (!world || world.mons.length !== 6) errors.push(`${t.name}: no six-Pokémon party in wbt3`);
    else teams.world[t.id] = world.mons;
  }
  // The ace flag and the header's record index must agree with trainers.mjs.
  const flagged = !!r[14];
  if (flagged !== !!t.ace) errors.push(`${t.name}: ROM ace flag is ${r[14]}, trainers.mjs says ace ${t.ace}`);
  for (const party of [regional, leader ? WBT.wbt3[id + 1] : null]) {
    if (!party || !flagged) continue;
    const pos = party.indices.indexOf(party.ace);
    const species = pos < 0 ? null : party.mons[pos].species;
    if (species !== t.ace) errors.push(`${t.name}: ROM ace record ${party.ace} is ${species}, trainers.mjs says ${t.ace}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

// --- Output ------------------------------------------------------------------
const line = (m) => `${m.species}${m.item ? ` @ ${m.item}` : ''} | ${m.moves.join(', ')} | | ${m.nature} | ${m.evs.length ? m.evs.join(' / ') : '0 HP'}`;
function teamFile(name, source, which) {
  const out = [
    `# Generated by scripts/import-rom.mjs from Pokémon Black 2 (${gameCode}); do not edit by hand.`,
    `# ${source}`,
    '# Species @ Item | Moves | Ability (blank = derived at build time; abilities are rolled in-game) | Nature | EVs',
    '',
  ];
  for (const t of TRAINERS) {
    const mons = teams[which][t.id];
    if (!mons) continue;
    out.push(`## ${t.id}`, ...mons.map(line), '');
  }
  fs.writeFileSync(path.join(root, 'data', name), out.join('\n'));
}
teamFile('pwt-teams.txt', 'Leaders: wbt2 party tables (/a/2/5/1-3), used by the regional Leaders cups. Champions: wbt3 (/a/2/5/4-6).', 'regional');
teamFile('pwt-world-teams.txt', 'Leaders: wbt3 party tables (/a/2/5/4-6), used by the World Leaders cup.', 'world');

// Reference dumps for the research addendum.
const docs = path.join(root, 'docs/rom');
fs.mkdirSync(docs, { recursive: true });
const names = ROWS.map((id) => (id ? TRAINERS.find((t) => t.id === id).name : 'Bianca'));
const nameOf = (i) => names[i] ?? `row ${i}`;
for (const [key, t] of Object.entries(WBT)) {
  const out = [`# ${key} party tables`, '', `Decoded from the retail ROM. Member N is trainer-table row N-1; member 0 is a dummy. Record indices refer to the ${key} Pokémon archive.`, ''];
  for (const tr of t) {
    if (!tr.member) continue;
    out.push(`## Member ${tr.member} (${nameOf(tr.member - 1)}) · header \`${tr.header}\` · ace record ${tr.ace} · records ${tr.indices.join(', ')}`, '');
    out.push('| # | Pokémon | Item | Moves | Nature | EV mask | EVs | Form |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    tr.mons.forEach((m, i) => out.push(`| ${tr.indices[i]} | ${m.species} | ${m.item || '—'} | ${m.moves.join(', ')} | ${m.nature} | 0x${m.mask.toString(16).padStart(2, '0')} | ${m.evs.join(' / ') || 'none'} | ${m.form} |`));
    out.push('');
  }
  fs.writeFileSync(path.join(docs, `${key}-parties.md`), out.join('\n'));
}
{
  const out = ['# WBT trainer table (/a/2/4/7)', '', '128 rows of 16 bytes. Columns as decoded here; see pwt-rom-addendum.md for the field notes.', '',
    '| Row | Name | Hex | Category (b0) | Female (b1) | Trainer id (u16 @2) | Class (b4) | Cup mask (b5) | Family (b6) | Type (b7) | Priority (b8 & 7) | IVs (b8 >> 3) | BGM (u16 @10) | u16 @12 | Ace leads (b14) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  const nameTable = fs.existsSync(path.join(root, 'docs/rom/names.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'docs/rom/names.json'), 'utf8')) : [];
  for (let i = 0; i < 128; i++) {
    const r = row(i);
    out.push(`| ${i} | ${nameTable[i] ?? nameOf(i)} | \`${r.toString('hex')}\` | ${r[0]} | ${r[1]} | ${r.readUInt16LE(2)} | ${r[4]} | 0x${r[5].toString(16).padStart(2, '0')} | ${r[6]} | ${r[7]} | ${r[8] & 7} | ${r[8] >> 3} | ${r.readUInt16LE(10)} | ${r.readUInt16LE(12)} | ${r[14]} |`);
  }
  fs.writeFileSync(path.join(docs, 'wbt-trainer-table.md'), out.join('\n') + '\n');
}
if (warnings.length) console.warn(warnings.join('\n'));
const count = (w) => Object.values(teams[w]).reduce((n, m) => n + m.length, 0);
console.log(`pwt-teams.txt: ${Object.keys(teams.regional).length} trainers, ${count('regional')} sets; pwt-world-teams.txt: ${Object.keys(teams.world).length} trainers, ${count('world')} sets; docs/rom/ updated`);
