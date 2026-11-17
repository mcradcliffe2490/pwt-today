import { describe, expect, it } from 'vitest';
import { TournamentEngine } from '../src/battle/engine.js';
import { fillCall, resultCall } from '../src/battle/narrate.js';
import { CUPS, FIELD, PLAYERS, ROUNDS, TEAM_SIZE, TRAINERS, dailyBracket, dailyTeam, dailyTournament } from '../src/lib/bracket.js';
import { puzzleNumber } from '../src/lib/date.js';
import { shareText } from '../src/lib/share.js';

// Plays a run to the end: first usable move, first legal switch when forced,
// first healthy Pokémon as the lead of each new round.
function autoplay(engine, limit = 600) {
  let { s } = engine.initial();
  const actions = [];
  for (let i = 0; i < limit && !s.outcome; i++) {
    let action;
    if (s.needLead) action = { type: 'lead', idx: s.p.findIndex((m) => m.hp > 0) };
    else if (s.needSwitch) action = { type: 'switch', idx: s.switches[0] };
    else {
      const mon = s.p[s.pa];
      const idx = mon.struggle ? -1 : mon.moves.findIndex((m) => m.pp > 0 && !m.disabled);
      action = { type: 'move', idx };
    }
    const r = engine.choose(action);
    expect(r.error).toBeUndefined();
    actions.push(action);
    s = r.s;
  }
  return { s, actions };
}

const setupFor = (date) => ({ team: dailyTeam(date), lead: 0, seed: date, bracket: dailyBracket(date) });

