import { describe, expect, it } from 'vitest';
import { onRequestGet, onRequestPost, plausible } from '../functions/api/stats.js';

// Just enough of D1 for the two statements the function runs.
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          const [date, visitor, won] = args;
          if (!rows.has(`${date}/${visitor}`)) rows.set(`${date}/${visitor}`, { date, won });
        },
        first: async () => {
          const day = [...rows.values()].filter((r) => r.date === args[0]);
          return { played: day.length, wins: day.reduce((n, r) => n + r.won, 0) };
        },
      }),
    }),
  };
}
const today = new Date().toISOString().slice(0, 10);
const post = (env, body, ip = '1.1.1.1') =>
  onRequestPost({ env, request: new Request('https://pwt-today.com/api/stats', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify(body) }) });
const get = (env, date) => onRequestGet({ env, request: new Request(`https://pwt-today.com/api/stats?date=${date}`) });

describe('stats function', () => {
  it('counts one result per visitor per day', async () => {
    const env = { DB: fakeDb() };
    expect((await post(env, { date: today, won: true })).status).toBe(204);
    await post(env, { date: today, won: false });
    await post(env, { date: today, won: false }, '2.2.2.2');
    expect(await (await get(env, today)).json()).toEqual({ date: today, played: 2, wins: 1 });
    // Nothing identifying is stored.
    expect([...env.DB.rows.keys()].some((k) => k.includes('1.1.1.1'))).toBe(false);
  });

  it('rejects malformed or far-off dates and bad bodies', async () => {
    const env = { DB: fakeDb() };
    expect((await post(env, { date: '2020-01-01', won: true })).status).toBe(400);
    expect((await post(env, { date: today, won: 'yes' })).status).toBe(400);
    expect((await get(env, 'nope')).status).toBe(400);
    expect(env.DB.rows.size).toBe(0);
    const now = Date.parse('2026-11-16T12:00:00Z');
    expect(['2026-11-15', '2026-11-16', '2026-11-17'].every((d) => plausible(d, now))).toBe(true);
    expect(plausible('2026-11-14', now)).toBe(false);
  });
});
