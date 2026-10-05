import { useState } from "react";
import { api } from "../lib/api.js";
import { weekStart } from "../lib/report.js";
import { addXP, bumpSkill } from "../lib/game.js";

const MIN = 5;

/** Lección semanal generada con los errores del cuaderno. */
export default function MistakesLesson({ s, update, today, ai, toast }) {
  const ws = weekStart(today);
  const saved = s.lessons[ws];
  const [busy, setBusy] = useState(false);

  if (s.mistakes.length < MIN) {
    return <p className="empty">Cuando tengas {MIN} errores guardados (tienes {s.mistakes.length}), el coach creará una lección solo con lo que más te cuesta.</p>;
  }
  const create = async () => {
    setBusy(true);
    try {
      const lesson = await api("mistakes-lesson", { level: s.profile.level, mistakes: s.mistakes.slice(0, 15) });
      update(d => { d.lessons[ws] = { lesson, answers: {} }; const keys = Object.keys(d.lessons).sort(); while (keys.length > 8) delete d.lessons[keys.shift()]; });
    } catch (e) { toast(e.message); }
    setBusy(false);
  };
  if (!saved) {
    return ai ? <button type="button" className="btn" onClick={create} disabled={busy}>{busy ? "Creando tu lección…" : "Crear mi lección de la semana"}</button>
      : <p className="hint">Disponible con el coach IA activo.</p>;
  }
  const { lesson, answers } = saved;
  const answer = (i, j) => update(d => {
    const l = d.lessons[ws];
    if (l.answers[i] != null) return [];
    l.answers[i] = j;
    if (Object.keys(l.answers).length !== l.lesson.exercises.length) return [];
    const pct = Math.round(l.lesson.exercises.filter((x, k) => l.answers[k] === x.a).length / l.lesson.exercises.length * 100);
    bumpSkill(d, "gram", pct);
    return addXP(d, 15, today, `Lección de tus errores (${pct}%)`);
  });

  return (
    <div style={{ display: "grid", gap: 12 }} data-testid="lesson">
      {lesson.summary_es && <p>{lesson.summary_es}</p>}
      {lesson.patterns.map((p, i) => (
        <div key={i} className="expl">
          <b>{p.rule}</b>
          <div>{p.explanation_es}</div>
          {p.examples.map(e => <div key={e} className="small"><i>{e}</i></div>)}
        </div>
      ))}
      <div className="qs">
        {lesson.exercises.map((x, i) => {
          const a = answers[i];
          return (
            <div className="q" key={i}>
              <div className="stem">{i + 1}. {x.s}</div>
              <div className="opts">{x.o.map((o, j) => (
                <button key={o} type="button" disabled={a != null} onClick={() => answer(i, j)} className={"opt" + (a != null ? (j === x.a ? " right" : j === a ? " wrong" : "") : "")}>{o}</button>
              ))}</div>
              {a != null && x.why && <div className="expl">{x.why}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