describe('daily draw', () => {
  it('gives three distinct Pokémon, the same for the same date', () => {
    const a = dailyTeam('2026-11-17');
    expect(a).toHaveLength(TEAM_SIZE);
    expect(new Set(a.map((m) => m.name)).size).toBe(TEAM_SIZE);
    expect(a.map((m) => m.name)).toEqual(dailyTeam('2026-11-17').map((m) => m.name));
    expect(dailyTeam('2026-11-18').map((m) => m.name)).not.toEqual(a.map((m) => m.name));
  });

  it('builds a bracket of three distinct trainers with three of their own Pokémon each', () => {
    const b = dailyBracket('2026-11-17');
    expect(b).toHaveLength(ROUNDS);
    expect(new Set(b.map((t) => t.id)).size).toBe(ROUNDS);
    for (const t of b) {
      const own = TRAINERS.find((x) => x.id === t.id);
      expect(t.team).toHaveLength(TEAM_SIZE);
      expect(new Set(t.team.map((m) => m.name)).size).toBe(TEAM_SIZE);
      for (const m of t.team) expect((t.roster === 'world' ? own.world : own.pool).map((p) => p.name)).toContain(m.name);
    }
    expect(dailyBracket('2026-11-17').map((t) => t.id)).toEqual(b.map((t) => t.id));
  });

  it('draws an eight-slot field from one cup and settles the NPC matches by the PWT rule', () => {
    const days = Array.from({ length: 120 }, (_, i) => new Date(Date.UTC(2026, 10, 10 + i)).toISOString().slice(0, 10));
    const cups = new Set();
    for (const date of days) {
      const t = dailyTournament(date);
      const cup = CUPS.find((c) => c.id === t.cup.id);
      cups.add(cup.id);
      expect(t.field).toHaveLength(FIELD);
      expect(t.field.filter((s) => s.player)).toHaveLength(1);
      expect(t.field[t.playerPos].player).toBe(true);
      const npcs = t.field.filter((s) => !s.player);
      expect(new Set(npcs.map((s) => s.id)).size).toBe(FIELD - 1);
      for (const s of npcs) expect(cup.pool.map((p) => p.id)).toContain(s.id);
      // Round 1 is the player's pair; later rounds are the simulated winners on the player's path.
      expect(t.bracket[0].id).toBe(t.field[t.playerPos ^ 1].id);
      expect(t.bracket[1].id).toBe(t.field[t.r1[(t.playerPos >> 1) ^ 1].winner].id);
      expect(t.bracket[2].id).toBe(t.field[t.sf[(t.playerPos >> 2) ^ 1].winner].id);
      for (const m of [...t.r1, ...t.sf]) {
        expect([m.a, m.b]).toContain(m.winner);
        const npcOnly = !t.field[m.a].player && !t.field[m.b].player;
        if (npcOnly) expect(cup.id === 'champions' ? [50] : [30, 50, 70]).toContain(m.odds);
        else expect(t.field[m.winner].player).toBe(true);
      }
      for (const trainer of t.bracket) {
        expect(trainer.roster).toBe(cup.roster);
        if (trainer.ace) expect(trainer.team[0].name).toBe(trainer.ace);
        expect(new Set(trainer.team.map((m) => m.item)).size).toBe(TEAM_SIZE);
        expect(new Set(trainer.team[0].ivs)).toEqual(new Set([trainer.ivs]));
      }
    }
    expect(cups.size).toBe(CUPS.length);
  });

  it("uses the ROM's natures and EV spreads", () => {
    const by = (id) => TRAINERS.find((t) => t.id === id);
    const onix = by('brock').pool.find((m) => m.name === 'Onix');
    expect(onix.nature).toBe('Jolly');
    expect(onix.evs).toEqual([255, 0, 0, 0, 0, 255]);
    const pikachu = by('red').pool.find((m) => m.name === 'Pikachu');
    expect(pikachu.nature).toBe('Jolly');
    expect(pikachu.evs).toEqual([0, 255, 0, 0, 0, 255]);
    // Unova Leaders' regional-cup parties carry no EVs at all; their World Leaders parties do.
    for (const m of by('cheren').pool) expect(m.evs).toEqual([0, 0, 0, 0, 0, 0]);
    expect(by('cheren').world.some((m) => m.evs.some((v) => v > 0))).toBe(true);
    // Multi-stat masks split 510 evenly.
    const ttar = by('brock').world.find((m) => m.name === 'Tyranitar');
    expect(ttar.evs).toEqual([127, 127, 0, 127, 127, 0]);
    expect(by('wattson').world.find((m) => m.name === 'Rotom-Wash')).toBeTruthy();
  });

  it('gives Leaders 20 IVs, Champions 25 and Red 30', () => {
    for (const t of TRAINERS) {
      const expected = t.id === 'red' ? 30 : t.priority === 4 ? 25 : 20;
      expect(t.ivs).toBe(expected);
      for (const m of [...t.pool, ...(t.world || [])]) expect(m.ivs).toEqual(Array(6).fill(expected));
      if (t.priority === 3) expect(t.world).toHaveLength(6);
      else expect(t.world).toBeUndefined();
    }
  });

  it("gives every trainer the game's own dialogue", () => {
    for (const t of TRAINERS) {
      const q = t.quotes;
      expect(q.intro).toHaveLength(3);
      for (const k of ['announce', 'lose', 'win', 'lobbyLose', 'lobbyWin']) expect(q[k].length, `${t.name} ${k}`).toBeGreaterThan(0);
      if (t.id !== 'morty') expect(q.announce.replace(/(.)\1+/g, '$1')).toContain(t.name.replace(/(.)\1+/g, '$1'));
      expect(q.lobbyLose.startsWith(`${t.name}:`)).toBe(false);
    }
    expect(TRAINERS.find((t) => t.id === 'brock').quotes.announce).toBe('The rock-solid Pokémon Trainer, Brock, is ready to rock!');
    expect(TRAINERS.find((t) => t.id === 'red').quotes.intro).toEqual(['...', '...', '...']);
  });

  it("addresses the announcer's result calls to the winner", () => {
    expect(fillCall('{w} was never in any danger. It was an extremely easy victory!', null)).toBe('You were never in any danger. It was an extremely easy victory!');
    expect(fillCall("This battle will go down in history! {w}'s name will be renowned!", null)).toBe('This battle will go down in history! Your name will be renowned!');
    expect(fillCall('{w} turned the tide and won! Well done, {w}!', 'Brock')).toBe('Brock turned the tide and won! Well done, Brock!');
    const full = [{ hp: 100, max: 100 }, { hp: 100, max: 100 }, { hp: 100, max: 100 }];
    const scraped = [{ hp: 5, max: 100 }, { hp: 0, max: 100 }, { hp: 0, max: 100 }];
    expect(resultCall(full, false, () => 0)).toBe('That was a lopsided battle! The winner is {w}!');
    expect(resultCall(scraped, false, () => 0)).toBe('What a come-from-behind victory! {w} beat the opponent!');
    expect(resultCall(scraped, true, () => 0)).toBe('Is this the showdown at the summit? {w}. Who is this person?!');
  });

  it('numbers puzzles from the launch date', () => {
    expect(puzzleNumber('2026-11-10')).toBe(1);
    expect(puzzleNumber('2026-11-15')).toBe(6);
  });

  it('every set carries four moves with data and a full stat block', () => {
    // Cilan's regional Jumpluff has Cotton Spore in two slots in the game data, so it keeps three moves.
    const three = TRAINERS.find((t) => t.id === 'cilan').pool.find((m) => m.name === 'Jumpluff');
    expect(three.moves.map((m) => m.name)).toEqual(['Leech Seed', 'Cotton Spore', 'Sleep Powder']);
    for (const mon of [...PLAYERS, ...TRAINERS.flatMap((t) => [...t.pool, ...(t.world || [])])]) {
      expect(mon.moves).toHaveLength(mon === three ? 3 : 4);
      for (const m of mon.moves) expect(m.data.type).toBeTruthy();
      expect(mon.max).toBeGreaterThan(0);
      expect(mon.dexno).toBeGreaterThan(0);
    }
  });
});

