import { useEffect, useState } from 'react';

// Global "N% of players won today's tournament" counter. Served locally by the
// stats-api plugin in vite.config.js; each browser reports once per day.
const SENT_KEY = 'pwttoday_global_sent';
const MIN_PLAYERS = 30;

export async function reportResult(date, won) {
  try {
    if (localStorage.getItem(SENT_KEY) === date) return;
    localStorage.setItem(SENT_KEY, date);
    await fetch('/api/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date, won }),
      keepalive: true,
    });
  } catch {}
}

export function useGlobalStats(date, enabled) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!enabled || !date) return;
    let live = true;
    const timer = setTimeout(() => {
      fetch(`/api/stats?date=${date}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (live && s && Number.isInteger(s.played) && Number.isInteger(s.wins) && s.played >= MIN_PLAYERS)
            setStats({ played: s.played, wins: Math.min(s.wins, s.played) });
        })
        .catch(() => {});
    }, 600);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [date, enabled]);
  return stats;
}

export const globalRateText = (s, won) =>
  `${Math.round((s.wins / s.played) * 100)}% of ${s.played.toLocaleString('en-US')} players won today's tournament.${
    won === undefined ? '' : won ? ' You are one of them.' : ''
  }`;
