// Small shared pieces: sprites, type chips, the live clock and ability blurbs.
import { useEffect, useState } from 'react';
import { DARK_TEXT_TYPES, TYPE_COLORS } from '../data/constants.js';

const POKEMON_SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/';
const TRAINER_SPRITES = 'https://play.pokemonshowdown.com/sprites/trainers/';
export const pokemonSprite = (dexno, back = false) => `${POKEMON_SPRITES}${back ? 'back/' : ''}${dexno}.png`;
export const trainerSprite = (id) => `${TRAINER_SPRITES}${id}.png`;

export const initials = (name) => name.slice(0, 2).toUpperCase();
export const baseStatTotal = (mon) => mon.bs.reduce((a, b) => a + b, 0);

export const reducedMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// Ticks once a second; null until mounted so server and first client render agree.
export function useNow() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// An <img> that swaps itself for `fallback` when the sprite is missing.
export function Img({ src, alt = '', fallback, ...rest }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) return fallback;
  return <img src={src} alt={alt} onError={() => setFailed(true)} {...rest} />;
}

export function TypeChips({ types }) {
  return (
    <span className="chips">
      {types.map((t) => (
        <span key={t} className={`chip${DARK_TEXT_TYPES.has(t) ? ' dark' : ''}`} style={{ background: TYPE_COLORS[t] }}>
          {t}
        </span>
      ))}
    </span>
  );
}

// Coloured dot for a move's type.
export const TypeDot = ({ type }) => <i className="dot" style={{ background: TYPE_COLORS[type] || 'var(--muted)' }} />;

// Front sprite in a rounded tile; a two-letter badge when the image is missing.
export function MonTile({ mon, size = 48 }) {
  return (
    <span className="tile" style={{ '--sz': `${size}px` }} aria-hidden="true">
      <Img src={pokemonSprite(mon.dexno)} fallback={<b>{initials(mon.name)}</b>} />
    </span>
  );
}

export function TrainerTile({ trainer, size = 56 }) {
  return (
    <span className="tile round" style={{ '--sz': `${size}px` }} aria-hidden="true">
      <Img src={trainerSprite(trainer.sprite)} fallback={<b>{initials(trainer.name)}</b>} />
    </span>
  );
}