describe('tournament engine', () => {
  const date = '2026-11-17';

  it('opens round 1 with the chosen lead against the first trainer', () => {
    const setup = { ...setupFor(date), lead: 2 };
    const engine = new TournamentEngine(setup);
    const { s, ev } = engine.initial();
    expect(s.round).toBe(1);
    expect(s.trainer.name).toBe(setup.bracket[0].name);
    expect(s.p[s.pa].name).toBe(setup.team[2].name);
    expect(s.r[s.ra].name).toBe(setup.bracket[0].team[0].name);
    const texts = ev.map((e) => e.text);
    expect(texts).toContain(`${setup.bracket[0].name} wants to battle!`);
    const q = setup.bracket[0].quotes;
    expect(texts).toContain(`Announcer: The first round... You vs. ${setup.bracket[0].name}!`);
    expect(texts).toContain(`Announcer: ${q.announce}`);
    expect(texts).toContain(`${setup.bracket[0].name.toUpperCase()}: ${q.intro[0].split('\n')[0]}`);
  });

  it('cues the trainer on, the Poké Ball throw and the trainer back', () => {
    const setup = setupFor(date);
    const { ev } = new TournamentEngine(setup).initial();
    const fx = ev.filter((e) => e.fx);
    expect(fx[0].fx).toBe('trainer-in');
    expect(fx[0].who).toEqual({ id: setup.bracket[0].id, name: setup.bracket[0].name, sprite: setup.bracket[0].sprite });
    const intro = ev.filter((e) => e.speaker);
    expect(intro.length).toBeGreaterThan(0);
    expect(intro.every((e) => e.speaker === setup.bracket[0].name && e.text.endsWith(e.line))).toBe(true);
    const throws = ev.filter((e) => e.fx === 'throw');
    expect(throws).toHaveLength(1);
    expect(throws[0].opening).toBe(true);
    expect(throws[0].text).toBe(`${setup.bracket[0].name} sent out ${setup.bracket[0].team[0].name}!`);
    // Everything before the throw keeps the trainer on the field.
    expect(ev.slice(0, ev.indexOf(throws[0])).filter((e) => e.fx).every((e) => e.fx === 'trainer-in')).toBe(true);

    const { actions } = autoplay(new TournamentEngine(setup));
    const engine = new TournamentEngine({ ...setup, actions: actions.slice(0, -1) });
    const last = engine.choose(actions.at(-1)).ev;
    expect(last.some((e) => e.fx === 'trainer-back' && e.speaker)).toBe(true);
  });

  it("keeps the finished round's Pokémon on screen until the hand-off to the next trainer", () => {
    for (let d = 10; d < 40; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`;
      const setup = setupFor(day);
      const engine = new TournamentEngine(setup);
      let { s } = engine.initial();
      let last = [];
      for (let i = 0; i < 400 && !s.outcome && !s.needLead; i++) {
        const mon = s.p[s.pa];
        const action = s.needSwitch
          ? { type: 'switch', idx: s.switches[0] }
          : { type: 'move', idx: mon.struggle ? -1 : mon.moves.findIndex((m) => m.pp > 0 && !m.disabled) };
        const r = engine.choose(action);
        s = r.s;
        last = r.ev;
      }
      if (!s.needLead) continue;
      // The engine has moved on: its state already holds the next trainer's team.
      expect(s.r.map((m) => m.name)).toEqual(setup.bracket[1].team.map((m) => m.name));
      const finished = setup.bracket[0].team.map((m) => m.name);
      const snaps = last.filter((e) => e.snap).map((e) => e.snap);
      for (const snap of snaps.slice(0, -1)) expect(snap.r.map((m) => m.name)).toEqual(finished);
      expect(snaps.at(-1).r.map((m) => m.name)).toEqual(setup.bracket[1].team.map((m) => m.name));
      return;
    }
    throw Error('no autoplay run won a round');
  });

  it("ends every match with the announcer's call and the trainer's line", () => {
    const { s, actions } = autoplay(new TournamentEngine(setupFor(date)));
    const engine = new TournamentEngine({ ...setupFor(date), actions: actions.slice(0, -1) });
    const { ev } = engine.choose(actions.at(-1));
    const calls = ev.filter((e) => e.kind === 'call' && !e.text.includes(' round... '));
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const t = s.history.at(-1);
    const q = TRAINERS.find((x) => x.id === t.id).quotes;
    expect(ev.map((e) => e.text)).toContain(`${t.name.toUpperCase()}: ${(t.won ? q.lose : q.win).split('\n')[0]}`);
    if (t.won) expect(calls[0].text).toMatch(/^Announcer: .*\b[Yy]ou/);
    else expect(calls[0].text).toContain(t.name);
  });

  it('plays a full run to an outcome and records each round', () => {
    const { s } = autoplay(new TournamentEngine(setupFor(date)));
    expect(['won', 'lost']).toContain(s.outcome);
    expect(s.history.length).toBeGreaterThan(0);
    expect(s.history.every((h) => h.rDown.length === TEAM_SIZE)).toBe(true);
    if (s.outcome === 'won') expect(s.history.map((h) => h.won)).toEqual([true, true, true]);
    else expect(s.history.at(-1).won).toBe(false);
  });

  it('heals the party and switches opponents between rounds', () => {
    // Find a date whose autoplay wins at least one round.
    for (let d = 10; d < 40; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`;
      const engine = new TournamentEngine(setupFor(day));
      let { s } = engine.initial();
      for (let i = 0; i < 400 && !s.outcome && !s.needLead; i++) {
        const mon = s.p[s.pa];
        const action = s.needSwitch
          ? { type: 'switch', idx: s.switches[0] }
          : { type: 'move', idx: mon.struggle ? -1 : mon.moves.findIndex((m) => m.pp > 0 && !m.disabled) };
        s = engine.choose(action).s;
      }
      if (!s.needLead) continue;
      expect(s.phase).toBe('between');
      expect(s.round).toBe(2);
      expect(s.trainer.name).toBe(dailyBracket(day)[1].name);
      expect(s.p.every((m) => m.hp === m.max && !m.status)).toBe(true);
      expect(engine.choose({ type: 'move', idx: 0 }).error).toBeTruthy();
      const r = engine.choose({ type: 'lead', idx: 1 });
      expect(r.error).toBeUndefined();
      expect(r.s.phase).toBe('battle');
      expect(r.s.p[r.s.pa].name).toBe(dailyTeam(day)[1].name);
      expect(r.s.p.every((m) => m.hp === m.max)).toBe(true);
      const texts = r.ev.map((e) => e.text);
      expect(texts).toContain(`${dailyBracket(day)[1].name} wants to battle!`);
      expect(texts).toContain(`Announcer: The second round... You vs. ${dailyBracket(day)[1].name}!`);
      expect(texts).toContain(`${dailyBracket(day)[1].name.toUpperCase()}: ${dailyBracket(day)[1].quotes.intro[1].split('\n')[0]}`);
      return;
    }
    throw Error('no autoplay run won a round');
  });

  it('replaying the action journal reproduces the same state', () => {
    const setup = setupFor(date);
    const { s, actions } = autoplay(new TournamentEngine(setup), 40);
    const replayed = new TournamentEngine({ ...setup, actions }).state();
    expect(replayed.round).toBe(s.round);
    expect(replayed.phase).toBe(s.phase);
    expect(replayed.p.map((m) => m.hp)).toEqual(s.p.map((m) => m.hp));
    expect(replayed.r.map((m) => m.hp)).toEqual(s.r.map((m) => m.hp));
    expect(replayed.history).toEqual(s.history);
  });

  it('is deterministic for the same seed and actions', () => {
    const a = autoplay(new TournamentEngine(setupFor(date)));
    const b = autoplay(new TournamentEngine(setupFor(date)));
    expect(a.actions).toEqual(b.actions);
    expect(a.s.outcome).toBe(b.s.outcome);
    expect(a.s.totalTurns).toBe(b.s.totalTurns);
  });
});

