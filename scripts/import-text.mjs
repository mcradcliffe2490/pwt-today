// Pulls the World Tournament dialogue out of the game's own text dump and
// writes data/pwt-text.json. Project Pokémon's RawDB hosts the English message
// files of Pokémon Black 2 as HTML:
//   https://projectpokemon.org/rawdb/black2/msg/407.php  trainer dialogue
//   https://projectpokemon.org/rawdb/black2/msg/406.php  announcer lines
// Download both and run: node scripts/import-text.mjs <407.html> <406.html>
//
// File 407 is 126 blocks of eight lines, one block per PWT trainer:
//   0-2 before the battle (round 1, semifinal, final), 3 after losing to the
//   player, 4 after beating the player, 5-6 in the lobby afterwards (lost/won),
//   7 the announcer's introduction. Blocks 0-52 are the 53 trainers listed in
//   the name table (Cheren through Volkner); Red's block is the last one, 125.
// File 406 holds the announcer's round openers (5-7) and the 25 result calls
// (8-32) that follow a match. VAR(256, n) is a trainer name, VAR(315, 0) the
// tournament name.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAINERS } from '../data/trainers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dialogueFile, announcerFile] = process.argv.slice(2);
if (!dialogueFile || !announcerFile) {
  console.error('usage: node scripts/import-text.mjs <msg407.html> <msg406.html>');
  process.exit(1);
}

const BLOCKS = {
  0: 'cheren', 1: 'roxie', 2: 'burgh', 3: 'elesa', 4: 'clay', 5: 'skyla', 6: 'drayden', 7: 'marlon',
  9: 'chili', 10: 'cress', 11: 'cilan', 12: 'lenora', 13: 'brycen', 14: 'blue', 15: 'lance', 16: 'steven',
  17: 'wallace', 18: 'cynthia', 19: 'alder', 20: 'brock', 21: 'misty', 22: 'ltsurge', 23: 'erika', 24: 'sabrina',
  25: 'blaine', 26: 'giovanni', 27: 'falkner', 28: 'bugsy', 29: 'whitney', 30: 'morty', 31: 'chuck', 32: 'jasmine',
  33: 'pryce', 34: 'clair', 35: 'janine', 36: 'roxanne', 37: 'brawly', 38: 'wattson', 39: 'flannery', 40: 'norman',
  41: 'winona', 42: 'tate', 43: 'liza', 44: 'juan', 45: 'roark', 46: 'gardenia', 47: 'fantina', 48: 'maylene',
  49: 'crasherwake', 50: 'byron', 51: 'candice', 52: 'volkner', 125: 'red',
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
const unescape = (s) => s.replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e[0] === '#' ? String.fromCodePoint(Number(e.slice(1))) : m));

// Returns the entries of one RawDB message page in order.
function entries(file) {
  const html = fs.readFileSync(file, 'utf8');
  return [...html.matchAll(/<p><a href='#entry(\d+)' name='entry\d+'># \S+<\/a> ([\s\S]*?)<\/p>/g)].map((m) =>
    unescape(m[2].replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')).trim(),
  );
}

// `\f` only clears the text box mid-sentence and line breaks are the box
// width; a blank line is a real paragraph break. Paragraphs are kept apart
// with a newline so the UI can show them one at a time.
const clean = (raw) =>
  raw
    .replace(/\\f/g, '')
    .split(/\n[ \t]*\n/)
    .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n')
    .replace(/ ?-- ?/g, '—');

const errors = [];
const dialogue = entries(dialogueFile);
if (dialogue.length !== 1008) errors.push(`expected 1008 dialogue entries, found ${dialogue.length}`);
const trainers = {};
for (const [block, id] of Object.entries(BLOCKS)) {
  const t = TRAINERS.find((x) => x.id === id);
  if (!t) continue; // Cheren's block is mapped for completeness; only roster trainers are kept
  const lines = dialogue.slice(block * 8, block * 8 + 8).map(clean);
  // The announcer line names the trainer (sometimes stretched: "Bluuue").
  const stretched = new RegExp(t.name.split('').map((c) => (/[a-z]/i.test(c) ? `${c}+` : c === ' ' ? ' ' : `\\${c}`)).join(''), 'i');
  // Morty's introduction ("The mystic seer of the future!") never says his name.
  if (id !== 'morty' && !stretched.test(lines[7])) errors.push(`${t.name}: block ${block} is introduced as "${lines[7]}"`);
  const lobby = (s) => s.replace(/^[^:\n]{1,20}: /, '');
  trainers[id] = {
    announce: lines[7],
    intro: [lines[0], lines[1], lines[2]],
    lose: lines[3],
    win: lines[4],
    lobbyLose: lobby(lines[5]),
    lobbyWin: lobby(lines[6]),
  };
}
for (const t of TRAINERS) if (!trainers[t.id]) errors.push(`${t.name}: no dialogue block mapped`);

const calls = entries(announcerFile);
if (calls.length !== 33) errors.push(`expected 33 announcer entries, found ${calls.length}`);
const name = (s, n) => clean(s).replace(new RegExp(`VAR\\(256, ${n}\\)`, 'g'), n ? '{b}' : '{a}');
const call = (i) => clean(calls[i]).replace(/VAR\(256, 0\)/g, '{w}');
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => call(a + i));
const announcer = {
  entered: clean(calls[1]),
  starts: clean(calls[2]).replace('VAR(315, 0)', '{cup}'),
  rounds: [name(calls[5], 0), name(calls[6], 0), name(calls[7], 0)].map((s) => s.replace('VAR(256, 1)', '{b}')),
  // Result calls, grouped by how one-sided the match was.
  calls: { rout: range(8, 12), clear: range(13, 19), close: range(20, 24), summit: range(25, 27), comeback: range(28, 31) },
};
for (const group of Object.values(announcer.calls)) for (const s of group) if (!s.includes('{w}')) errors.push(`call without a winner slot: ${s}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const out = {
  source: 'Pokémon Black 2 English text, Project Pokémon RawDB message files 407 (trainers) and 406 (announcer)',
  trainers,
  announcer,
};
fs.writeFileSync(path.join(root, 'data/pwt-text.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`pwt-text.json: ${Object.keys(trainers).length} trainers, ${Object.values(announcer.calls).flat().length} result calls`);
