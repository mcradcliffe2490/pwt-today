// Trainer metadata for the World Tournament roster. Teams are in pwt-teams.txt
// (regional and Champions cups) and pwt-world-teams.txt (World Leaders cup),
// keyed by `id`; dialogue is in pwt-text.json (see scripts/import-text.mjs).
// `sprite` is a Pokémon Showdown trainer sprite id (the UI falls back to a
// monogram when the image is missing).
//
// `priority`, `type`, `ace` and `ivs` come from the WBT trainer table documented
// in github.com/DavidAGInnovation/bw2-pwt-research (data/champions-and-leaders.md,
// data/wbt-party-selection.md): Leaders are priority 3 with their gym type as the
// bracket-result category and 20 IVs in every stat; Champions are priority 4,
// type-neutral, 25 IVs (Red 30). An ace is always that trainer's lead; Blue and
// Red have none.
export const TRAINERS = [
  // Kanto Leaders
  { id: 'brock', name: 'Brock', title: 'Gym Leader', region: 'Kanto', sprite: 'brock', priority: 3, type: 'Rock', ace: 'Onix', ivs: 20 },
  { id: 'misty', name: 'Misty', title: 'Gym Leader', region: 'Kanto', sprite: 'misty', priority: 3, type: 'Water', ace: 'Starmie', ivs: 20 },
  { id: 'ltsurge', name: 'Lt. Surge', title: 'Gym Leader', region: 'Kanto', sprite: 'ltsurge', priority: 3, type: 'Electric', ace: 'Raichu', ivs: 20 },
  { id: 'erika', name: 'Erika', title: 'Gym Leader', region: 'Kanto', sprite: 'erika', priority: 3, type: 'Grass', ace: 'Vileplume', ivs: 20 },
  { id: 'janine', name: 'Janine', title: 'Gym Leader', region: 'Kanto', sprite: 'janine', priority: 3, type: 'Poison', ace: 'Venomoth', ivs: 20 },
  { id: 'sabrina', name: 'Sabrina', title: 'Gym Leader', region: 'Kanto', sprite: 'sabrina', priority: 3, type: 'Psychic', ace: 'Alakazam', ivs: 20 },
  { id: 'blaine', name: 'Blaine', title: 'Gym Leader', region: 'Kanto', sprite: 'blaine', priority: 3, type: 'Fire', ace: 'Arcanine', ivs: 20 },
  { id: 'giovanni', name: 'Giovanni', title: 'Gym Leader', region: 'Kanto', sprite: 'giovanni', priority: 3, type: 'Ground', ace: 'Rhyperior', ivs: 20 },
  // Johto Leaders
  { id: 'falkner', name: 'Falkner', title: 'Gym Leader', region: 'Johto', sprite: 'falkner', priority: 3, type: 'Flying', ace: 'Pidgeot', ivs: 20 },
  { id: 'bugsy', name: 'Bugsy', title: 'Gym Leader', region: 'Johto', sprite: 'bugsy', priority: 3, type: 'Bug', ace: 'Scizor', ivs: 20 },
  { id: 'whitney', name: 'Whitney', title: 'Gym Leader', region: 'Johto', sprite: 'whitney', priority: 3, type: 'Normal', ace: 'Miltank', ivs: 20 },
  { id: 'morty', name: 'Morty', title: 'Gym Leader', region: 'Johto', sprite: 'morty', priority: 3, type: 'Ghost', ace: 'Gengar', ivs: 20 },
  { id: 'chuck', name: 'Chuck', title: 'Gym Leader', region: 'Johto', sprite: 'chuck', priority: 3, type: 'Fighting', ace: 'Poliwrath', ivs: 20 },
  { id: 'jasmine', name: 'Jasmine', title: 'Gym Leader', region: 'Johto', sprite: 'jasmine', priority: 3, type: 'Steel', ace: 'Steelix', ivs: 20 },
  { id: 'pryce', name: 'Pryce', title: 'Gym Leader', region: 'Johto', sprite: 'pryce', priority: 3, type: 'Ice', ace: 'Mamoswine', ivs: 20 },
  { id: 'clair', name: 'Clair', title: 'Gym Leader', region: 'Johto', sprite: 'clair', priority: 3, type: 'Dragon', ace: 'Kingdra', ivs: 20 },
  // Hoenn Leaders
  { id: 'roxanne', name: 'Roxanne', title: 'Gym Leader', region: 'Hoenn', sprite: 'roxanne', priority: 3, type: 'Rock', ace: 'Probopass', ivs: 20 },
  { id: 'brawly', name: 'Brawly', title: 'Gym Leader', region: 'Hoenn', sprite: 'brawly', priority: 3, type: 'Fighting', ace: 'Hariyama', ivs: 20 },
  { id: 'wattson', name: 'Wattson', title: 'Gym Leader', region: 'Hoenn', sprite: 'wattson', priority: 3, type: 'Electric', ace: 'Manectric', ivs: 20 },
  { id: 'flannery', name: 'Flannery', title: 'Gym Leader', region: 'Hoenn', sprite: 'flannery', priority: 3, type: 'Fire', ace: 'Torkoal', ivs: 20 },
  { id: 'norman', name: 'Norman', title: 'Gym Leader', region: 'Hoenn', sprite: 'norman', priority: 3, type: 'Normal', ace: 'Slaking', ivs: 20 },
  { id: 'winona', name: 'Winona', title: 'Gym Leader', region: 'Hoenn', sprite: 'winona', priority: 3, type: 'Flying', ace: 'Altaria', ivs: 20 },
  { id: 'tate', name: 'Tate', title: 'Gym Leader', region: 'Hoenn', sprite: 'tate', priority: 3, type: 'Psychic', ace: 'Solrock', ivs: 20 },
  { id: 'liza', name: 'Liza', title: 'Gym Leader', region: 'Hoenn', sprite: 'liza', priority: 3, type: 'Psychic', ace: 'Lunatone', ivs: 20 },
  { id: 'juan', name: 'Juan', title: 'Gym Leader', region: 'Hoenn', sprite: 'juan', priority: 3, type: 'Water', ace: 'Kingdra', ivs: 20 },
  // Sinnoh Leaders
  { id: 'roark', name: 'Roark', title: 'Gym Leader', region: 'Sinnoh', sprite: 'roark', priority: 3, type: 'Rock', ace: 'Rampardos', ivs: 20 },
  { id: 'gardenia', name: 'Gardenia', title: 'Gym Leader', region: 'Sinnoh', sprite: 'gardenia', priority: 3, type: 'Grass', ace: 'Roserade', ivs: 20 },
  { id: 'fantina', name: 'Fantina', title: 'Gym Leader', region: 'Sinnoh', sprite: 'fantina', priority: 3, type: 'Ghost', ace: 'Mismagius', ivs: 20 },
  { id: 'maylene', name: 'Maylene', title: 'Gym Leader', region: 'Sinnoh', sprite: 'maylene', priority: 3, type: 'Fighting', ace: 'Lucario', ivs: 20 },
  { id: 'crasherwake', name: 'Crasher Wake', title: 'Gym Leader', region: 'Sinnoh', sprite: 'crasherwake', priority: 3, type: 'Water', ace: 'Floatzel', ivs: 20 },
  { id: 'byron', name: 'Byron', title: 'Gym Leader', region: 'Sinnoh', sprite: 'byron', priority: 3, type: 'Steel', ace: 'Bastiodon', ivs: 20 },
  { id: 'candice', name: 'Candice', title: 'Gym Leader', region: 'Sinnoh', sprite: 'candice', priority: 3, type: 'Ice', ace: 'Froslass', ivs: 20 },
  { id: 'volkner', name: 'Volkner', title: 'Gym Leader', region: 'Sinnoh', sprite: 'volkner', priority: 3, type: 'Electric', ace: 'Electivire', ivs: 20 },
  // Unova Leaders
  { id: 'cilan', name: 'Cilan', title: 'Gym Leader', region: 'Unova', sprite: 'cilan', priority: 3, type: 'Grass', ace: 'Simisage', ivs: 20 },
  { id: 'chili', name: 'Chili', title: 'Gym Leader', region: 'Unova', sprite: 'chili', priority: 3, type: 'Fire', ace: 'Simisear', ivs: 20 },
  { id: 'cress', name: 'Cress', title: 'Gym Leader', region: 'Unova', sprite: 'cress', priority: 3, type: 'Water', ace: 'Simipour', ivs: 20 },
  { id: 'lenora', name: 'Lenora', title: 'Gym Leader', region: 'Unova', sprite: 'lenora', priority: 3, type: 'Normal', ace: 'Watchog', ivs: 20 },
  { id: 'burgh', name: 'Burgh', title: 'Gym Leader', region: 'Unova', sprite: 'burgh', priority: 3, type: 'Bug', ace: 'Leavanny', ivs: 20 },
  { id: 'elesa', name: 'Elesa', title: 'Gym Leader', region: 'Unova', sprite: 'elesa', priority: 3, type: 'Electric', ace: 'Zebstrika', ivs: 20 },
  { id: 'clay', name: 'Clay', title: 'Gym Leader', region: 'Unova', sprite: 'clay', priority: 3, type: 'Ground', ace: 'Excadrill', ivs: 20 },
  { id: 'skyla', name: 'Skyla', title: 'Gym Leader', region: 'Unova', sprite: 'skyla', priority: 3, type: 'Flying', ace: 'Swanna', ivs: 20 },
  { id: 'brycen', name: 'Brycen', title: 'Gym Leader', region: 'Unova', sprite: 'brycen', priority: 3, type: 'Ice', ace: 'Cryogonal', ivs: 20 },
  { id: 'drayden', name: 'Drayden', title: 'Gym Leader', region: 'Unova', sprite: 'drayden', priority: 3, type: 'Dragon', ace: 'Haxorus', ivs: 20 },
  { id: 'roxie', name: 'Roxie', title: 'Gym Leader', region: 'Unova', sprite: 'roxie', priority: 3, type: 'Poison', ace: 'Scolipede', ivs: 20 },
  { id: 'marlon', name: 'Marlon', title: 'Gym Leader', region: 'Unova', sprite: 'marlon', priority: 3, type: 'Water', ace: 'Jellicent', ivs: 20 },
  { id: 'cheren', name: 'Cheren', title: 'Gym Leader', region: 'Unova', sprite: 'cheren', priority: 3, type: 'Normal', ace: 'Stoutland', ivs: 20 },
  // Champions
  { id: 'blue', name: 'Blue', title: 'Champion', region: 'Kanto', sprite: 'blue', priority: 4, type: null, ace: null, ivs: 25 },
  { id: 'lance', name: 'Lance', title: 'Champion', region: 'Johto', sprite: 'lance', priority: 4, type: null, ace: 'Dragonite', ivs: 25 },
  { id: 'steven', name: 'Steven', title: 'Champion', region: 'Hoenn', sprite: 'steven', priority: 4, type: null, ace: 'Metagross', ivs: 25 },
  { id: 'wallace', name: 'Wallace', title: 'Champion', region: 'Hoenn', sprite: 'wallace', priority: 4, type: null, ace: 'Milotic', ivs: 25 },
  { id: 'cynthia', name: 'Cynthia', title: 'Champion', region: 'Sinnoh', sprite: 'cynthia', priority: 4, type: null, ace: 'Garchomp', ivs: 25 },
  { id: 'alder', name: 'Alder', title: 'Champion', region: 'Unova', sprite: 'alder', priority: 4, type: null, ace: 'Volcarona', ivs: 25 },
  { id: 'red', name: 'Red', title: 'Champion', region: 'Kanto', sprite: 'red', priority: 4, type: null, ace: null, ivs: 30 },
];
