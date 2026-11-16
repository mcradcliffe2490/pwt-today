// Type colours and the effectiveness chart (identical in Gens 3-5).

export const TYPE_COLORS = {
  "Normal": "#A3A07A",
  "Fire": "#D9733A",
  "Water": "#4A86C9",
  "Electric": "#E2B520",
  "Grass": "#5A9E4B",
  "Ice": "#79C2BE",
  "Fighting": "#AE443B",
  "Poison": "#94519A",
  "Ground": "#C5A15A",
  "Flying": "#7F8DD0",
  "Psychic": "#D4577C",
  "Bug": "#8E9E2C",
  "Rock": "#9C8946",
  "Ghost": "#655692",
  "Dragon": "#5848B8",
  "Dark": "#5B4C42",
  "Steel": "#98A2AF"
};

// Types whose chip uses dark text.
export const DARK_TEXT_TYPES = new Set(["Electric","Ice","Normal","Ground","Steel"]);

// Pre-Gen 4 special types; only a fallback when a move carries no category.
export const SPECIAL_TYPES = new Set(["Fire","Water","Electric","Grass","Ice","Psychic","Dragon","Dark"]);

export const TYPE_CHART = {
  "Normal": {
    "Rock": 0.5,
    "Ghost": 0,
    "Steel": 0.5
  },
  "Fire": {
    "Fire": 0.5,
    "Water": 0.5,
    "Grass": 2,
    "Ice": 2,
    "Bug": 2,
    "Rock": 0.5,
    "Dragon": 0.5,
    "Steel": 2
  },
  "Water": {
    "Fire": 2,
    "Water": 0.5,
    "Grass": 0.5,
    "Ground": 2,
    "Rock": 2,
    "Dragon": 0.5
  },
  "Electric": {
    "Water": 2,
    "Electric": 0.5,
    "Grass": 0.5,
    "Ground": 0,
    "Flying": 2,
    "Dragon": 0.5
  },
  "Grass": {
    "Fire": 0.5,
    "Water": 2,
    "Grass": 0.5,
    "Poison": 0.5,
    "Ground": 2,
    "Flying": 0.5,
    "Bug": 0.5,
    "Rock": 2,
    "Dragon": 0.5,
    "Steel": 0.5
  },
  "Ice": {
    "Fire": 0.5,
    "Water": 0.5,
    "Grass": 2,
    "Ice": 0.5,
    "Ground": 2,
    "Flying": 2,
    "Dragon": 2,
    "Steel": 0.5
  },
  "Fighting": {
    "Normal": 2,
    "Ice": 2,
    "Poison": 0.5,
    "Flying": 0.5,
    "Psychic": 0.5,
    "Bug": 0.5,
    "Rock": 2,
    "Ghost": 0,
    "Dark": 2,
    "Steel": 2
  },
  "Poison": {
    "Grass": 2,
    "Poison": 0.5,
    "Ground": 0.5,
    "Rock": 0.5,
    "Ghost": 0.5,
    "Steel": 0
  },
  "Ground": {
    "Fire": 2,
    "Electric": 2,
    "Grass": 0.5,
    "Poison": 2,
    "Flying": 0,
    "Bug": 0.5,
    "Rock": 2,
    "Steel": 2
  },
  "Flying": {
    "Electric": 0.5,
    "Grass": 2,
    "Fighting": 2,
    "Bug": 2,
    "Rock": 0.5,
    "Steel": 0.5
  },
  "Psychic": {
    "Fighting": 2,
    "Poison": 2,
    "Psychic": 0.5,
    "Dark": 0,
    "Steel": 0.5
  },
  "Bug": {
    "Fire": 0.5,
    "Grass": 2,
    "Fighting": 0.5,
    "Poison": 0.5,
    "Flying": 0.5,
    "Psychic": 2,
    "Ghost": 0.5,
    "Dark": 2,
    "Steel": 0.5
  },
  "Rock": {
    "Fire": 2,
    "Ice": 2,
    "Fighting": 0.5,
    "Ground": 0.5,
    "Flying": 2,
    "Bug": 2,
    "Steel": 0.5
  },
  "Ghost": {
    "Normal": 0,
    "Psychic": 2,
    "Ghost": 2,
    "Dark": 0.5,
    "Steel": 0.5
  },
  "Dragon": {
    "Dragon": 2,
    "Steel": 0.5
  },
  "Dark": {
    "Fighting": 0.5,
    "Psychic": 2,
    "Ghost": 2,
    "Dark": 0.5,
    "Steel": 0.5
  },
  "Steel": {
    "Fire": 0.5,
    "Water": 0.5,
    "Electric": 0.5,
    "Ice": 2,
    "Rock": 2,
    "Steel": 0.5
  }
};

export const effectiveness = (type, defTypes) =>
  defTypes.reduce((acc, t) => acc * ((TYPE_CHART[type] || {})[t] ?? 1), 1);
