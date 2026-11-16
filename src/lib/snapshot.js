// Snapshot of both sides, attached to each narration event so the UI can replay
// the battle in step with the text. It names each Pokémon as well as its HP:
// by the time a round's last events play, the engine's state already holds the
// next trainer's team, so the screen must not take identities from it.
const monOf = (m) => ({
  name: m.name,
  dexno: m.dexno,
  types: m.types,
  hp: m.hp,
  max: m.max,
  status: m.status,
  boosts: { ...m.boosts },
});
export const snapshotOf = (s) => ({
  p: s.p.map(monOf),
  r: s.r.map(monOf),
  pa: s.pa,
  ra: s.ra,
  turn: s.turn,
});
