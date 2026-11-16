// The lobby: today's tournament at the reception desk, the three trainers on
// your path, your party, and the ledger of today's practice runs.
import { useId, useState } from 'react';
import { ROUND_NAMES } from '../lib/bracket.js';
import { bestAgainst, damageLabel } from '../lib/matchups.js';
import { liveStats, saving } from '../lib/storage.js';
import { MonTile, TrainerTile, TypeChips, TypeDot, abilityText, baseStatTotal } from '../components/ui.jsx';

const plural = (n) => (n === 1 ? '' : 's');
const stageName = (i) => ['round 1', 'the semifinal', 'the final'][i] || `round ${i + 1}`;
const outcomeText = (res) =>
  res.abandoned ? 'Run left unfinished' : res.won ? `Champion in ${res.turns} turn${plural(res.turns)}` : `Out in ${stageName(res.roundsWon)} to ${res.rounds.find((r) => r.won === false)?.name ?? 'the bracket'} · ${res.turns} turn${plural(res.turns)}`;

function Disclosure({ label, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button className="link" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {open ? label[1] : label[0]}
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </>
  );
}

// One Pokémon's full set, with your best answer to it when `team` is given.
function SetCard({ mon, trainer, team, ivs }) {
  const answers = team ? bestAgainst(team, trainer, mon.name).slice(0, 2) : [];
  return (
    <li className="set">
      <div className="set-head">
        <MonTile mon={mon} size={44} />
        <span>
          <b>{mon.name}</b>
          <TypeChips types={mon.types} />
        </span>
      </div>
      <dl>
        <dt>Item</dt>
        <dd>{mon.item}</dd>
        <dt>Ability</dt>
        <dd>{mon.ability}</dd>
        <dt>Nature</dt>
        <dd>{mon.nature}</dd>
        {ivs && (
          <>
            <dt>IVs</dt>
            <dd>{mon.ivs[0]} in every stat</dd>
          </>
        )}
      </dl>
      <ul className="moves">
        {mon.moves.map((m) => (
          <li key={m.name}>
            <TypeDot type={m.data.type} />
            {m.name}
          </li>
        ))}
      </ul>
      {answers.length > 0 && (
        <ul className="answers">
          {answers.map(({ mon: mine, hit, back, speed }) => (
            <li key={mine.name}>
              <b>{mine.name}</b> {hit.move} <em>{damageLabel(hit)}</em>
              <small>
                {speed > 0 ? 'Faster' : speed < 0 ? 'Slower' : 'Speed tie'}
                {back ? ` · takes ${damageLabel(back)} from ${back.move}` : " · can't be damaged"}
              </small>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Opponent({ trainer, round, team }) {
  return (
    <li className="opponent">
      <div className="opponent-head">
        <div>
          <span className="round">{ROUND_NAMES[round]}</span>
          <h3>{trainer.name}</h3>
          <p className="sub">
            {trainer.title} · {trainer.region}
          </p>
        </div>
        <TrainerTile trainer={trainer} size={72} />
      </div>
      {trainer.quotes?.announce && <p className="call">{trainer.quotes.announce}</p>}
      <ul className="lineup">
        {trainer.team.map((mon, i) => (
          <li key={mon.name}>
            <MonTile mon={mon} size={56} />
            <b>{mon.name}</b>
            <small>{i === 0 && trainer.ace ? 'ace, leads' : mon.item}</small>
          </li>
        ))}
      </ul>
      <Disclosure label={['Full sets and your best answers', 'Hide sets']}>
        <ol className="sets">
          {trainer.team.map((mon) => (
            <SetCard key={mon.name} mon={mon} trainer={trainer} team={team} ivs />
          ))}
        </ol>
      </Disclosure>
    </li>
  );
}

function PartyCard({ mon, isLead, locked, onLead }) {
  const [help, setHelp] = useState(false);
  const blurb = abilityText(mon.ability);
  return (
    <li className={`member${isLead ? ' lead' : ''}`}>
      {isLead && <span className="badge">LEAD</span>}
      <div className="set-head">
        <MonTile mon={mon} size={72} />
        <span>
          <b>{mon.name}</b>
          <TypeChips types={mon.types} />
        </span>
      </div>
      <dl>
        <dt>Item</dt>
        <dd>{mon.item}</dd>
        <dt>Ability</dt>
        <dd>
          {blurb ? (
            <button className="link" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
              {mon.ability}
            </button>
          ) : (
            mon.ability
          )}
        </dd>
        <dt>Nature</dt>
        <dd>{mon.nature}</dd>
        <dt>Base stats</dt>
        <dd>{baseStatTotal(mon)}</dd>
      </dl>
      {help && <p className="blurb">{blurb}</p>}
      <div className="stats">
        {[
          ['HP', mon.max],
          ['Atk', mon.stats.atk],
          ['Def', mon.stats.def],
          ['SpA', mon.stats.spa],
          ['SpD', mon.stats.spd],
          ['Spe', mon.stats.spe],
        ].map(([k, v]) => (
          <span key={k}>
            <small>{k}</small>
            <b>{v}</b>
          </span>
        ))}
      </div>
      <ul className="moves">
        {mon.moves.map((m) => (
          <li key={m.name}>
            <TypeDot type={m.data.type} />
            {m.name}
          </li>
        ))}
      </ul>
      {!isLead && !locked && (
        <button className="ghost" onClick={onLead}>
          Set as lead
        </button>
      )}
    </li>
  );
}

function Squares({ res }) {
  return (
    <span className="squares" aria-hidden="true">
      {res.rounds.map((r) => (
        <span key={r.id} className={r.won === null ? 'skip' : r.won ? 'won' : 'lost'} title={r.name} />
      ))}
    </span>
  );
}

function Ledger({ runs }) {
  if (!runs.length)
    return <p className="dim">No practice runs yet today. A practice run uses today's exact draw and never touches your streak.</p>;
  return (
    <ol className="ledger">
      {[...runs].reverse().map((run) => (
        <li key={run.no}>
          <div className="ledger-row">
            <b>#{run.no}</b>
            <span>{new Date(run.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            <Squares res={run.result} />
            <span className="grow">{outcomeText(run.result)}</span>
          </div>
          <Disclosure label={['Move log', 'Hide log']}>
            <ol className="movelog">
              {run.log.map((line, i) => (
                <li key={i} className={/^Turn \d+$/.test(line) ? 'turn' : undefined}>
                  {line}
                </li>
              ))}
            </ol>
          </Disclosure>
        </li>
      ))}
    </ol>
  );
}

export function Lobby({ today, team, tournament, lead, setLead, store, resumable, onStart, onPractice, onShowResult }) {
  const { cup, bracket } = tournament;
  const done = store.today && store.today.status !== 'started' ? store.today : null;
  const stats = liveStats(store.stats, today);
  return (
    <main className="lobby">
      {!saving() && (
        <p className="notice" role="alert">
          This browser isn't saving your progress, so streaks and results will be lost when you close the tab. Private
          windows and blocked site data do this; a normal window keeps them.
        </p>
      )}
      <section className="desk">
        <small>Today's tournament</small>
        <h1>{cup.name}</h1>
        <p>
          Single Battle, three on three, level 100, Gen 5 rules. Same draw for everyone today.
          {cup.id === 'world' ? ' World Leaders bring their stronger sets.' : ''}
        </p>
        {done ? (
          <div className="desk-actions">
            <span className="status">
              {outcomeText(done)}
              <Squares res={done} />
            </span>
            <button className="primary" onClick={onShowResult}>
              See result
            </button>
            <button className="ghost" onClick={onPractice}>
              Practice run
            </button>
          </div>
        ) : resumable ? (
          <div className="desk-actions">
            <span className="status">You left today's run partway through.</span>
            <button className="primary" onClick={onStart}>
              Resume run
            </button>
          </div>
        ) : (
          <div className="desk-actions">
            <button className="primary" onClick={onStart}>
              Register for today's tournament
            </button>
            <button className="ghost" onClick={onPractice}>
              Practice first
            </button>
            <span className="status">One official run a day. Everything below is only shown here, not during the run.</span>
          </div>
        )}
      </section>

      <section>
        <h2>Your path</h2>
        <ol className="opponents">
          {bracket.map((t, i) => (
            <Opponent key={t.id} trainer={t} round={i} team={team} />
          ))}
        </ol>
      </section>

      <section>
        <h2>
          Your party <small>{done ? '' : 'Pick who opens round 1. You choose again before each round.'}</small>
        </h2>
        <ol className="party-cards">
          {team.map((mon, i) => (
            <PartyCard key={mon.name} mon={mon} isLead={i === lead} locked={!!done} onLead={() => setLead(i)} />
          ))}
        </ol>
      </section>

      <section>
        <h2>
          Practice ledger <small>today</small>
        </h2>
        <Ledger runs={store.practice} />
      </section>

      <section className="record">
        {[
          ['Played', stats.played],
          ['Win %', stats.played ? Math.round((stats.wins / stats.played) * 100) : 0],
          ['Win streak', stats.winStreak],
          ['Day streak', stats.dayStreak],
        ].map(([k, v]) => (
          <div key={k}>
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
