// Wraps a sequence of Pokémon Showdown Gen 5 battles as one tournament run:
// three rounds against three trainers, a full heal between rounds and the
// trainer AI. narrate.js turns each battle's log into the lines the UI shows.
import { Battle, Dex, PRNG, toID } from '@pkmn/sim';
import * as calc from '@smogon/calc';
import pool from '../data/pool.json';
import { hashString, mulberry32 } from '../lib/rng.js';
import { snapshotOf as snapshot } from '../lib/snapshot.js';
import { fillCall, narrate, resultCall } from './narrate.js';

const GEN = pool.gen;
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const dex = Dex.forGen(GEN);

function toShowdownSet(mon) {
  const species = dex.species.get(mon.name);
  return {
    name: mon.name,
    species: mon.name,
    level: 100,
    gender: species.gender === 'N' ? 'N' : 'M',
    ability: mon.ability || species.abilities[0],
    item: mon.item,
    nature: mon.nature || 'Serious',
    moves: mon.moves.map((m) => m.name),
    evs: Object.fromEntries(STATS.map((s, i) => [s, mon.evs[i]])),
    ivs: Object.fromEntries(STATS.map((s, i) => [s, mon.ivs[i]])),
  };
}

const moveData = (id) => {
  const m = dex.moves.get(id);
  return {
    type: m.type,
    category: m.category,
    pow: m.basePower,
    acc: m.accuracy === true ? 0 : m.accuracy,
    pp: m.pp,
    prio: m.priority,
  };
};

const trainerInfo = ({ id, name, title, region, sprite }) => ({ id, name, title, region, sprite });
const fullHp = (mons) => mons.map((m) => ({ ...m, hp: m.max, status: '', boosts: {} }));

export class TournamentEngine {
  // setup: { team, lead, seed, bracket: [{ id, name, title, region, sprite, quotes, team }], actions }
  constructor(setup) {
    this.team = structuredClone(setup.team);
    this.bracket = structuredClone(setup.bracket);
    this.seed = setup.seed;
    this.random = mulberry32(hashString(`${setup.seed}:ai`));
    this.round = 0;
    this.history = [];
    this.events = [];
    this.startRound(setup.lead);
    // Replaying saved actions is how an interrupted official run resumes.
    for (const action of setup.actions || []) {
      const r = this.choose(action);
      if (r.error) throw Error(`Replay rejected: ${r.error}`);
    }
  }

  get trainer() {
    return this.bracket[this.round];
  }

  startRound(lead) {
    const trainer = this.trainer;
    const seed = [0, 1, 2, 3].map((i) => hashString(`${this.seed}:r${this.round}:battle:${i}`) & 65535);
    this.battle = new Battle({
      formatid: toID(`gen${GEN}customgame`),
      seed: PRNG.convertSeed(seed),
      p1: { name: 'Player', team: this.team.map(toShowdownSet) },
      p2: { name: trainer.name, team: trainer.team.map(toShowdownSet) },
    });
    this.templates = [this.team, trainer.team];
    this.original = [[...this.battle.p1.pokemon], [...this.battle.p2.pokemon]];
    this.phase = 'battle';
    // Gen 5 formats open with team preview; the lead choice is made there.
    const order = [lead, ...this.team.map((_, i) => i).filter((i) => i !== lead)].map((i) => i + 1);
    if (!this.battle.choose('p1', `team ${order.join(',')}`)) throw Error(`Lead rejected: ${this.battle.p1.choice.error}`);
    if (!this.battle.choose('p2', 'team 1,2,3')) throw Error(`AI lead rejected: ${this.battle.p2.choice.error}`);
    const s = this.state();
    const ev = narrate(this.battle.log, s, s, { trainer, round: this.round });
    this.events.push(...ev);
    return ev;
  }

  battleState() {
    const sides = this.original.map((mons, side) =>
      mons.map((p, i) => ({
        ...this.templates[side][i],
        hp: p.hp,
        max: p.maxhp,
        status: p.status,
        boosts: { ...p.boosts },
        ability: p.getAbility().name,
        item: p.getItem().name,
        // The set's item, so a used-up White Herb or berry can still be named.
        startItem: this.templates[side][i].item,
        stats: { ...p.storedStats },
        moves: p.moveSlots.map((slot) => ({
          name: dex.moves.get(slot.id).name,
          pp: slot.pp,
          max: slot.maxpp,
          disabled: !!slot.disabled,
          data: moveData(slot.id),
        })),
      })),
    );
    const req = this.battle.p1.activeRequest;
    const pa = Math.max(0, this.original[0].indexOf(this.battle.p1.active[0]));
    const ra = Math.max(0, this.original[1].indexOf(this.battle.p2.active[0]));
    const needSwitch = !!req?.forceSwitch?.[0];
    const active = req && 'active' in req ? req.active[0] : undefined;
    if (active) {
      sides[0][pa].struggle = active.moves.length === 1 && active.moves[0].id === 'struggle';
      if (!sides[0][pa].struggle) {
        sides[0][pa].moves = active.moves.map((m) => ({
          name: m.move,
          pp: m.pp ?? 1,
          max: m.maxpp ?? 1,
          disabled: !!m.disabled,
          data: moveData(m.id),
        }));
      }
    }
    const canSwitch = !this.battle.ended && (needSwitch || (!!active && !active.trapped));
    return {
      p: sides[0],
      r: sides[1],
      pa,
      ra,
      turn: this.battle.turn || 1,
      completedTurns: this.battle.ended ? this.battle.turn : Math.max(0, this.battle.turn - 1),
      won: this.battle.ended && this.battle.winner === 'Player',
      needSwitch,
      canSwitch,
      switches: canSwitch ? this.original[0].flatMap((p, i) => (p.hp > 0 && !p.isActive ? [i] : [])) : [],
    };
  }

