import { useState } from "react";
import SpeakButton from "../components/SpeakButton.jsx";
import MistakesLesson from "../components/MistakesLesson.jsx";
import { dueCards, ivlLabel, learnedCount, NEW_PER_DAY, schedule } from "../lib/srs.js";
import { playAudio } from "../lib/audio.js";
import { completeMission } from "../lib/game.js";

const GRADES = ["Otra vez", "Difícil", "Bien", "Fácil"];

export default function Repaso({ s, update, today, ai, toast }) {
  const [queue, setQueue] = useState(() => dueCards(s, today).map(c => c.id));
  const [show, setShow] = useState(false);
  const card = s.cards.find(c => c.id === queue[0]);
  const reviewed = s.reviewsByDay[today] || 0;
  const isFix = card && card.tag === "mi error";
  const stats = { due: s.cards.filter(c => c.reps > 0 && c.due && c.due <= today).length, fresh: s.cards.filter(c => c.reps === 0).length, learned: learnedCount(s) };

  const flip = () => { setShow(true); if (!isFix) playAudio(card.ex || card.front, { id: "norm:" + (card.ex || card.front) }); };
  const grade = g => {
    const rest = queue.slice(1);
    const nextQueue = g === 0 ? [...rest, card.id] : rest;
    setQueue(nextQueue); setShow(false);
    update(d => {
      const c = d.cards.find(x => x.id === card.id);
      if (c.reps === 0) d.newByDay[today] = (d.newByDay[today] || 0) + 1;
      Object.assign(c, schedule(c, g, today));
      d.reviewsByDay[today] = (d.reviewsByDay[today] || 0) + 1;
      const n = d.reviewsByDay[today];
      if (!(d.missions[today] || []).includes("review") && (n >= 10 || nextQueue.length === 0)) return completeMission(d, "review", "Repaso", today);
      return [];
    });
  };

  return (
    <div className="grid2">
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div className="card-head" style={{ margin: 0 }}><h2>Repaso espaciado</h2><span className="pill neutral">{queue.length} en cola · {reviewed} hoy</span></div>
          {card ? (
            <>
              <div className="flash" data-testid="flashcard">
                <span className="tag">{card.tag}</span>
                <div className="front">{card.front}</div>
                {show ? <><div className="back"><b>{card.back}</b></div>{card.ex && <div className="ex">{card.ex}</div>}</>
                  : <div className="ex">{isFix ? "¿Cómo se dice correctamente? Dilo en voz alta antes de voltear." : "¿Qué significa? Respóndelo en voz alta antes de voltear."}</div>}
              </div>
              <div className="row" style={{ justifyContent: "center" }}>
                {(!isFix || show) && <SpeakButton text={isFix ? card.back : card.front} />}
              </div>
              {show
                ? <div className="grades">{GRADES.map((n, g) => <button type="button" key={n} onClick={() => grade(g)}>{n}<span>{ivlLabel(card, g, today)}</span></button>)}</div>
                : <button className="btn" type="button" onClick={flip}>Mostrar respuesta</button>}
            </>
          ) : (
            <div className="flash"><div className="front">¡Al día!</div><div className="ex">No hay más tarjetas para hoy. Vuelve mañana: el repaso espaciado funciona mejor en dosis cortas y diarias.</div></div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>Tu mazo</h2></div>
          <div className="tiles" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
            <div className="tile"><b>{stats.due}</b><span>para repasar</span></div>
            <div className="tile"><b>{stats.fresh}</b><span>nuevas</span></div>
            <div className="tile"><b>{stats.learned}</b><span>aprendidas</span></div>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>Máximo {NEW_PER_DAY} tarjetas nuevas por día. Cada respuesta ajusta cuándo vuelve la tarjeta: justo antes de que la olvides.</p>
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <div className="card-head"><h2>Tu lección de la semana</h2><span className="small muted">con tus errores</span></div>
          <MistakesLesson s={s} update={update} today={today} ai={ai} toast={toast} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Cuaderno de errores</h2><span className="small muted">{s.mistakes.length} guardados</span></div>
          {s.mistakes.length ? (
            <div className="mistakes">
              {s.mistakes.slice(0, 30).map((m, i) => (
                <div className="mk" key={i}>
                  <span><span style={{ textDecoration: "line-through", color: "var(--bad)" }}>{m.wrong}</span> → <b style={{ color: "var(--good)" }}>{m.right}</b></span>
                  <span className="small muted">{m.why}</span>
                  <span><span className="pill neutral">{m.rule}</span> <span className="small muted">{m.src} · {m.d}</span></span>
                </div>
              ))}
            </div>
          ) : <p className="empty">Aún no hay errores guardados. Cuando el coach te corrija al hablar, conversar o en gramática, cada error aparecerá aquí y se convertirá en una tarjeta.</p>}
        </div>
      </div>
    </div>
  );
}