const ABILITY_TEXT = {
  Aftermath: 'When knocked out by a contact move, it damages the attacker for 1/4 of their max HP.',
  'Battle Armor': "It can't be hit by critical hits.",
  Blaze: 'Fire moves get 1.5x power when HP is 1/3 or less.',
  Chlorophyll: 'Speed doubles in sunshine.',
  'Clear Body': "Opponents can't lower its stats.",
  'Compound Eyes': 'Its moves have 1.3x accuracy.',
  'Cute Charm': 'Contact moves that hit it have a 30% chance to infatuate an attacker of the opposite gender.',
  Defeatist: 'Attack and Sp. Atk are halved while HP is 1/2 or less.',
  'Effect Spore': 'Contact moves that hit it have a 30% chance to poison, paralyze or put the attacker to sleep.',
  Filter: 'Super-effective hits do 3/4 damage.',
  'Flame Body': 'Contact moves that hit it have a 30% chance to burn the attacker.',
  'Flash Fire': "Fire moves don't hurt it. After absorbing a Fire move, its own Fire moves do 1.5x damage.",
  Guts: "Attack rises 1.5x while it has a status problem. A burn doesn't lower its Attack.",
  'Huge Power': 'Its Attack is doubled.',
  Hydration: 'Its status problem is healed each turn in rain.',
  'Ice Body': 'It restores 1/16 of its max HP each turn in hail and takes no hail damage.',
  'Inner Focus': "It can't flinch.",
  Intimidate: "Lowers the opponent's Attack by 1 stage when it enters battle.",
  'Iron Barbs': 'Contact moves that hit it damage the attacker for 1/8 of their max HP.',
  'Iron Fist': 'Punching moves get 1.2x power.',
  'Keen Eye': "Its accuracy can't be lowered.",
  Levitate: "Ground moves don't affect it.",
  'Lightning Rod': "Electric moves don't hurt it and raise its Sp. Atk by 1 stage instead.",
  'Liquid Ooze': 'Draining moves used on it damage the attacker instead of healing them.',
  'Magic Bounce': 'Status moves aimed at it bounce back to the user.',
  'Magic Guard': 'It only takes damage from attacks: no poison, burn, weather, recoil or hazard damage.',
  'Magnet Pull': "Steel-type foes can't switch out.",
  'Marvel Scale': 'Defense rises 1.5x while it has a status problem.',
  'Mold Breaker': "Its moves ignore the target's ability, such as Levitate or Sturdy.",
  'Motor Drive': "Electric moves don't hurt it and raise its Speed by 1 stage instead.",
  Moxie: 'Attack rises by 1 stage each time it knocks out a Pokémon.',
  Multiscale: 'It takes half damage while at full HP.',
  'Natural Cure': 'Its status problem is healed when it switches out.',
  'No Guard': 'Its moves and moves aimed at it never miss.',
  Oblivious: "It can't be infatuated or taunted.",
  Overgrow: 'Grass moves get 1.5x power when HP is 1/3 or less.',
  Pickup: 'No effect in battle.',
  'Poison Heal': 'It heals 1/8 of its max HP each turn while poisoned instead of taking damage.',
  'Poison Point': 'Contact moves that hit it have a 30% chance to poison the attacker.',
  Prankster: 'Its status moves go first.',
  Pressure: 'Moves aimed at it use 2 PP.',
  Reckless: 'Recoil moves get 1.2x power.',
  'Rock Head': 'It takes no recoil damage from its own moves, except Struggle.',
  'Rough Skin': 'Contact moves that hit it damage the attacker for 1/8 of their max HP.',
  'Sand Rush': 'Speed doubles in a sandstorm.',
  'Sand Stream': "Summons a sandstorm when it enters battle. Each turn, the sandstorm hurts Pokémon that aren't Rock, Ground or Steel type.",
  Scrappy: 'Its Normal and Fighting moves can hit Ghost types.',
  'Serene Grace': "Its moves' secondary effects are twice as likely to happen.",
  'Sheer Force': 'Moves with a secondary effect lose it and get 1.3x power.',
  'Skill Link': 'Its multi-hit moves always hit five times.',
  'Snow Cloak': 'Its evasiveness rises in hail and it takes no hail damage.',
  'Solid Rock': 'Super-effective hits do 3/4 damage.',
  'Speed Boost': 'Speed rises by 1 stage at the end of each turn.',
  Static: 'Contact moves that hit it have a 30% chance to paralyze the attacker.',
  Steadfast: 'Speed rises by 1 stage each time it flinches.',
  Sturdy: 'It survives any hit from full HP with 1 HP, and one-hit KO moves fail against it.',
  'Suction Cups': "It can't be forced to switch out.",
  'Super Luck': 'Its critical hit rate is one stage higher.',
  Swarm: 'Bug moves get 1.5x power when HP is 1/3 or less.',
  'Swift Swim': 'Speed doubles in rain.',
  Synchronize: 'If the opponent burns, paralyzes or poisons it, the opponent gets the same status.',
  Technician: 'Moves with 60 power or less get 1.5x power.',
  'Thick Fat': 'Fire and Ice moves do half damage to it.',
  Torrent: 'Water moves get 1.5x power when HP is 1/3 or less.',
  'Toxic Boost': 'Physical attacks get 1.5x power while it is poisoned.',
  Trace: "Copies the opponent's ability when it enters battle.",
  Truant: 'It can only move every other turn.',
  Unburden: 'Speed doubles once its held item is used up.',
  'Volt Absorb': "Electric attacks don't hurt it and restore 1/4 of its max HP instead.",
  'Water Absorb': "Water attacks don't hurt it and restore 1/4 of its max HP instead.",
  'Water Veil': "It can't be burned.",
  'White Smoke': "Opponents can't lower its stats.",
};
export const abilityText = (name) => (Object.hasOwn(ABILITY_TEXT, name) ? ABILITY_TEXT[name] : undefined);