  state() {
    const b = this.battleState();
    const ended = this.battle.ended;
    const last = this.round === this.bracket.length - 1;
    const between = ended && b.won && !last;
    const next = between ? this.bracket[this.round + 1] : null;
    const totalTurns = this.history.reduce((n, h) => n + h.turns, 0) + b.completedTurns;
    return {
      ...b,
      // Between rounds the party is healed and the next trainer's team is shown.
      p: between ? fullHp(this.team) : b.p,
      r: between ? fullHp(next.team) : b.r,
      ra: between ? 0 : b.ra,
      needSwitch: between ? false : b.needSwitch,
      canSwitch: between ? false : b.canSwitch,
      switches: between ? [] : b.switches,
      // Between rounds the state already describes the round about to start.
      round: this.round + (between ? 2 : 1),
      rounds: this.bracket.length,
      trainer: trainerInfo(between ? next : this.trainer),
      bracket: this.bracket.map(trainerInfo),
      phase: between ? 'between' : ended ? 'done' : 'battle',
      needLead: between,
      outcome: ended && !between ? (b.won ? 'won' : 'lost') : null,
      history: structuredClone(this.history),
      totalTurns,
    };
  }

  initial() {
    return { s: this.state(), ev: [...this.events] };
  }

  // Damage of one move at the minimum roll (85%), the estimate the game's AI uses.
  damage(attacker, defender, moveId) {
    const move = dex.moves.get(moveId);
    if (move.category === 'Status') return 0;
    const toCalc = (p) =>
      new calc.Pokemon(GEN, p.species.name, {
        level: 100,
        ability: p.getAbility().name,
        item: p.getItem().name,
        nature: p.set.nature,
        evs: p.set.evs,
        ivs: p.set.ivs,
        boosts: p.boosts,
        curHP: p.hp,
        status: p.status,
      });
    const weather = { sunnyday: 'Sun', raindance: 'Rain', sandstorm: 'Sand', hail: 'Hail' }[this.battle.field.weather];
    try {
      return calc
        .calculate(GEN, toCalc(attacker), toCalc(defender), new calc.Move(GEN, move.name), new calc.Field({ weather }))
        .range()[0];
    } catch {
      // The calculator rejects a few edge cases (e.g. unknown move results); treat as no damage.
      return 0;
    }
  }

  // A status move scores 0 (it ties with the best non-KO attack) unless it can't
  // do anything right now, in which case it is ruled out.
  statusScore(move, user, target) {
    const bad = -10;
    const foeSide = this.battle.p1;
    if (move.status && (target.status || !dex.getImmunity(move.status, target))) return bad;
    if (move.target === 'normal' && !dex.getImmunity(move.type, target)) return bad;
    if (move.boosts && move.target === 'self' && Object.keys(move.boosts).every((s) => user.boosts[s] >= 6)) return bad;
    if (move.sideCondition && (move.target === 'foeSide' ? foeSide : user.side).sideConditions[move.sideCondition]) return bad;
    if (move.weather && this.battle.field.weather === toID(move.weather)) return bad;
    if (move.volatileStatus === 'substitute' && user.volatiles.substitute) return bad;
    if (move.volatileStatus && move.target === 'normal' && target.volatiles[move.volatileStatus]) return bad;
    if (move.volatileStatus === 'leechseed' && target.hasType('Grass')) return bad;
    if (move.stallingMove && user.volatiles.stall) return bad;
    if ((move.heal || move.id === 'rest' || move.flags.heal) && user.hp > (user.maxhp * 2) / 3) return bad;
    if (move.id === 'yawn' && (target.status || target.volatiles.yawn)) return bad;
    return 0;
  }

