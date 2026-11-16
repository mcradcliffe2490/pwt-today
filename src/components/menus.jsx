// The menus that sit under the stadium: moves, lead pick, forfeit, the party
// dialog and the between-rounds card. Arrow keys move, Enter/Z pick, Escape backs out.
import { Fragment, useEffect, useRef, useState } from 'react';
import { SPECIAL_TYPES, effectiveness } from '../data/constants.js';
import { ROUND_NAMES } from '../lib/bracket.js';
import { HpBar, TrainerFigure } from './scene.jsx';
import { Img, MonTile, TypeChips, TypeDot, abilityText, pokemonSprite, reducedMotion } from './ui.jsx';

const CONFIRM_KEYS = ['Enter', 'z', 'Z'];
const inField = (e) => e.target instanceof HTMLElement && !!e.target.closest('input,textarea,select');

// Window keydown while `on`; the handler sees every key, with repeats of confirm keys dropped.
function useKeys(on, handler) {
  useEffect(() => {
    if (!on) return;
    const listen = (e) => {
      if (inField(e) || (e.repeat && (CONFIRM_KEYS.includes(e.key) || e.key === ' '))) return;
      handler(e);
    };
    window.addEventListener('keydown', listen);
    return () => window.removeEventListener('keydown', listen);
  });
}

// Vertical list of choices with a cursor; `pick(i)` fires once.
function Choices({ items, cursor, setCursor, onPick, render, disabled = () => false, first = 0 }) {
  return items.map((item, i) => (
    <button
      key={i}
      className={`choice${i === cursor ? ' cur' : ''}`}
      autoFocus={i === first}
      disabled={disabled(item, i)}
      onMouseEnter={() => setCursor(i)}
      onFocus={() => setCursor(i)}
      onClick={() => onPick(i)}
    >
      {render(item, i)}
    </button>
  ));
}

