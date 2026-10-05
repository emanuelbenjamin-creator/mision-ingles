import { useState } from "react";
import SpeakButton from "../components/SpeakButton.jsx";
import { GRAMMAR } from "../content/grammar.js";
import { todaysGrammar } from "../lib/missions.js";
import { api } from "../lib/api.js";
import { addMistake, addXP, bumpSkill, completeMission, logSession } from "../lib/game.js";

export default function Gramatica({ s, update, today, ai, toast, topic, setTopic }) {
  const g = GRAMMAR.find(x => x.id === topic) || todaysGrammar(s, today);
  const [answers, setAnswers] = useState({});
  const [expl, setExpl] = useState({});
  const [q, setQ] = useState("");
  const [askOut, setAskOut] = useState("");
  const [asking, setAsking] = useState(false);
  const ans = answers[g.id] || {};
  const right = Object.values(ans).filter(v => v.ok).length;
  const mastered = GRAMMAR.filter(x => s.grammar[x.id] >= 75).length;

  const answer = (i, j) => {
    if (ans[i]) return;
    const qq = g.qs[i];
    const next = { ...ans, [i]: { pick: j, ok: j === qq.a } };
    setAnswers({ ...answers, [g.id]: next });
    const done = Object.keys(next).length === g.qs.length;
    const pct = Math.round(Object.values(next).filter(v => v.ok).length / g.qs.length * 100);
    update(d => {
      if (j !== qq.a) addMistake(d, { wrong: qq.s.replace("___", qq.o[j]), right: qq.s.replace("___", qq.o[qq.a]), why: qq.why, rule: g.name, src: "gramática" }, today);
      if (!done) return [];
      d.grammar[g.id] = Math.max(d.grammar[g.id] || 0, pct);
      bumpSkill(d, "gram", pct);
      logSession(d, "grammar", { topic: g.id, pct }, today);
      return pct >= 75 ? completeMission(d, "grammar", g.name, today) : [`${pct}%: repite para llegar a 75% y completar la misión.`];
    });
  };

  const explain = async i => {
    const qq = g.qs[i], a = ans[i], key = g.id + i;
    setExpl(e => ({ ...e, [key]: "…" }));
    try {
      const r = await api("grammar-explain", { stem: qq.s, options: qq.o, correct: qq.o[qq.a], picked: qq.o[a.pick], level: s.profile.level });
      setExpl(e => ({ ...e, [key]: r.text }));
    } catch (e) { setExpl(x => ({ ...x, [key]: "" })); toast(e.message); }
  };

  const ask = async () => {
    if (!q.trim() || !ai) return;
    setAsking(true); setAskOut("");
    try {
      const r = await api("grammar-ask", { question: q, level: s.profile.level });
      setAskOut(r.text);
      update(d => addXP(d, 3, today, "Pregunta de gramática"));
    } catch (e) { toast(e.message); }
    setAsking(false);
  };

  return (
    <div className="grid2">
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div className="card-head" style={{ margin: 0 }}>
            <div><span className="eyebrow">Nivel {g.lv}{g.id === todaysGrammar(s, today).id ? " · misión de hoy" : ""}</span><h2>{g.name}</h2></div>
            {s.grammar[g.id] != null && <span className={"pill " + (s.grammar[g.id] >= 75 ? "ok" : "")}>Mejor: {s.grammar[g.id]}%</span>}
          </div>
          <p>{g.exp}</p>
          <div className="formula">{g.formula}</div>
          <ul className="examples">
            {g.ex.map(x => <li key={x}><SpeakButton text={x} iconOnly /><span>{x}</span></li>)}
          </ul>
        </div>
        <div className="card">
          <div className="card-head"><h2>Practica</h2><span className="pill neutral">{right} / {g.qs.length} correctas</span></div>
          <div className="qs">
            {g.qs.map((qq, i) => {
              const a = ans[i], key = g.id + i;
              return (
                <div className="q" key={key}>
                  <div className="stem">{i + 1}. {qq.s}</div>
                  <div className="opts">
                    {qq.o.map((o, j) => (
                      <button key={o} type="button" disabled={!!a} onClick={() => answer(i, j)}
                        className={"opt" + (a ? (j === qq.a ? " right" : j === a.pick ? " wrong" : "") : "")}>{o}</button>
                    ))}
                  </div>
                  {a && (
                    <div className="expl">
                      <b>{a.ok ? "¡Correcto! " : "No exactamente. "}</b>{qq.why}
                      {expl[key] ? <p className="ai-out" style={{ marginTop: 8 }}>{expl[key] === "…" ? "Pensando…" : expl[key]}</p>
                        : ai && <div style={{ marginTop: 8 }}><button className="btn ghost sm" type="button" onClick={() => explain(i)}>Explica mi respuesta</button></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {Object.keys(ans).length === g.qs.length && <div className="row" style={{ marginTop: 14 }}><button className="btn ghost" type="button" onClick={() => setAnswers({ ...answers, [g.id]: {} })}>Repetir ejercicios</button></div>}
        </div>
      </div>
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <h2>Pregúntale al profe</h2>
          <p className="small muted">Cualquier duda de gramática, en español. Ej.: «¿Cuándo uso <i>make</i> y cuándo <i>do</i>?»</p>
          <textarea id="askIn" style={{ minHeight: 80 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Escribe tu pregunta…" disabled={!ai} />
          <div className="row"><button className="btn" type="button" onClick={ask} disabled={!ai || asking}>{asking ? "Pensando…" : "Preguntar"}</button></div>
          {!ai && <p className="hint">Disponible con el coach IA activo.</p>}
          {askOut && <div className="ai-out">{askOut}</div>}
        </div>
        <div className="card">
          <div className="card-head"><h2>Temas</h2><span className="small muted">{mastered} / {GRAMMAR.length} dominados</span></div>
          <div className="topics">
            {GRAMMAR.map(x => (
              <button className="topic" type="button" key={x.id} aria-current={x.id === g.id} onClick={() => { setTopic(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <span className="lv">{x.lv}</span><span>{x.name}</span>
                {s.grammar[x.id] != null ? <span className={"pill " + (s.grammar[x.id] >= 75 ? "ok" : "")}>{s.grammar[x.id]}%</span> : <span />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
