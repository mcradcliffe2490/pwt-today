// Screen router and the run lifecycle: lobby → battle → result. Official runs
// are journaled as they go and locked to one tab; practice runs are kept in
// today's ledger.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Battle } from './screens/Battle.jsx';
import { Lobby } from './screens/Lobby.jsx';
import { Result } from './screens/Result.jsx';
import { POOL_VERSION, dailyTeam, dailyTournament } from './lib/bracket.js';
import { formatCountdown, msUntilMidnight, puzzleNumber, shortDate, today as getToday } from './lib/date.js';
import { isReloading, reloadOnce } from './lib/staleReload.js';
import { STORE_KEY, journalFor, loadLead, lockDay, saveLead, savePractice, saveJournal, saveResult, view, voidDay, voidStaleBattles } from './lib/storage.js';
import { useNow } from './components/ui.jsx';

function Header({ no, today, onLobby }) {
  const now = useNow();
  return (
    <header>
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onLobby();
        }}
      >
        PWT <span>Today</span>
      </a>
      <span className="clock">
        No. {no} · {shortDate(today)} · next in {now === null ? '--:--:--' : formatCountdown(msUntilMidnight(now))}
      </span>
    </header>
  );
}

export function App() {
  const [today, setToday] = useState(getToday);
  const [store, setStore] = useState(() => view(today));
  const [lead, setLead] = useState(() => loadLead(today));
  const [screen, setScreen] = useState('lobby');
  const [run, setRun] = useState(null);
  const [result, setResult] = useState(null);
  const decided = useRef(null);
  const release = useRef(null);
  const starting = useRef(false);
  const team = useMemo(() => dailyTeam(today), [today]);
  const tournament = useMemo(() => dailyTournament(today), [today]);

  // Re-read the clock and storage every second, on focus, and when another tab writes.
  useEffect(() => {
    const refresh = () => {
      const d = getToday();
      setToday((prev) => {
        if (prev !== d) setLead(loadLead(d));
        return d;
      });
      setStore(view(d));
    };
    voidStaleBattles(getToday()).then(refresh, () => {});
    const timer = setInterval(refresh, 1000);
    const onStorage = (e) => e.key === STORE_KEY && refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
      release.current?.();
    };
  }, []);

  const unlock = () => {
    release.current?.();
    release.current = null;
  };
  const show = (next) => {
    setScreen(next);
    window.scrollTo(0, 0);
  };
  const toLobby = () => {
    unlock();
    setStore(view(getToday()));
    show('lobby');
  };

  const start = async (mode) => {
    if (starting.current) return;
    starting.current = true;
    try {
      const d = getToday();
      let journal = null;
      if (mode === 'daily') {
        release.current = await lockDay(d);
        const v = view(d);
        if (v.today && v.today.status !== 'started') {
          unlock();
          setStore(v);
          setResult({ res: v.today, log: [] });
          return show('result');
        }
        journal = journalFor(d);
      }
      const seed = mode === 'daily' ? d : `${d}:practice:${crypto.randomUUID()}`;
      const t = dailyTournament(d);
      setRun({
        mode,
        date: d,
        seed: journal?.seed || seed,
        team: journal?.initialTeam || dailyTeam(d),
        bracket: journal?.bracket || t.bracket,
        cup: journal?.cup || t.cup.name,
        lead: journal?.initialLead ?? (d === today ? lead : 0),
        saved: journal || undefined,
        startedAt: journal?.startedAt || Date.now(),
        key: crypto.randomUUID(),
      });
      decided.current = null;
      show('battle');
    } catch (e) {
      unlock();
      window.alert(e instanceof Error ? e.message : 'Unable to start the run.');
    } finally {
      starting.current = false;
    }
  };

  const journal = (state, log, actions) => ({
    version: 1,
    poolVersion: POOL_VERSION,
    date: run.date,
    seed: run.seed,
    cup: run.cup,
    initialTeam: run.team,
    bracket: run.bracket,
    initialLead: run.lead,
    startedAt: run.startedAt,
    state,
    log,
    actions,
  });
  const persist = (state, log, actions) => {
    saveJournal(journal(state, log, actions));
    setStore(view(getToday()));
  };

  // Turns the final run state into a result once; official ones are recorded here.
  const decide = (state, abandoned) => {
    if (decided.current) return decided.current;
    const history = [...state.history];
    if (abandoned && state.phase === 'battle') history.push({ ...state.trainer, won: false, rDown: state.r.map((m) => m.hp <= 0), turns: state.completedTurns });
    const rounds = run.bracket.map(({ id, name, title }, i) => {
      const h = history[i];
      return { id, name, title, won: h ? h.won : null, rDown: h ? h.rDown : [false, false, false], turns: h?.turns ?? 0 };
    });
    const res = {
      date: run.date,
      mode: run.mode,
      cup: run.cup,
      won: state.outcome === 'won' && !abandoned,
      abandoned: !!abandoned,
      left: state.p.filter((m) => m.hp > 0).length,
      pAlive: state.p.map((m) => m.hp > 0),
      pNames: state.p.map((m) => m.name),
      turns: Math.max(1, state.totalTurns ?? 0),
      rounds,
      roundsWon: rounds.filter((r) => r.won).length,
    };
    decided.current = res;
    if (run.mode === 'daily') setStore(view(getToday(), saveResult(run.date, res)));
    return res;
  };

  const no = puzzleNumber(today);
  return (
    <>
      <Header no={no} today={today} onLobby={toLobby} />
      {screen === 'lobby' && (
        <Lobby
          today={today}
          team={team}
          tournament={tournament}
          lead={lead}
          setLead={(i) => {
            setLead(i);
            saveLead(today, i);
          }}
          store={store}
          resumable={store.today?.status === 'started'}
          onStart={() => start('daily')}
          onPractice={() => start('practice')}
          onShowResult={() => {
            setResult({ res: store.today, log: [] });
            show('result');
          }}
        />
      )}
      {screen === 'battle' && run && (
        <Battle
          key={run.key}
          run={run}
          no={puzzleNumber(run.date)}
          onFinish={(state, abandoned, log) => {
            const res = decide(state, abandoned);
            if (run.mode === 'practice') setStore(view(getToday(), savePractice(run.date, res, log)));
            unlock();
            setResult({ res, log });
            show('result');
          }}
          onDecide={decide}
          onCommit={() => {}}
          onSave={persist}
          onPending={(action, state, log, actions) => persist(state, log, [...actions, action])}
          onError={(message, stale) => {
            if (isReloading()) return;
            if (stale && reloadOnce()) return;
            if (run.mode === 'daily') setStore(view(getToday(), voidDay(run.date)));
            window.alert(`Run interrupted: ${message} You can start again.`);
            toLobby();
          }}
        />
      )}
      {screen === 'result' && result && (
        <Result res={result.res} log={result.log} no={puzzleNumber(result.res.date || today)} store={store} today={today} onPractice={() => start('practice')} onLobby={toLobby} />
      )}
      <footer>
        PWT Today is a free, unofficial fan project inspired by Daily Red. It isn't affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company;
        Pokémon, trainer names, dialogue and sprites are theirs. Battles run on Pokémon Showdown's simulator.
      </footer>
    </>
  );
}
