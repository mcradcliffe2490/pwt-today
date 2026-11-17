// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { POOL_VERSION, dailyBracket, dailyTeam } from '../src/lib/bracket.js';
import { STORE_KEY, load, loadLead, saveLead, savePractice, saveResult, saving, view } from '../src/lib/storage.js';

const date = '2026-11-16';
const result = (won) => ({
  date,
  mode: 'daily',
  cup: 'Kanto Leaders',
  won,
  abandoned: false,
  left: won ? 2 : 0,
  pAlive: [true, true, false].map((a) => a && won),
  pNames: ['A', 'B', 'C'],
  turns: 12,
  rounds: dailyBracket(date).map((t, i) => ({ id: t.id, name: t.name, title: t.title, won: won || i === 0 ? true : i === 1 ? false : null, rDown: [true, true, won || i === 0], turns: 4 })),
  roundsWon: won ? 3 : 1,
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('carries a Daily PWT record over and ignores junk', () => {
    const journal = {
      version: 1,
      poolVersion: POOL_VERSION,
      date: '2026-11-15',
      seed: '2026-11-15',
      startedAt: 1,
      initialTeam: dailyTeam('2026-11-15'),
      bracket: dailyBracket('2026-11-15'),
      initialLead: 0,
      actions: [{ type: 'move', idx: 0 }],
    };
    localStorage.setItem(
      'dailytournament_v1',
      JSON.stringify({ version: 1, days: { '2026-11-14': { date: '2026-11-14', status: 'won', result: result(true) }, '2026-11-15': { date: '2026-11-15', status: 'started', journal }, junk: { status: 'won' }, '2026-11-13': { status: 'lost', result: { won: false } } } }),
    );
    const store = load();
    expect(Object.keys(store.days).sort()).toEqual(['2026-11-14', '2026-11-15']);
    expect(store.days['2026-11-15'].status).toBe('started');
    expect(view('2026-11-14').stats.played).toBe(1);
    // A journal from another pool version can't be replayed: it is voided.
    localStorage.setItem('dailytournament_v1', JSON.stringify({ version: 1, days: { '2026-11-15': { date: '2026-11-15', status: 'started', journal: { ...journal, poolVersion: -1 } } } }));
    expect(load().days['2026-11-15']).toEqual({ status: 'void' });
  });

  it('sets an unreadable record aside instead of overwriting it', () => {
    localStorage.setItem(STORE_KEY, '{"version":2,"days":{"2026-11-15"');
    load();
    saveResult(date, result(true));
    expect(localStorage.getItem(`${STORE_KEY}_unreadable`)).toBe('{"version":2,"days":{"2026-11-15"');
    expect(view(date).today.won).toBe(true);
  });

  it('reports when the browser refuses to save', () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    try {
      saveResult(date, result(true));
      expect(saving()).toBe(false);
    } finally {
      Storage.prototype.setItem = setItem;
    }
    saveResult(date, result(true));
    expect(saving()).toBe(true);
  });

  it('records official results once and streaks across consecutive days', () => {
    saveResult('2026-11-15', result(true));
    saveResult(date, result(false));
    saveResult(date, result(true));
    const v = view(date);
    expect(v.today.won).toBe(false);
    expect(v.stats).toMatchObject({ played: 2, wins: 1, dayStreak: 2, winStreak: 0 });
    expect(JSON.parse(localStorage.getItem(STORE_KEY)).version).toBe(2);
  });

  it('keeps today\'s practice ledger, newest last, capped at eight', () => {
    savePractice('2026-11-15', result(false), ['old']);
    for (let i = 0; i < 10; i++) savePractice(date, result(i % 2 === 0), [`Turn 1`, `line ${i}`]);
    const runs = view(date).practice;
    expect(runs).toHaveLength(8);
    expect(runs.map((r) => r.no)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(runs.at(-1).log).toEqual(['Turn 1', 'line 9']);
    expect(view('2026-11-15').practice).toEqual([]);
  });

  it('remembers the lobby lead for that day only', () => {
    expect(loadLead(date)).toBe(0);
    saveLead(date, 2);
    expect(loadLead(date)).toBe(2);
    expect(loadLead('2026-11-17')).toBe(0);
    localStorage.setItem('pwttoday_lead', '{"date":"2026-11-16","lead":7}');
    expect(loadLead(date)).toBe(0);
  });
});
