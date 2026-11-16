// Turns a Pokémon Showdown protocol log into narration events the battle
// screen replays one at a time. Each event is { text, kind, snap } plus
// optional presentation hints: `speaker`/`line` for the dialogue box and
// `fx`/`who` for the trainer and Poké Ball animations.
//
// kinds: msg (default), quiet (no pause), turn (separator), switch, faint,
// end (battle over), call (announcer).
import { toID } from '@pkmn/sim';
import pool from '../data/pool.json';
import { snapshotOf } from '../lib/snapshot.js';

const ANNOUNCER = pool.announcer;
const ROUND_TITLES = ['Round 1', 'Semifinal', 'Final'];

// Fills a result call's {w} with the winner. The game inserts the player's
// name; addressing the player as "you" needs the verbs adjusted.
export function fillCall(line, name) {
  if (name !== null) return line.replaceAll('{w}', name);
  return line
    .replace(/\{w\} was\b/g, 'you were')
    .replace(/\{w\} has\b/g, 'you have')
    .replace(/Was \{w\}/g, 'Were you')
    .replace(/\{w\}'s/g, 'your')
    .replaceAll('{w}', 'you')
    .replace(/(^|[.!?] )you(r?)\b/g, (m, p, r) => `${p}You${r}`);
}

// Picks the announcer's call for a finished match from how much the winner
// had left; winning the final always gets the "summit" lines.
export function resultCall(winner, summit, random) {
  const alive = winner.filter((m) => m.hp > 0).length;
  const hp = winner.reduce((n, m) => n + m.hp, 0) / winner.reduce((n, m) => n + m.max, 0);
  const group = summit
    ? 'summit'
    : alive === winner.length && hp >= 0.6
      ? 'rout'
      : alive >= 2 && hp >= 0.35
        ? 'clear'
        : hp >= 0.15
          ? 'close'
          : 'comeback';
  const lines = ANNOUNCER.calls[group];
  return lines[Math.floor(random() * lines.length)];
}

const STATUS = { par: 'paralyzed', brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', slp: 'asleep', frz: 'frozen' };
const CURED = {
  slp: 'woke up!',
  par: 'was cured of paralysis!',
  brn: "'s burn was healed!",
  psn: 'was cured of its poisoning!',
  tox: 'was cured of its poisoning!',
  frz: 'thawed out!',
};
const STAT = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasiveness' };
const BOOST_VERB = ['', 'rose!', 'rose sharply!', 'rose drastically!'];
const DROP_VERB = ['', 'fell!', 'harshly fell!', 'severely fell!'];
const WEATHER = {
  sandstorm: ['A sandstorm kicked up!', 'The sandstorm rages.'],
  raindance: ['It started to rain!', 'Rain continues to fall.'],
  sunnyday: ['The sunlight turned harsh!', 'The sunlight is strong.'],
  hail: ['It started to hail!', 'Hail continues to fall.'],
};
// Side conditions: [start, end]; {s} is "your team" or "BROCK's team", {S} the possessive.
const SIDE = {
  stealthrock: ['Pointed stones float in the air around {s}!', 'The pointed stones disappeared from around {s}.'],
  spikes: ['Spikes were scattered all around {s}!', 'The spikes disappeared from around {s}.'],
  toxicspikes: ['Poison spikes were scattered all around {s}!', 'The poison spikes disappeared from around {s}.'],
  reflect: ['Reflect raised {S} Defense!', '{S} Reflect wore off!'],
  lightscreen: ['Light Screen raised {S} Sp. Def!', '{S} Light Screen wore off!'],
  safeguard: ['{s} became cloaked in a mystical veil!', '{s} is no longer protected by Safeguard!'],
};
// Volatile conditions: [start, end].
const VOLATILE = {
  confusion: ['{m} became confused!', '{m} snapped out of its confusion!'],
  substitute: ['{m} put in a substitute!', "{m}'s substitute faded!"],
  leechseed: ['{m} was seeded!', '{m} was freed from Leech Seed!'],
  encore: ['{m} received an encore!', "{m}'s encore ended!"],
  taunt: ['{m} fell for the taunt!', "{m}'s taunt wore off!"],
  disable: ["{m}'s {x} was disabled!", '{m} is no longer disabled!'],
  attract: ['{m} fell in love!', '{m} got over its infatuation!'],
  yawn: ['{m} grew drowsy!'],
  curse: ['{m} was cursed!'],
  focusenergy: ['{m} is getting pumped!'],
  magnetrise: ['{m} levitated with electromagnetism!', "{m}'s electromagnetism wore off!"],
  torment: ['{m} was subjected to torment!'],
  perish3: ['All Pokémon that heard the song will faint in three turns!'],
  typechange: ['{m} transformed into the {x} type!'],
};
const CANT = {
  slp: '{m} is fast asleep.',
  par: "{m} is paralyzed! It can't move!",
  frz: '{m} is frozen solid!',
  flinch: "{m} flinched and couldn't move!",
  recharge: '{m} must recharge!',
  truant: '{m} is loafing around!',
  taunt: "{m} can't use {x} after the taunt!",
  attract: '{m} is immobilized by love!',
  nopp: '{m} has no PP left for {x}!',
};
const PREPARE = {
  bounce: '{m} sprang up!',
  fly: '{m} flew up high!',
  dig: '{m} burrowed its way under the ground!',
  dive: '{m} hid underwater!',
  skyattack: '{m} became cloaked in a harsh light!',
  solarbeam: '{m} absorbed light!',
};
const ITEM_USED = {
  airballoon: "{m}'s Air Balloon popped!",
  focussash: '{m} hung on using its Focus Sash!',
  lumberry: "{m}'s Lum Berry cured it!",
  whiteherb: '{m} returned its stats to normal using its White Herb!',
  chestoberry: "{m}'s Chesto Berry woke it up!",
  sitrusberry: '{m} restored HP using its Sitrus Berry!',
};
const DAMAGE_FROM = {
  'item: Life Orb': '{m} lost some of its HP from its Life Orb.',
  'item: Black Sludge': '{m} is hurt by its Black Sludge!',
  'item: Rocky Helmet': '{m} is hurt by the Rocky Helmet!',
  Recoil: '{m} is damaged by recoil!',
  Sandstorm: '{m} is buffeted by the sandstorm!',
  Hail: '{m} is buffeted by the hail!',
  psn: '{m} is hurt by poison!',
  tox: '{m} is hurt by poison!',
  brn: '{m} is hurt by its burn!',
  'Stealth Rock': '{m} is hurt by the pointed stones!',
  Spikes: '{m} is hurt by the spikes!',
  'Leech Seed': "{m}'s health is sapped by Leech Seed!",
  confusion: '{m} hurt itself in its confusion!',
  'ability: Rough Skin': '{m} is hurt by Rough Skin!',
  'ability: Iron Barbs': '{m} is hurt by Iron Barbs!',
  'ability: Aftermath': '{m} is hurt by Aftermath!',
  'ability: Liquid Ooze': '{m} sucked up liquid ooze!',
  Curse: '{m} is afflicted by the curse!',
  'move: Nightmare': '{m} is locked in a nightmare!',
  Substitute: 'The substitute took damage for {m}!',
};
const HEAL_FROM = {
  'item: Leftovers': '{m} restored a little HP using its Leftovers!',
  'item: Black Sludge': '{m} restored a little HP using its Black Sludge!',
  drain: '{m} had its energy drained!',
  'ability: Poison Heal': '{m} restored HP using Poison Heal!',
  'ability: Water Absorb': '{m} restored HP with Water Absorb!',
  'ability: Volt Absorb': '{m} restored HP with Volt Absorb!',
  'ability: Ice Body': '{m} restored HP with Ice Body!',
  'ability: Rain Dish': '{m} restored HP with Rain Dish!',
  'move: Wish': "{m}'s wish came true!",
  'move: Leech Seed': '{m} absorbed HP from Leech Seed!',
  'move: Aqua Ring': '{m} restored HP with Aqua Ring!',
};
const ACTIVATE = {
  protect: '{m} protected itself!',
  substitute: 'The substitute took damage for {m}!',
  confusion: '{m} is confused!',
  struggle: '{m} has no moves left!',
  sturdy: '{m} endured the hit!',
};

const fill = (text, m, x = '') => text.replace('{m}', m).replace('{x}', x);
const bare = (s) => s.replace(/^(move|ability|item): /, '');
const paragraphs = (text) => String(text ?? '').split('\n').filter(Boolean);
const fromTag = (parts) => parts.find((p) => p.startsWith('[from]'))?.slice(6).trim() || '';
// A survivor never reads as having lost all of its HP.
const percentLost = (prev, hp, max) => {
  const pct = Math.max(1, Math.round(((prev - hp) / max) * 100));
  return hp > 0 ? Math.min(99, pct) : pct;
};
const applyHp = (mon, text) => {
  const [hpPart, status] = text.split(' ');
  const [hp, max] = hpPart.split('/').map(Number);
  mon.hp = hp || 0;
  if (max) mon.max = max;
  mon.status = status === 'fnt' ? '' : status;
};

// One handler per protocol command. `o` is the narration in progress; `t` the
// target of the line (side, index, label), `m` its snapshot entry when known.
const HANDLERS = {
  start(o) {
    const round = Math.min(o.round ?? 0, ROUND_TITLES.length - 1);
    const q = o.trainer.quotes || {};
    o.opening = true;
    if (o.round !== undefined)
      o.say(`Announcer: ${ANNOUNCER.rounds[round].replace('{a}', 'You').replace('{b}', o.trainer.name)}`, 'call', { fx: 'trainer-in' });
    if (q.announce) o.say(`Announcer: ${q.announce}`, 'call', { fx: 'trainer-in' });
    // Older journals carry a single intro string.
    for (const p of paragraphs(Array.isArray(q.intro) ? q.intro[round] : q.intro)) o.speak(p, 'msg', 'trainer-in');
    o.say(`${o.trainer.name} wants to battle!`, 'msg', { fx: 'trainer-in' });
  },
  turn(o, t, m, [a]) {
    o.snap.turn = Number(a);
    if (o.snap.turn > 1) o.say(`Turn ${o.snap.turn}`, 'turn');
  },
  switch(o, t, m, [, , hp], cmd) {
    if (t.index < 0) return;
    o.snap[t.side === 'p' ? 'pa' : 'ra'] = t.index;
    applyHp(m, hp);
    m.boosts = {};
    const foe = t.side === 'r';
    // Every foe send-out is a Poké Ball throw; the opening one also sends the trainer off.
    o.say(foe ? `${o.trainer.name} sent out ${t.name}!` : `Go! ${t.name}!`, 'switch', foe && cmd === 'switch' ? { fx: 'throw', opening: o.opening } : undefined);
    if (foe) o.opening = false;
  },
  drag: (o, t, m, args) => HANDLERS.switch(o, t, m, args, 'drag'),
  move: (o, t, m, [, move]) => o.say(`${t.label} used ${move}!`),
  '-damage'(o, t, m, [, hp], cmd, parts) {
    if (!m) return;
    const prev = m.hp;
    applyHp(m, hp);
    const text = DAMAGE_FROM[fromTag(parts)];
    o.say(text ? fill(text, t.label) : `${t.label} lost ${percentLost(prev, m.hp, m.max)}% of its HP.`, 'quiet');
  },
  '-heal'(o, t, m, [, hp], cmd, parts) {
    if (!m) return;
    applyHp(m, hp);
    const text = HEAL_FROM[fromTag(parts)];
    o.say(text ? fill(text, t.label) : `${t.label} regained health!`, 'quiet');
  },
  '-sethp'(o, t, m, [, hp]) {
    if (m) m.hp = Number(hp.split(' ')[0].split('/')[0]) || 0;
    o.say('The battlers shared their pain!', 'quiet');
  },
  '-supereffective': (o) => o.say("It's super effective!"),
  '-resisted': (o) => o.say("It's not very effective…"),
  '-immune': (o, t) => o.say(`It doesn't affect ${t.label}…`),
  '-crit': (o) => o.say('A critical hit!'),
  '-miss': (o, t) => o.say(`${t.label}'s attack missed!`),
  '-hitcount': (o, t, m, [, n]) => o.say(`Hit ${n} time${n === '1' ? '' : 's'}!`),
  '-ohko': (o) => o.say("It's a one-hit KO!"),
  faint(o, t, m) {
    if (m) m.hp = 0;
    o.say(`${t.label} fainted!`, 'faint');
  },
  '-status'(o, t, m, [, status]) {
    if (m) m.status = status;
    o.say(`${t.label} is ${STATUS[status] || status}!`);
  },
  '-curestatus'(o, t, m, [, status]) {
    if (m) m.status = '';
    o.say(CURED[status] ? `${t.label} ${CURED[status]}` : `${t.label} recovered from ${status}!`);
  },
  '-cureteam': (o) => o.say('A bell chimed!'),
  '-boost'(o, t, m, [, stat, n], cmd) {
    const amount = Number(n);
    const up = cmd === '-boost';
    if (m) m.boosts[stat] = (m.boosts[stat] || 0) + (up ? amount : -amount);
    o.say(`${t.label}'s ${STAT[stat] || stat} ${(up ? BOOST_VERB : DROP_VERB)[Math.min(3, amount)]}`);
  },
  '-unboost': (o, t, m, args) => HANDLERS['-boost'](o, t, m, args, '-unboost'),
  '-setboost'(o, t, m, [, stat, n]) {
    if (m) m.boosts[stat] = Number(n);
    o.say(`${t.label}'s ${STAT[stat] || stat} was maximized!`);
  },
  '-clearboost'(o, t, m) {
    if (m) m.boosts = {};
    o.say(`${t.label}'s stat changes were removed!`);
  },
  '-clearnegativeboost'(o, t, m) {
    if (m) m.boosts = Object.fromEntries(Object.entries(m.boosts).filter(([, v]) => v > 0));
    o.say(`${t.label}'s stats returned to normal!`);
  },
  '-clearallboost'(o) {
    for (const side of ['p', 'r']) for (const mon of o.snap[side]) mon.boosts = {};
    o.say('All stat changes were eliminated!');
  },
  cant(o, t, m, [, reason, move]) {
    const text = CANT[toID(bare(reason))];
    o.say(text ? fill(text, t.label, move) : `${t.label} can't move!`);
  },
  '-fail': (o, t, m, [, what]) => o.say(what === 'unboost' ? `${t.label}'s stats were not lowered!` : 'But it failed!'),
  '-block': (o, t, m, [, by]) => o.say(`${t.label} was blocked by ${bare(by)}!`),
  '-notarget': (o) => o.say('But there was no target…'),
  '-nothing': (o) => o.say('But nothing happened!'),
  '-ability': (o, t, m, [, ability]) => o.say(`${t.label}'s ${ability}!`),
  '-start'(o, t, m, [, what, x]) {
    const text = VOLATILE[toID(bare(what))]?.[0];
    o.say(text ? fill(text, t.label, x) : `${t.label}: ${bare(what)} started.`);
  },
  '-end'(o, t, m, [, what, x]) {
    const text = VOLATILE[toID(bare(what))]?.[1];
    o.say(text ? fill(text, t.label, x) : `${t.label}: ${bare(what)} ended.`);
  },
  '-singleturn': (o, t, m, [, what]) => o.say(toID(bare(what)) === 'protect' ? `${t.label} protected itself!` : `${t.label}: ${bare(what)}.`),
  '-singlemove': (o, t, m, [, what]) => o.say(`${t.label}: ${bare(what)}.`),
  '-prepare'(o, t, m, [, move]) {
    const text = PREPARE[toID(move)];
    o.say(text ? fill(text, t.label) : `${t.label} is getting ready to use ${move}!`);
  },
  '-mustrecharge': (o, t) => o.say(`${t.label} must recharge!`),
  '-weather'(o, t, m, [weather], cmd, parts) {
    const id = toID(weather);
    if (id === 'none') o.say('The weather cleared.');
    else if (parts.includes('[upkeep]')) o.say(WEATHER[id]?.[1] || `The weather is ${weather}.`, 'quiet');
    else o.say(WEATHER[id]?.[0] || `The weather is ${weather}.`);
  },
  '-sidestart'(o, t, m, [side, what]) {
    const text = SIDE[toID(bare(what))]?.[0];
    o.say(text ? o.sideFill(text, side) : `${bare(what)} started around ${o.sideFill('{s}', side)}.`);
  },
  '-sideend'(o, t, m, [side, what]) {
    const text = SIDE[toID(bare(what))]?.[1];
    o.say(text ? o.sideFill(text, side) : `${bare(what)} ended around ${o.sideFill('{s}', side)}.`);
  },
  '-fieldstart': (o, t, m, [what]) => o.say(`${bare(what)} began!`),
  '-fieldend': (o, t, m, [what]) => o.say(`${bare(what)} ended.`),
  '-fieldactivate': (o, t, m, [what]) => o.say(`${bare(what)}!`),
  '-activate'(o, t, m, [, what]) {
    const id = toID(bare(what));
    o.say(ACTIVATE[id] ? fill(ACTIVATE[id], t.label) : `${t.label}: ${bare(what)}.`, id === 'substitute' ? 'quiet' : 'msg');
  },
  '-item': (o, t, m, [, item]) => o.say(toID(item) === 'airballoon' ? `${t.label} floats in the air with its Air Balloon!` : `${t.label} obtained ${item}.`),
  '-enditem'(o, t, m, [, item]) {
    const text = ITEM_USED[toID(item)];
    o.say(text ? fill(text, t.label) : `${t.label} used its ${item}!`);
  },
  '-message': (o, t, m, [text]) => o.say(text),
  win(o, t, m, [winner]) {
    const q = o.trainer.quotes || {};
    if (winner === 'Player') {
      o.say(`You defeated ${o.trainer.name}!`, 'end', { fx: 'trainer-back' });
      for (const p of paragraphs(q.lose)) o.speak(p, 'end', 'trainer-back');
      if (o.call) o.say(`Announcer: ${o.call}`, 'call');
      o.say(o.next ? `${ROUND_TITLES[o.next.round - 1] || `Round ${o.next.round}`}: ${o.next.name} steps up.` : 'You won the tournament!', 'end');
    } else {
      o.say('You have no more Pokémon that can fight!', 'end');
      for (const p of paragraphs(q.win)) o.speak(p, 'end', 'trainer-back');
      if (o.call) o.say(`Announcer: ${o.call}`, 'call');
      o.say('You were knocked out of the tournament.', 'end');
    }
  },
  tie: (o) => o.say('The battle ended in a draw.', 'end'),
};

// `before`/`after` are engine states; `ctx` = { trainer, round, next, call, final }.
export function narrate(lines, before, after, ctx) {
  const owner = ctx.trainer.name.toUpperCase();
  const who = { id: ctx.trainer.id, name: ctx.trainer.name, sprite: ctx.trainer.sprite };
  const events = [];
  const o = {
    ...ctx,
    snap: snapshotOf(before),
    opening: false,
    say(text, kind = 'msg', extra) {
      events.push({ text, kind, snap: structuredClone(o.snap), ...extra, ...(extra?.fx && { who }) });
    },
    speak(line, kind, fx) {
      o.say(`${owner}: ${line}`, kind, { speaker: ctx.trainer.name, line, ...(fx && { fx }) });
    },
    sideFill(text, ident) {
      const foe = ident.startsWith('p2');
      return text.replace('{s}', foe ? `${owner}'s team` : 'your team').replace('{S}', foe ? `${owner}'s team's` : "your team's");
    },
  };
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // |split| is followed by the private line then the public one; take the private.
    if (line.startsWith('|split|')) line = lines[(i += 2) - 1];
    const parts = line.split('|');
    const [, cmd, ...args] = parts;
    const handler = HANDLERS[cmd];
    if (!handler) continue;
    const ident = args[0] || '';
    const side = ident.startsWith('p2') ? 'r' : 'p';
    const name = ident.slice(ident.indexOf(':') + 1).trim();
    const index = after[side].findIndex((mon) => mon.name === name);
    const target = { side, index, name, label: side === 'r' ? `${owner}'s ${name}` : name };
    handler(o, target, o.snap[side][index], args, cmd, parts);
  }
  events.push({ text: '', kind: 'quiet', snap: snapshotOf(ctx.final || after) });
  return events;
}