export function MoveMenu({ mon, foe, cursor, setCursor, onPick, onSwitch, onRun, canSwitch }) {
  const [preview, setPreview] = useState(null);
  const picked = useRef(false);
  const touch = useRef(null);
  const root = useRef(null);
  const moves = mon.moves;
  const struggle = mon.struggle ?? moves.every((m) => m.pp <= 0);
  const usable = (m) => m.pp > 0 && !m.disabled;

  useEffect(() => {
    if (preview === null) return;
    root.current?.querySelector('.aux')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'instant' : 'smooth' });
  }, [preview]);

  const pick = (i) => {
    if (picked.current || (i >= 0 && !usable(moves[i]))) return;
    picked.current = true;
    onPick(i);
  };
  useKeys(true, (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('button') && !e.target.closest('.choice')) return;
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      setCursor((c) => {
        const row = e.key === 'ArrowUp' ? 0 : e.key === 'ArrowDown' ? 1 : c >> 1;
        const col = e.key === 'ArrowLeft' ? 0 : e.key === 'ArrowRight' ? 1 : c & 1;
        return Math.min(moves.length - 1, row * 2 + col);
      });
    } else if (CONFIRM_KEYS.includes(e.key)) {
      e.preventDefault();
      pick(struggle ? -1 : cursor);
    }
  });

  const aux = (
    <div className="aux">
      <button disabled={!canSwitch} onClick={onSwitch}>
        POKéMON
      </button>
      <button onClick={onRun}>RUN</button>
    </div>
  );
  if (struggle)
    return (
      <div className="menu" ref={root}>
        <div className="panel list">
          <div className="prompt">
            <span>{mon.name.toUpperCase()} has no PP left.</span>
            <span>{mon.ability?.toUpperCase()}</span>
          </div>
          <button className="choice cur wide" autoFocus onClick={() => pick(-1)}>
            STRUGGLE
          </button>
        </div>
        <div className="panel info">
          <p className="dim">Typeless, 50 power. Hurts the user a little.</p>
          {aux}
        </div>
      </div>
    );

  const cur = moves[cursor] || moves[0];
  const category = cur.data.category || (SPECIAL_TYPES.has(cur.data.type) ? 'Special' : 'Physical');
  const eff = category === 'Status' ? null : effectiveness(cur.data.type, foe.types);
  const effText = eff === null ? 'Status' : eff > 1 ? 'Super effective' : eff === 0 ? 'No effect' : eff < 1 ? 'Not very effective' : 'Normal damage';
  const effClass = eff === null ? 'eff-none' : eff > 1 ? 'eff-se' : eff === 0 ? 'eff-no' : eff < 1 ? 'eff-nve' : 'eff-none';
  return (
    <div className="menu" ref={root}>
      <div className="panel list grid2">
        <div className="prompt">
          <span>What will {mon.name.toUpperCase()} do?</span>
          <span>{mon.ability?.toUpperCase()}</span>
        </div>
        {moves.map((m, i) => (
          <button
            key={m.name}
            className={`choice${i === cursor ? ' cur' : ''}`}
            aria-pressed={preview === i}
            disabled={!usable(m)}
            onMouseEnter={() => setCursor(i)}
            onFocus={() => setCursor(i)}
            onPointerDown={(e) => (touch.current = e.pointerType === 'mouse' ? null : i)}
            onClick={(e) => {
              // On touch the first tap previews; USE confirms.
              const t = touch.current;
              touch.current = null;
              if (e.detail && t === i) {
                setCursor(i);
                setPreview(i);
              } else pick(i);
            }}
          >
            <TypeDot type={m.data.type} />
            {m.name.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="panel info">
        <div className="row">
          <span>PP</span>
          <span>
            {cur.pp}/{cur.max}
          </span>
        </div>
        <div className="row">
          <span>TYPE/</span>
          <span>{cur.data.type.toUpperCase()}</span>
        </div>
        <div className="row dim">
          <span>{eff === null ? '' : `${category} ${cur.data.pow}`}</span>
          <span>{cur.data.acc ? `Accuracy ${cur.data.acc}` : 'Never misses'}</span>
        </div>
        <em className={`eff ${effClass}`}>{effText}</em>
        {preview === null ? (
          aux
        ) : (
          <div className="aux">
            <button aria-label={`Use ${moves[preview].name.toUpperCase()}`} onClick={() => pick(preview)}>
              USE
            </button>
            <button
              onClick={() => {
                setPreview(null);
                root.current?.querySelectorAll('.choice')[preview]?.focus();
              }}
            >
              CANCEL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Between rounds: who opens the next battle. Everyone is at full HP.
export function LeadMenu({ state, onPick }) {
  const [cursor, setCursor] = useState(0);
  const picked = useRef(false);
  const n = state.p.length;
  const pick = (i) => {
    if (picked.current) return;
    picked.current = true;
    onPick(i);
  };
  useKeys(true, (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('button') && !e.target.closest('.choice')) return;
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      setCursor((c) => (c + (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? n - 1 : 1)) % n);
    } else if (CONFIRM_KEYS.includes(e.key)) {
      e.preventDefault();
      pick(cursor);
    }
  });
  const foe = state.r[0];
  return (
    <div className="menu">
      <div className="panel list grid2">
        <div className="prompt">
          <span>
            {ROUND_NAMES[state.round - 1]}: {state.trainer.name.toUpperCase()}. Who goes first?
          </span>
        </div>
        <Choices
          items={state.p}
          cursor={cursor}
          setCursor={setCursor}
          onPick={pick}
          render={(mon) => (
            <>
              <MonTile mon={mon} size={28} />
              {mon.name.toUpperCase()}
            </>
          )}
        />
      </div>
      <div className="panel info">
        <div className="row">
          <span>{state.trainer.name.toUpperCase()} leads with</span>
        </div>
        <div className="row lead">
          <MonTile mon={foe} size={40} />
          <span>
            <b>{foe.name}</b>
            <br />
            <TypeChips types={foe.types} />
          </span>
        </div>
        <p className="dim">Your team is fully healed.</p>
      </div>
    </div>
  );
}

export function ConfirmMenu({ daily, onYes, onNo }) {
  const [cursor, setCursor] = useState(1);
  useKeys(true, (e) => {
    if (e.key === 'Escape') onNo();
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setCursor(e.key === 'ArrowLeft' ? 0 : 1);
    else if (CONFIRM_KEYS.includes(e.key)) (cursor === 0 ? onYes : onNo)();
    else return;
    e.preventDefault();
  });
  return (
    <div className="menu">
      <div className="panel list grid2">
        <div className="prompt">
          <span>{daily ? "Give up today's run?" : 'End this practice run?'}</span>
        </div>
        <Choices items={['YES', 'NO']} cursor={cursor} setCursor={setCursor} onPick={(i) => (i === 0 ? onYes() : onNo())} render={(s) => s} first={1} />
      </div>
      <div className="panel info">
        <p>{daily ? 'It counts as a loss.' : 'Nothing is recorded.'}</p>
      </div>
    </div>
  );
}

// POKéMON dialog. `forced` after a faint: a replacement is required and there is no cancel.
export function PartyMenu({ state, forced, onPick, onClose }) {
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(false);
  const root = useRef(null);
  const canShift = selected !== null && selected !== state.pa && state.p[selected].hp > 0 && (state.switches?.includes(selected) ?? true) && (forced || state.canSwitch !== false);
  const back = () => {
    if (selected === null) {
      if (!forced) onClose();
      return;
    }
    const i = selected;
    setSelected(null);
    setSummary(false);
    root.current?.querySelectorAll('.slot')[i]?.focus();
  };
  useEffect(() => {
    if (selected !== null) root.current?.querySelector('.party-foot button')?.focus();
  }, [selected]);
  // Focus stays inside the dialog: arrows and Tab cycle, Enter/Space activate, Escape backs out.
  useEffect(() => {
    const listen = (e) => {
      const el = root.current;
      if (!el) return;
      const buttons = Array.from(el.querySelectorAll('button'));
      const nav = selected === null ? Array.from(el.querySelectorAll('.slot,.party-foot button')) : buttons.filter((b) => b.closest('.party-foot'));
      if (e.key === 'Escape') {
        if (!e.repeat) back();
      } else if (e.key.startsWith('Arrow') || e.key === 'Tab') {
        const list = e.key === 'Tab' ? buttons : nav;
        const at = list.indexOf(document.activeElement);
        const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1;
        list[at < 0 ? (dir > 0 ? 0 : list.length - 1) : (at + dir + list.length) % list.length]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (!e.repeat) (buttons.includes(document.activeElement) ? document.activeElement : nav[0])?.click();
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', listen, true);
    return () => window.removeEventListener('keydown', listen, true);
  });
  return (
    <div className="overlay" onClick={back}>
      <div className="party" ref={root} role="dialog" aria-modal="true" aria-label="POKéMON" onClick={(e) => e.stopPropagation()}>
        <div className="slots">
          {state.p.map((mon, i) => {
            const fainted = mon.hp <= 0;
            const active = i === state.pa;
            return (
              <Fragment key={mon.name}>
                <button
                  className={`slot${fainted ? ' out' : ''}${active ? ' cur' : ''}`}
                  aria-pressed={selected === i}
                  onClick={() => {
                    setSelected(i);
                    setSummary(false);
                  }}
                >
                  <MonTile mon={mon} size={52} />
                  <span className="slot-name">
                    {mon.name}
                    <small>Lv100{fainted ? ', fainted' : active ? ', in battle' : ''}</small>
                  </span>
                  <span className="slot-hp">
                    <HpBar hp={mon.hp} max={mon.max} />
                    <small>
                      {mon.hp}/ {mon.max}
                    </small>
                  </span>
                </button>
                {selected === i && summary && (
                  <div className="panel summary" id="party-summary" role="region" aria-label={`${mon.name} SUMMARY`}>
                    {mon.moves.map((m) => (
                      <div key={m.name} className="row">
                        <span>
                          <TypeDot type={m.data.type} /> {m.name.toUpperCase()}
                        </span>
                        <span>
                          PP {m.pp}/{m.max}
                        </span>
                      </div>
                    ))}
                    <div className="row">
                      <span>ITEM</span>
                      <span>{mon.item || (mon.startItem ? `NONE (was ${mon.startItem})` : 'NONE')}</span>
                    </div>
                    <div className="row">
                      <span>ABILITY</span>
                      <span>{mon.ability}</span>
                    </div>
                    {abilityText(mon.ability) && <p className="dim">{abilityText(mon.ability)}</p>}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
        <div className="party-foot">
          {selected === null ? (
            <>
              <span>{forced ? 'Choose a POKéMON.' : 'Switch? It uses your turn.'}</span>
              {!forced && <button onClick={onClose}>CANCEL</button>}
            </>
          ) : (
            <>
              {canShift && <button onClick={() => onPick(selected)}>SHIFT</button>}
              <button aria-expanded={summary} aria-controls={summary ? 'party-summary' : undefined} onClick={() => setSummary((s) => !s)}>
                SUMMARY
              </button>
              <button onClick={back}>CANCEL</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Between rounds: the next trainer and the Pokémon they lead with.
export function NextUp({ round, trainer, lead }) {
  return (
    <div className="nextup" role="status">
      <div className="nextup-head">{round}</div>
      <div className="nextup-body">
        <TrainerFigure trainer={trainer} className="nextup-figure" />
        <div className="nextup-info">
          <small>Next opponent</small>
          <b>{trainer.name}</b>
          <span>
            {trainer.title} · {trainer.region}
          </span>
          {trainer.quotes?.announce && <em>{trainer.quotes.announce}</em>}
        </div>
        <div className="nextup-ace">
          <Img src={pokemonSprite(lead.dexno)} fallback={<span />} />
          <small>{trainer.ace ? 'Ace' : 'Leads with'}</small>
          <b>{lead.name}</b>
          <TypeChips types={lead.types} />
        </div>
      </div>
    </div>
  );
}
