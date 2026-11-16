// After a run: the verdict, how each round went, the decisive trainer's lobby
// line, the share text for official runs, and the full battle log.
import { useEffect, useRef, useState } from 'react';
import { ROUND_NAMES, ROUND_SHORT, TRAINERS } from '../lib/bracket.js';
import { formatCountdown, msUntilMidnight } from '../lib/date.js';
import { globalRateText, reportResult, useGlobalStats } from '../lib/globalStats.js';
import { SITE_HOST, SITE_URL, copyText, shareText } from '../lib/share.js';
import { liveStats } from '../lib/storage.js';
import { useNow } from '../components/ui.jsx';

const plural = (n) => (n === 1 ? '' : 's');

export function Result({ res, log, no, store, today, onPractice, onLobby }) {
  const now = useNow();
  const [toast, setToast] = useState('');
  const [showLog, setShowLog] = useState(false);
  const sharing = useRef(false);
  const daily = res.mode === 'daily';
  useEffect(() => {
    if (daily && res.date) reportResult(res.date, res.won);
  }, [daily, res.date, res.won]);
  const global = useGlobalStats(res.date, daily);
  const stats = liveStats(store.stats, today);
  const text = shareText(res, no, stats.winStreak);
  const lostTo = res.rounds.find((r) => r.won === false);
  const decisive = res.abandoned ? null : TRAINERS.find((t) => t.id === (res.won ? res.rounds.at(-1)?.id : lostTo?.id));
  const lobbyLine = decisive?.quotes ? (res.won ? decisive.quotes.lobbyLose : decisive.quotes.lobbyWin) : '';
  const canShare = typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };
  const copy = async () => flash((await copyText(text)) ? 'Copied. Paste it anywhere.' : 'Copy failed. Select the text and copy it.');
  const share = async () => {
    if (sharing.current) return;
    sharing.current = true;
    try {
      await navigator.share({ title: `PWT Today #${no}`, text: text.slice(0, text.lastIndexOf('\n')), url: SITE_URL });
    } catch (e) {
      if (e?.name !== 'AbortError') flash('Sharing unavailable. Use Copy result.');
    } finally {
      sharing.current = false;
    }
  };

  return (
    <main className="result">
      <section className="verdict">
        <small>
          {daily ? `PWT Today No. ${no}, official run` : 'Practice run, not recorded'}
          {res.cup ? ` · ${res.cup}` : ''}
        </small>
        <h1>{res.won ? 'Champion.' : res.abandoned ? 'Run abandoned.' : `${lostTo?.name || 'The bracket'} ended your run.`}</h1>
        <p>
          {res.abandoned
            ? 'Run left unfinished, counted as a loss.'
            : res.won
              ? `Three wins in a row. ${res.left} of 3 still standing after ${res.turns} turn${plural(res.turns)}.`
              : `Out in ${['round 1', 'the semifinal', 'the final'][res.roundsWon]}. You took down ${lostTo?.rDown.filter(Boolean).length ?? 0} of ${lostTo?.name}'s 3 in ${res.turns} turn${plural(res.turns)} overall.`}
        </p>
        {lobbyLine && (
          <blockquote>
            <b>{decisive.name}</b>
            {lobbyLine.split('\n').map((p, i) => (
              <span key={i}>{p}</span>
            ))}
          </blockquote>
        )}
        <div className="grid">
          <div className="grid-row">
            <span>Your team</span>
            {res.pNames.map((name, i) => (
              <b key={name} className={res.pAlive[i] ? 'alive' : 'out'} title={name}>
                {name}
              </b>
            ))}
          </div>
          {res.rounds.map((round, r) => (
            <div key={round.id} className="grid-row">
              <span title={ROUND_NAMES[r]}>
                {ROUND_SHORT[r]} {round.name}
              </span>
              {round.rDown.map((down, i) => (
                <b key={i} className={round.won === null ? 'skip' : down ? 'ko' : 'up'} title={round.won === null ? 'Not reached' : down ? 'Knocked out' : 'Still standing'}>
                  {round.won === null ? '?' : down ? 'KO' : '·'}
                </b>
              ))}
            </div>
          ))}
        </div>
        {global && <p className="dim">{globalRateText(global, res.won)}</p>}
        {log?.length > 0 && (
          <>
            <button className="link" aria-expanded={showLog} onClick={() => setShowLog((s) => !s)}>
              {showLog ? 'Hide battle log' : `Battle log, ${log.length} lines`}
            </button>
            {showLog && (
              <ol className="movelog">
                {log.map((line, i) => (
                  <li key={i} className={/^Turn \d+$/.test(line) ? 'turn' : undefined}>
                    {line}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>
      <aside>
        <section className="card">
          {daily ? (
            <>
              <h3>Share your result</h3>
              <pre>{text}</pre>
              <button className="primary" onClick={canShare ? share : copy}>
                {canShare ? 'Share result' : 'Copy result'}
              </button>
              {canShare && (
                <button className="ghost" onClick={copy}>
                  Copy result
                </button>
              )}
            </>
          ) : (
            <>
              <h3>Saved to your practice ledger</h3>
              <p>Practice runs never touch your streak. Today's official run is {store.today && store.today.status !== 'started' ? 'already done' : 'still waiting for you'}.</p>
            </>
          )}
        </section>
        <section className="card">
          <h3>Next tournament</h3>
          <p className="countdown">
            <b>{formatCountdown(msUntilMidnight(now))}</b> at local midnight
          </p>
          <button className="ghost" onClick={onPractice}>
            Practice run
          </button>
          <button className="ghost" onClick={onLobby}>
            Back to the lobby
          </button>
          <p className="dim">{SITE_HOST}</p>
        </section>
      </aside>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
