// The battle screen. The worker owns the real state; `view` is the per-event
// snapshot the narration replays so HP bars and sprites move with the text.
import { useEffect, useRef, useState } from 'react';
import { ROUND_NAMES } from '../lib/bracket.js';
import { snapshotOf } from '../lib/snapshot.js';
import { StaleAssetError, isStaleImportError } from '../lib/staleReload.js';
import { ConfirmMenu, LeadMenu, MoveMenu, NextUp, PartyMenu } from '../components/menus.jsx';
import { Scene, TextBox } from '../components/scene.jsx';

const FAST_KEY = 'pwttoday_fast';
const DIALOGUE_KEY = 'pwttoday_dialogue';
const setting = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
};
const remember = (key, on) => {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {}
};

// Scene state from the narration's fx cues: who stands on the foe's platform,
// whether their Pokémon is hidden, and a counter that replays the Poké Ball.
const NO_STAGE = { who: null, pose: null, foeHidden: false, ball: 0 };
function nextStage(st, ev) {
  if (ev.fx === 'trainer-in') return st.pose === 'in' && st.who?.id === ev.who.id ? st : { ...st, who: ev.who, pose: 'in', foeHidden: true };
  if (ev.fx === 'throw') return { ...st, pose: ev.opening ? 'out' : st.pose, foeHidden: false, ball: st.ball + 1 };
  if (ev.fx === 'trainer-back') return st.pose === 'back' ? st : { ...st, who: ev.who, pose: 'back', foeHidden: true };
  return st;
}

const spoken = (ev) => !!ev.speaker || ev.kind === 'call';
// How long a line stays up. Dialogue scales with length; with the box off it only goes to the log.
function holdFor(ev, fast, dialogue) {
  if (ev.kind === 'quiet' || (spoken(ev) && !dialogue)) return fast ? 90 : 300;
  const ms = spoken(ev) ? (fast ? 1400 + ev.text.length * 40 : 2200 + ev.text.length * 60) : fast ? 320 : 900;
  return ev.fx === 'throw' ? Math.max(ms, fast ? 700 : 1100) : ms;
}

function Toggle({ label, on, setOn, labels }) {
  return (
    <div className="setting">
      <span>{label}</span>
      <div className="seg">
        <button className={on ? 'on' : ''} onClick={() => setOn(true)}>
          {labels[0]}
        </button>
        <button className={on ? '' : 'on'} onClick={() => setOn(false)}>
          {labels[1]}
        </button>
      </div>
    </div>
  );
}

