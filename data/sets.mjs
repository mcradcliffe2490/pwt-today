// Player pool for src/data/pool.json. Run `npm run build:data` after editing.
// Trainer teams live in pwt-teams.txt and trainers.mjs.
//
// Set format: "Species @ Item | Ability | Nature | EVs | Move, Move, Move, Move".
// Every set is checked against Pokémon Showdown's [Gen 5] OU validator, so a
// typo or an illegal move fails the build instead of a battle.

// The pool the daily three are drawn from: competitive Gen 5 sets, perfect IVs.
export const PLAYERS = [
  'Garchomp @ Choice Scarf | Rough Skin | Jolly | 4 HP / 252 Atk / 252 Spe | Outrage, Earthquake, Stone Edge, Fire Blast',
  'Scizor @ Choice Band | Technician | Adamant | 248 HP / 252 Atk / 8 Spe | Bullet Punch, U-turn, Superpower, Pursuit',
  'Dragonite @ Lum Berry | Multiscale | Adamant | 4 HP / 252 Atk / 252 Spe | Dragon Dance, Outrage, Fire Punch, ExtremeSpeed',
  'Tyranitar @ Choice Band | Sand Stream | Adamant | 180 HP / 252 Atk / 76 Spe | Stone Edge, Crunch, Pursuit, Superpower',
  'Starmie @ Life Orb | Natural Cure | Timid | 4 Def / 252 SpA / 252 Spe | Hydro Pump, Thunderbolt, Ice Beam, Psyshock',
  'Gengar @ Life Orb | Levitate | Timid | 4 Def / 252 SpA / 252 Spe | Shadow Ball, Focus Blast, Thunderbolt, Giga Drain',
  'Lucario @ Life Orb | Inner Focus | Adamant | 4 HP / 252 Atk / 252 Spe | Swords Dance, Close Combat, ExtremeSpeed, Crunch',
  'Heatran @ Leftovers | Flash Fire | Timid | 4 HP / 252 SpA / 252 Spe | Fire Blast, Earth Power, Flash Cannon, Stealth Rock',
  'Conkeldurr @ Leftovers | Guts | Adamant | 120 HP / 252 Atk / 136 SpD | Drain Punch, Mach Punch, Payback, Ice Punch',
  'Excadrill @ Air Balloon | Mold Breaker | Adamant | 4 HP / 252 Atk / 252 Spe | Earthquake, Rock Slide, X-Scissor, Swords Dance',
  'Volcarona @ Leftovers | Flame Body | Timid | 4 HP / 252 SpA / 252 Spe | Quiver Dance, Fire Blast, Bug Buzz, Giga Drain',
  'Jellicent @ Leftovers | Water Absorb | Bold | 248 HP / 216 Def / 44 Spe | Scald, Will-O-Wisp, Recover, Shadow Ball',
  'Ferrothorn @ Leftovers | Iron Barbs | Relaxed | 252 HP / 88 Def / 168 SpD | Power Whip, Gyro Ball, Leech Seed, Stealth Rock',
  'Haxorus @ Choice Scarf | Mold Breaker | Jolly | 4 HP / 252 Atk / 252 Spe | Outrage, Earthquake, Dragon Claw, Brick Break',
  'Salamence @ Choice Scarf | Intimidate | Naive | 252 Atk / 4 SpA / 252 Spe | Outrage, Earthquake, Fire Blast, Dragon Claw',
  'Metagross @ Choice Band | Clear Body | Adamant | 252 HP / 252 Atk / 4 Spe | Meteor Mash, Earthquake, Zen Headbutt, Bullet Punch',
  'Infernape @ Life Orb | Blaze | Naive | 252 Atk / 4 SpA / 252 Spe | Close Combat, Flare Blitz, U-turn, Stone Edge',
  'Breloom @ Life Orb | Technician | Jolly | 4 HP / 252 Atk / 252 Spe | Mach Punch, Bullet Seed, Spore, Swords Dance',
  'Gyarados @ Leftovers | Intimidate | Adamant | 88 HP / 248 Atk / 172 Spe | Dragon Dance, Waterfall, Bounce, Earthquake',
  'Jolteon @ Choice Specs | Volt Absorb | Timid | 4 Def / 252 SpA / 252 Spe | Thunderbolt, Volt Switch, Shadow Ball, Signal Beam',
  'Alakazam @ Focus Sash | Magic Guard | Timid | 4 Def / 252 SpA / 252 Spe | Psychic, Focus Blast, Shadow Ball, Energy Ball',
  'Machamp @ Leftovers | No Guard | Adamant | 240 HP / 248 Atk / 20 Spe | Dynamic Punch, Stone Edge, Ice Punch, Bullet Punch',
  'Snorlax @ Leftovers | Thick Fat | Careful | 144 HP / 188 Def / 176 SpD | Body Slam, Crunch, Earthquake, Curse',
  'Mamoswine @ Life Orb | Thick Fat | Adamant | 4 HP / 252 Atk / 252 Spe | Icicle Crash, Earthquake, Ice Shard, Stone Edge',
  'Hydreigon @ Choice Specs | Levitate | Timid | 4 Def / 252 SpA / 252 Spe | Draco Meteor, Dark Pulse, Fire Blast, Surf',
  'Togekiss @ Leftovers | Serene Grace | Timid | 252 HP / 4 SpA / 252 Spe | Nasty Plot, Air Slash, Aura Sphere, Roost',
  'Kingdra @ Choice Specs | Swift Swim | Modest | 4 Def / 252 SpA / 252 Spe | Hydro Pump, Draco Meteor, Surf, Dragon Pulse',
  'Weavile @ Choice Band | Pressure | Jolly | 4 HP / 252 Atk / 252 Spe | Ice Punch, Night Slash, Low Kick, Ice Shard',
  'Chandelure @ Choice Scarf | Flash Fire | Timid | 4 Def / 252 SpA / 252 Spe | Fire Blast, Shadow Ball, Energy Ball, Overheat',
  'Krookodile @ Choice Band | Moxie | Jolly | 4 HP / 252 Atk / 252 Spe | Earthquake, Crunch, Stone Edge, Superpower',
  'Roserade @ Life Orb | Natural Cure | Timid | 4 Def / 252 SpA / 252 Spe | Leaf Storm, Sludge Bomb, Shadow Ball, Sleep Powder',
  'Azumarill @ Choice Band | Huge Power | Adamant | 252 HP / 252 Atk / 4 Spe | Waterfall, Aqua Jet, Superpower, Ice Punch',
  'Arcanine @ Life Orb | Flash Fire | Adamant | 4 HP / 252 Atk / 252 Spe | Flare Blitz, ExtremeSpeed, Close Combat, Wild Charge',
  'Nidoking @ Life Orb | Sheer Force | Timid | 4 Def / 252 SpA / 252 Spe | Earth Power, Sludge Wave, Ice Beam, Thunderbolt',
  'Espeon @ Life Orb | Magic Bounce | Timid | 4 Def / 252 SpA / 252 Spe | Psyshock, Shadow Ball, Grass Knot, Calm Mind',
  'Milotic @ Leftovers | Marvel Scale | Bold | 252 HP / 252 Def / 4 Spe | Scald, Recover, Ice Beam, Toxic',
  'Flygon @ Choice Scarf | Levitate | Jolly | 4 HP / 252 Atk / 252 Spe | Outrage, Earthquake, U-turn, Stone Edge',
  'Electivire @ Expert Belt | Motor Drive | Naive | 252 Atk / 4 SpA / 252 Spe | Wild Charge, Ice Punch, Earthquake, Flamethrower',
  'Cloyster @ White Herb | Skill Link | Jolly | 4 HP / 252 Atk / 252 Spe | Shell Smash, Icicle Spear, Rock Blast, Razor Shell',
  'Darmanitan @ Choice Scarf | Sheer Force | Jolly | 4 HP / 252 Atk / 252 Spe | Flare Blitz, Rock Slide, Earthquake, U-turn',
];
