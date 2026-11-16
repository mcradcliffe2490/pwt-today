import { ROUND_SHORT } from './bracket.js';

export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

const turnsLabel = (n) => `${n} turn${n === 1 ? '' : 's'}`;
const squares = (round) => round.rDown.map((d) => (d ? '🟥' : round.won === null ? '⬜' : '⬛')).join('');

// One line per round: the trainer and how many of their three went down.
const roundLines = (res) => res.rounds.map((r, i) => `${ROUND_SHORT[i]} ${r.name} ${squares(r)}`).join('\n');
const stage = (i) => ['round 1', 'the semifinal', 'the final'][i] || `round ${i + 1}`;

export function shareText(res, no, streak) {
  const head = `PWT Today #${no}${res.cup ? ` · ${res.cup}` : ''}`;
  if (res.won)
    return `${head}: Champion 🏆\n${roundLines(res)}\n${res.pAlive.map((a) => (a ? '🟩' : '⬛')).join('')}  ${res.left}/3 left · ${turnsLabel(res.turns)}\nStreak ${streak} · #PWTToday\n${SITE_HOST}`;
  const lostTo = res.rounds.find((r) => r.won === false);
  const how = res.abandoned ? 'Run left unfinished' : `Out in ${stage(res.roundsWon)}${lostTo ? ` to ${lostTo.name}` : ''}`;
  return `${head}: ${how}\n${roundLines(res)}\n${turnsLabel(res.turns)} · #PWTToday\n${SITE_HOST}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