  // Trainer AI, after the shared PWT routine: damage is estimated at the minimum
  // roll; a move that would KO scores +4; an attack that another known move (even
  // one with no PP) out-damages scores -1; an attack the target is immune to is
  // ruled out; the best scores are tie-broken at random. On a forced switch it
  // sends in the reserve with the hardest hit on your active Pokémon.
  ai(side) {
    const req = side.activeRequest;
    if (!req || req.wait) return 'pass';
    const target = this.battle.p1.active[0].hp > 0 ? this.battle.p1.active[0] : this.original[0].find((p) => p.hp > 0);
    if (req.forceSwitch) {
      const options = side.pokemon.flatMap((p, i) =>
        p.hp > 0 && !p.isActive
          ? [{ i, score: Math.max(...p.moveSlots.map((slot) => this.damage(p, target, slot.id))) }]
          : [],
      );
      options.sort((a, b) => b.score - a.score);
      if (!options.length) throw Error('AI has no switch choice');
      return `switch ${options[0].i + 1}`;
    }
    if (!('active' in req)) throw Error('Unexpected team preview');
    const user = side.active[0];
    const known = user.moveSlots.map((slot) => ({ id: slot.id, dmg: this.damage(user, target, slot.id) }));
    const scored = req.active[0].moves.flatMap((m, i) => {
      if (m.disabled || (m.pp !== undefined && m.pp <= 0)) return [];
      const move = dex.moves.get(m.id);
      let score = 0;
      if (move.category === 'Status') score = this.statusScore(move, user, target);
      else {
        const dmg = known.find((k) => k.id === m.id)?.dmg ?? 0;
        if (dmg <= 0) score = -10;
        else if (dmg >= target.hp) score += 4;
        else if (known.some((k) => k.dmg > dmg)) score -= 1;
      }
      return [{ i, score }];
    });
    if (!scored.length) throw Error('AI request contains no legal move');
    const best = Math.max(...scored.map((s) => s.score));
    const top = scored.filter((s) => s.score === best);
    return `move ${top[Math.floor(this.random() * top.length)].i + 1}`;
  }

  // action: { type: 'move', idx } (idx -1 = Struggle), { type: 'switch', idx }
  // (party index) or { type: 'lead', idx } to open the next round.
  choose(action) {
    const before = this.state();
    if (before.outcome) return { s: before, ev: [], error: 'This run has ended.' };
    if (before.needLead) {
      if (action.type !== 'lead' || !this.team[action.idx]) return { s: before, ev: [], error: 'Choose a lead for the next round.' };
      this.round++;
      const ev = this.startRound(action.idx);
      return { s: this.state(), ev };
    }
    if (action.type === 'lead') return { s: before, ev: [], error: 'The round is already under way.' };
    const logStart = this.battle.log.length;
    let choice;
    if (action.type === 'switch') {
      const mon = this.original[0][action.idx];
      if (!mon || !before.switches?.includes(action.idx))
        return { s: before, ev: [], error: 'That Pokémon cannot switch in.' };
      choice = `switch ${this.battle.p1.pokemon.indexOf(mon) + 1}`;
    } else {
      choice = `move ${action.idx < 0 ? 1 : action.idx + 1}`;
    }
    if (!this.battle.choose('p1', choice))
      return { s: this.state(), ev: [], error: this.battle.p1.choice.error || 'Choose a valid move.' };
    for (let i = 0; i < 8 && !this.battle.ended; i++) {
      const foe = this.battle.p2;
      if (foe.activeRequest && !foe.activeRequest.wait && !foe.isChoiceDone() && !this.battle.choose('p2', this.ai(foe)))
        throw Error(`AI choice rejected: ${foe.choice.error}`);
      if (this.battle.p1.activeRequest && !this.battle.p1.activeRequest.wait) break;
    }
    const battleAfter = this.battleState();
    let call = null;
    if (this.battle.ended) {
      this.history.push({
        ...trainerInfo(this.trainer),
        won: battleAfter.won,
        rDown: battleAfter.r.map((m) => m.hp <= 0),
        turns: battleAfter.completedTurns,
      });
      // Own RNG stream so the call never shifts the AI's rolls.
      const random = mulberry32(hashString(`${this.seed}:r${this.round}:call`));
      const summit = battleAfter.won && this.round === this.bracket.length - 1;
      call = fillCall(resultCall(battleAfter.won ? battleAfter.p : battleAfter.r, summit, random), battleAfter.won ? null : this.trainer.name);
    }
    const after = this.state();
    const next = after.needLead ? { round: after.round, name: this.bracket[this.round + 1].name } : null;
    const events = narrate(
      this.battle.log.slice(logStart).filter((l) => !l.startsWith('|turn|')),
      before,
      battleAfter,
      { trainer: this.trainer, next, final: after, call },
    );
    if (!before.needSwitch) events.unshift({ text: `Turn ${before.turn}`, kind: 'turn', snap: snapshot(before) });
    this.events.push(...events);
    return { s: after, ev: events };
  }

  destroy() {
    this.battle.destroy();
  }
}