describe('share text', () => {
  const rounds = [
    { id: 'misty', name: 'Misty', won: true, rDown: [true, true, true], turns: 5 },
    { id: 'red', name: 'Red', won: false, rDown: [true, false, false], turns: 6 },
    { id: 'alder', name: 'Alder', won: null, rDown: [false, false, false], turns: 0 },
  ];
  it('describes a loss by round and opponent', () => {
    const text = shareText(
      { won: false, cup: 'Champions', rounds, roundsWon: 1, turns: 11, pAlive: [false, false, false], pNames: ['a', 'b', 'c'], left: 0 },
      4,
      0,
    );
    expect(text).toContain('#4 · Champions: Out in the semifinal to Red');
    expect(text).toContain('R1 Misty 🟥🟥🟥');
    expect(text).toContain('SF Red 🟥⬛⬛');
    expect(text).toContain('F Alder ⬜⬜⬜');
  });
  it('crowns a champion', () => {
    const text = shareText(
      { won: true, rounds: rounds.map((r) => ({ ...r, won: true })), roundsWon: 3, turns: 20, pAlive: [true, false, true], pNames: ['a', 'b', 'c'], left: 2 },
      4,
      3,
    );
    expect(text).toContain('Champion 🏆');
    expect(text).toContain('🟩⬛🟩  2/3 left');
  });
});
