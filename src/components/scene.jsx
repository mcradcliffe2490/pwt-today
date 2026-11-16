// The stadium: both Pokémon with their HUDs, the trainer walking on and off,
// the Poké Ball throw, and the text box underneath.
import { useEffect, useRef, useState } from 'react';
import { Img, initials, pokemonSprite, reducedMotion, trainerSprite } from './ui.jsx';

export function HpBar({ hp, max }) {
  const frac = Math.max(0, hp / max);
  const tone = frac > 0.5 ? 'ok' : frac > 0.2 ? 'low' : 'crit';
  return (
    <div className={`hpbar ${tone}`}>
      <span>HP</span>
      <div>
        <div style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}

// HP readout that counts down over 650 ms.
function HpNumber({ hp, max }) {
  const el = useRef(null);
  const shown = useRef(hp);
  useEffect(() => {
    const node = el.current;
    const from = shown.current;
    if (!node || from === hp || reducedMotion()) {
      shown.current = hp;
      if (node) node.textContent = `${hp}/ ${max}`;
      return;
    }
    const start = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / 650);
      shown.current = Math.round(from + (hp - from) * t);
      node.textContent = `${shown.current}/ ${max}`;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hp, max]);
  return (
    <span ref={el}>
      {hp}/ {max}
    </span>
  );
}

function Hud({ side, mon, hp, party, active, owner }) {
  return (
    <div className={`hud hud-${side}`}>
      <div className="hud-name">
        <span>
          {owner && <b>{owner}'s </b>}
          {mon.name}
        </span>
        <small>Lv100{hp.status ? ` ${hp.status.toUpperCase()}` : ''}</small>
      </div>
      <HpBar hp={hp.hp} max={hp.max} />
      <div className="hud-foot">
        <span className="pips">
          {party.map((m, i) => (
            <i key={i} className={m.hp <= 0 ? 'out' : i === active ? 'on' : ''} />
          ))}
        </span>
        {side === 'me' && <HpNumber key={mon.name} hp={hp.hp} max={hp.max} />}
      </div>
    </div>
  );
}

// Replays 'hit' each time HP drops, 'down' at 0, 'ball' when sent out of a Poké Ball.
function BattleSprite({ mon, side, hp, fromBall }) {
  const last = useRef(hp);
  const [hits, setHits] = useState(0);
  useEffect(() => {
    setHits(0);
    last.current = hp;
  }, [mon.name]);
  useEffect(() => {
    if (hp < last.current) setHits((n) => n + 1);
    last.current = hp;
  }, [hp]);
  const anim = hp <= 0 ? 'down' : hits ? 'hit' : fromBall ? 'ball' : 'enter';
  const key = `${mon.name}-${hits}-${hp <= 0}`;
  return (
    <Img
      key={key}
      className={`mon mon-${side} ${anim}`}
      src={pokemonSprite(mon.dexno, side === 'me')}
      alt={mon.name}
      fallback={
        <div key={key} className={`mon mon-${side} badge ${anim}`} aria-label={mon.name}>
          {initials(mon.name)}
        </div>
      }
    />
  );
}

// `pose`: in (walks on), out (walks off after the throw), back (returns at the end).
export function TrainerFigure({ trainer, pose = '', className = 'trainer' }) {
  const cls = `${className} ${pose}`;
  return <Img className={cls} src={trainerSprite(trainer.sprite)} alt={trainer.name} fallback={<div className={`${cls} badge`}>{initials(trainer.name)}</div>} />;
}

// stage: { who, pose, foeHidden, ball } from the narration's fx cues.
export function Scene({ foe, foeHp, me, meHp, foeParty, myParty, foeActive, myActive, owner, stage, overlay, children }) {
  const hidden = !!stage?.foeHidden;
  return (
    <div className="screen">
      <div className="scene">
        <div className="stands" />
        <div className="floor" />
        <div className="plat plat-foe" />
        <div className="plat plat-me" />
        {stage?.who && stage.pose && <TrainerFigure key={`${stage.who.id}-${stage.pose}`} trainer={stage.who} pose={stage.pose} />}
        {!hidden && stage?.ball > 0 && <span key={stage.ball} className="pokeball" aria-hidden="true" />}
        {!hidden && <BattleSprite mon={foe} side="foe" hp={foeHp.hp} fromBall={stage?.ball > 0} />}
        <BattleSprite mon={me} side="me" hp={meHp.hp} />
        {!hidden && <Hud side="foe" mon={foe} hp={foeHp} party={foeParty} active={foeActive} owner={owner} />}
        <Hud side="me" mon={me} hp={meHp} party={myParty} active={myActive} />
        {overlay}
      </div>
      <div className="controls">{children}</div>
    </div>
  );
}

// The message box; with a speaker it becomes a name-tagged dialogue box.
export function TextBox({ text, speaker, caret, onAdvance }) {
  return (
    <div className={`textbox${speaker ? ' speech' : ''}`} onClick={onAdvance}>
      {speaker && <span className="speaker">{speaker}</span>}
      <p>{text}</p>
      {caret && <span className="caret">▼</span>}
    </div>
  );
}