export function Battle({ run, no, onFinish, onDecide, onCommit, onSave, onPending, onError }) {
  const { mode, team, bracket, lead, seed, saved } = run;
  const daily = mode === 'daily';
  const client = useRef(null);
  const stateRef = useRef(null);
  const timers = useRef([]);
  const logEl = useRef(null);
  const actions = useRef(saved?.actions || []);
  const busy = useRef(true);
  const alive = useRef(true);
  const committed = useRef(!!saved);
  const advance = useRef(null);
  const [state, setState] = useState(null);
  const [view, setView] = useState(null);
  const [log, setLog] = useState([]);
  const [message, setMessage] = useState('');
  const [speaker, setSpeaker] = useState(null);
  const [stage, setStage] = useState(NO_STAGE);
  const [playing, setPlaying] = useState(true);
  const [party, setParty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [fast, setFast] = useState(() => setting(FAST_KEY, true));
  const [dialogue, setDialogue] = useState(() => setting(DIALOGUE_KEY, true));
  const prefs = useRef({ fast, dialogue });
  prefs.current = { fast, dialogue };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (logEl.current) logEl.current.scrollTop = logEl.current.scrollHeight;
  }, [log]);

  // Narration finished: the battle ended, a switch is forced, or it's time to pick a move.
  const settle = () => {
    const s = stateRef.current;
    if (!s) return;
    setSpeaker(null);
    if (s.outcome) timers.current.push(setTimeout(() => onFinish(s, false, logLines()), 1200));
    else if (s.needLead) setMessage(`${ROUND_NAMES[s.round - 1]}: ${s.trainer.name}. Choose your lead.`);
    else if (s.needSwitch) {
      setParty(true);
      setMessage('Choose a POKéMON.');
    } else {
      const moves = s.p[s.pa].moves;
      setCursor((c) => (moves[c]?.pp > 0 ? c : Math.max(0, moves.findIndex((m) => m.pp > 0))));
      setMessage(`What will ${s.p[s.pa].name} do?`);
    }
  };
  const logRef = useRef([]);
  const logLines = () => logRef.current.map((e) => e.text);
  const appendLog = (events) => {
    logRef.current = [...logRef.current, ...events.filter((e) => e.text).map(({ text, kind }) => ({ text, kind }))];
    setLog(logRef.current);
  };

  const play = (events) => {
    setPlaying(true);
    let i = 0;
    let pending;
    const step = () => {
      clearTimeout(pending);
      if (i >= events.length) {
        advance.current = null;
        setPlaying(false);
        busy.current = false;
        settle();
        return;
      }
      const ev = events[i++];
      if (ev.snap) setView(ev.snap);
      if (ev.text) appendLog([ev]);
      if (ev.fx) setStage((st) => nextStage(st, ev));
      if (ev.kind === 'turn') return step();
      if (ev.kind !== 'quiet' && (prefs.current.dialogue || !spoken(ev))) {
        const call = ev.kind === 'call' && ev.text.startsWith('Announcer: ');
        setSpeaker(ev.speaker || (call ? 'Announcer' : null));
        setMessage(ev.speaker ? ev.line : call ? ev.text.slice(11) : ev.text);
      }
      pending = setTimeout(step, holdFor(ev, prefs.current.fast, prefs.current.dialogue));
      timers.current.push(pending);
    };
    advance.current = step;
    step();
  };

  // Click the text box, or Enter/Z/Space, to move on to the next line.
  useEffect(() => {
    if (!playing) return;
    const listen = (e) => {
      if (e.repeat || !['Enter', 'z', 'Z', ' '].includes(e.key)) return;
      if (e.target instanceof HTMLElement && e.target.closest('button,a,input,select')) return;
      e.preventDefault();
      advance.current?.();
    };
    window.addEventListener('keydown', listen);
    return () => window.removeEventListener('keydown', listen);
  }, [playing]);

  useEffect(() => {
    let cancelled = false;
    import('../battle/client.js')
      .catch((e) => {
        throw isStaleImportError(e) ? new StaleAssetError(e.message) : e;
      })
      .then(async ({ BattleClient }) => {
        if (cancelled) return;
        client.current = new BattleClient();
        const init = await client.current.init({ team, bracket, lead, seed, actions: saved?.actions });
        if (cancelled) return;
        stateRef.current = init.s;
        setState(init.s);
        if (!saved) return play(init.ev);
        if (init.s.outcome) {
          onDecide(init.s, false);
          return onFinish(init.s, false, []);
        }
        appendLog([...init.ev, { text: 'Run resumed.', kind: 'quiet' }]);
        setView(snapshotOf(init.s));
        setPlaying(false);
        busy.current = false;
        settle();
      })
      .catch((e) => !cancelled && onError(e instanceof Error ? e.message : 'The battle could not start.', e instanceof StaleAssetError));
    return () => {
      cancelled = true;
      alive.current = false;
      client.current?.dispose();
    };
  }, []);

  const act = async (action) => {
    const s = stateRef.current;
    if (playing || busy.current || confirming || !s || s !== state || s.outcome) return;
    if (action.type === 'lead' ? !s.needLead : s.needLead) return;
    if (action.type === 'move') {
      const mon = s.p[s.pa];
      const move = mon.moves[action.idx];
      if (s.needSwitch || party) return;
      if (action.idx === -1 ? !(mon.struggle ?? mon.moves.every((m) => m.pp <= 0)) : !move || move.pp <= 0 || move.disabled || mon.struggle) return;
    }
    if (daily && !committed.current) {
      committed.current = true;
      onCommit();
    }
    busy.current = true;
    setPlaying(true);
    setParty(false);
    try {
      // Journal the pending action first so a reload mid-turn replays it.
      if (daily) onPending(action, s, log, actions.current);
      const r = await client.current.choose(action);
      if (!alive.current) return;
      stateRef.current = r.s;
      setState(r.s);
      if (r.error) {
        if (daily) onSave(r.s, log, actions.current);
        setMessage(r.error);
        setView(snapshotOf(r.s));
        setPlaying(false);
        busy.current = false;
        if (r.s.needSwitch) setParty(true);
        window.alert(r.error);
        return;
      }
      actions.current = [...actions.current, action];
      if (r.s.outcome) onDecide(r.s, false);
      else if (daily) onSave(r.s, [...log, ...r.ev.filter((e) => e.text).map(({ text, kind }) => ({ text, kind }))], actions.current);
      play(r.ev);
    } catch (e) {
      if (alive.current) onError(e instanceof Error ? e.message : 'The battle failed.', false);
    }
  };

  const forfeit = () => {
    if (daily && !committed.current) {
      committed.current = true;
      onCommit();
    }
    busy.current = true;
    onFinish({ ...stateRef.current, outcome: 'lost' }, true, logLines());
  };

  if (!view || !state) return <div className="loading">Entering the stadium…</div>;

  const choosingLead = !playing && !state.outcome && state.needLead && !confirming;
  const canAct = !playing && !state.outcome && !state.needSwitch && !state.needLead && !party && !confirming;
  // While a finished round's outro plays, the engine already holds the next
  // trainer; keep labelling the one still on the field.
  const outro = playing && state.needLead;
  const roundNo = outro ? state.round - 1 : state.round;
  const foeName = (outro ? bracket[state.round - 2]?.name : null) || state.trainer.name;
  const foeHp = view.r[view.ra];
  const myHp = view.p[view.pa];
  const foeMon = foeHp.name ? foeHp : state.r[view.ra];
  const myMon = myHp.name ? myHp : state.p[view.pa];

  return (
    <div className="battle">
      <div className="battle-main">
        <div className="battle-bar">
          <span className={`pill ${mode}`}>{daily ? `PWT Today No. ${no}, official run` : 'Practice run, not recorded'}</span>
          <span>
            {ROUND_NAMES[roundNo - 1]}
            {state.needLead && !outro ? '' : ` · Turn ${view.turn}`}
          </span>
        </div>
        <Scene
          foe={foeMon}
          foeHp={foeHp}
          me={myMon}
          meHp={myHp}
          foeParty={view.r}
          myParty={view.p}
          foeActive={view.ra}
          myActive={view.pa}
          owner={foeName.toUpperCase()}
          stage={choosingLead ? { ...stage, who: null } : stage}
          overlay={choosingLead && bracket[state.round - 1] ? <NextUp round={ROUND_NAMES[state.round - 1]} trainer={bracket[state.round - 1]} lead={state.r[0]} /> : null}
        >
          {confirming ? (
            <ConfirmMenu
              daily={daily}
              onYes={forfeit}
              onNo={() => {
                setConfirming(false);
                setTimeout(() => document.querySelector('.choice.cur:not(:disabled)')?.focus());
              }}
            />
          ) : choosingLead ? (
            <LeadMenu state={state} onPick={(idx) => act({ type: 'lead', idx })} />
          ) : canAct ? (
            <MoveMenu
              mon={state.p[state.pa]}
              foe={state.r[state.ra]}
              cursor={cursor}
              setCursor={setCursor}
              onPick={(idx) => act({ type: 'move', idx })}
              canSwitch={state.canSwitch !== false}
              onSwitch={() => setParty(true)}
              onRun={() => setConfirming(true)}
            />
          ) : (
            <TextBox text={message} speaker={speaker} caret={playing} onAdvance={playing ? () => advance.current?.() : undefined} />
          )}
        </Scene>
        <p className="hint">Arrow keys move the cursor, Enter attacks. Click the text box or press Enter to skip ahead. POKéMON switches, RUN forfeits the whole run.</p>
      </div>
      <aside className="log">
        <div className="log-head">
          <h4>Battle log</h4>
          <span>
            You {view.p.filter((m) => m.hp > 0).length}, {foeName} {view.r.filter((m) => m.hp > 0).length}
          </span>
        </div>
        <div className="log-body" ref={logEl}>
          {log.map((e, i) => (
            <div key={i} className={`line ${e.kind}`}>
              {e.text}
            </div>
          ))}
        </div>
        <Toggle
          label="Dialogue box"
          on={dialogue}
          setOn={(on) => {
            setDialogue(on);
            remember(DIALOGUE_KEY, on);
          }}
          labels={['On', 'Log only']}
        />
        <Toggle
          label="Text speed"
          on={!fast}
          setOn={(normal) => {
            setFast(!normal);
            remember(FAST_KEY, !normal);
          }}
          labels={['Normal', 'Fast']}
        />
      </aside>
      {party && <PartyMenu state={state} forced={state.needSwitch} onPick={(idx) => act({ type: 'switch', idx })} onClose={() => setParty(false)} />}
    </div>
  );
}
