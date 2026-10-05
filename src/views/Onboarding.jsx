import { useState } from "react";
import { GOALS, LEVELS } from "../content/meta.js";
import { PLACEMENT, levelFromScore } from "../lib/placement.js";
import { PROFESSIONS } from "../content/professions.js";

const DAILY = [[30, "Relajado", "30 XP · unos 10 min al día"], [50, "Regular", "50 XP · unos 15 min al día"], [80, "Serio", "80 XP · unos 25 min al día"], [120, "Intenso", "120 XP · unos 40 min al día"]];

export default function Onboarding({ s, onDone }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState({ ...s.profile });
  const [testI, setTestI] = useState(null);
  const [correct, setCorrect] = useState(0);
  const set = patch => setP(x => ({ ...x, ...patch }));

  const answerTest = j => {
    const ok = j === PLACEMENT[testI].a;
    const c = correct + (ok ? 1 : 0);
    setCorrect(c);
    if (testI + 1 < PLACEMENT.length) setTestI(testI + 1);
    else { set({ level: levelFromScore(c) }); setTestI(null); setStep(3); }
  };

  return (
    <div className="onb card" data-testid="onboarding">
      <div className="progress-dots" aria-hidden="true">{[0, 0.5, 1, 2, 3].map(v => <i key={v} className={v <= step ? "on" : ""} />)}</div>
      {step === 0 && (
        <>
          <span className="eyebrow">Paso 1 de 5</span>
          <h1>¿Para qué quieres el inglés?</h1>
          <div className="choice">
            {Object.entries(GOALS).map(([k, v]) => <button type="button" key={k} aria-pressed={p.goal === k} onClick={() => set({ goal: k })}>{v}</button>)}
          </div>
          <div className="row"><button className="btn" type="button" onClick={() => setStep(0.5)}>Continuar</button></div>
        </>
      )}
      {step === 0.5 && (
        <>
          <span className="eyebrow">Paso 2 de 5</span>
          <h1>¿En qué trabajas o estudias?</h1>
          <p className="muted">Agregamos vocabulario, temas y conversaciones de tu profesión.</p>
          <div className="choice">
            {Object.entries(PROFESSIONS).map(([k, v]) => <button type="button" key={k} aria-pressed={(p.profession || "general") === k} onClick={() => set({ profession: k })}>{v.name}</button>)}
          </div>
          <div className="row"><button className="btn ghost" type="button" onClick={() => setStep(0)}>Atrás</button><button className="btn" type="button" onClick={() => setStep(1)}>Continuar</button></div>
        </>
      )}
      {step === 1 && (
        <>
          <span className="eyebrow">Paso 3 de 5</span>
          <h1>Elige tu meta diaria</h1>
          <div className="choice">
            {DAILY.map(([v, n, d]) => <button type="button" key={v} aria-pressed={p.dailyGoal === v} onClick={() => set({ dailyGoal: v })}>{n}<span>{d}</span></button>)}
          </div>
          <div className="row"><button className="btn ghost" type="button" onClick={() => setStep(0.5)}>Atrás</button><button className="btn" type="button" onClick={() => setStep(2)}>Continuar</button></div>
        </>
      )}
      {step === 2 && testI === null && (
        <>
          <span className="eyebrow">Paso 4 de 5</span>
          <h1>¿Cuál es tu nivel?</h1>
          <p className="muted">Si no lo sabes, haz la prueba rápida: 8 preguntas, unos 2 minutos.</p>
          <button className="btn" type="button" onClick={() => { setCorrect(0); setTestI(0); }}>Hacer la prueba de nivel</button>
          <div className="choice">
            {LEVELS.slice(0, 5).map(l => <button type="button" key={l} aria-pressed={p.level === l} onClick={() => set({ level: l })}>{l}<span>{{ A1: "Principiante", A2: "Básico", B1: "Intermedio", B2: "Intermedio alto", C1: "Avanzado" }[l]}</span></button>)}
          </div>
          <div className="row"><button className="btn ghost" type="button" onClick={() => setStep(1)}>Atrás</button><button className="btn" type="button" onClick={() => setStep(3)}>Continuar con {p.level}</button></div>
        </>
      )}
      {step === 2 && testI !== null && (
        <>
          <span className="eyebrow">Prueba de nivel · pregunta {testI + 1} de {PLACEMENT.length}</span>
          <h2>{PLACEMENT[testI].s}</h2>
          <div className="opts">{PLACEMENT[testI].o.map((o, j) => <button className="opt" type="button" key={o} onClick={() => answerTest(j)}>{o}</button>)}</div>
          <button className="btn ghost sm" type="button" onClick={() => setTestI(null)}>Salir de la prueba</button>
        </>
      )}
      {step === 3 && (
        <>
          <span className="eyebrow">Paso 5 de 5</span>
          <h1>Empiezas en {p.level}</h1>
          {correct > 0 && <p className="muted">Acertaste {correct} de {PLACEMENT.length} en la prueba. Puedes cambiar el nivel cuando quieras en Ajustes.</p>}
          <div className="field"><label htmlFor="obName">¿Cómo te llamas? (opcional)</label><input type="text" id="obName" value={p.name} onChange={e => set({ name: e.target.value.slice(0, 40) })} /></div>
          <div className="row"><button className="btn ghost" type="button" onClick={() => setStep(2)}>Atrás</button><button className="btn" type="button" onClick={() => onDone({ ...p, name: p.name.trim(), onboarded: true })}>Empezar mis misiones</button></div>
        </>
      )}
    </div>
  );
}
