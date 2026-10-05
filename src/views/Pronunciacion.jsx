import { useRef, useState } from "react";
import SpeakButton from "../components/SpeakButton.jsx";
import RecordRow from "../components/RecordRow.jsx";
import MicButton from "../components/MicButton.jsx";
import { SOUNDS } from "../content/sounds.js";
import { todaysSound } from "../lib/missions.js";
import { alignWords } from "../lib/align.js";
import { bumpSkill, completeMission, logSession } from "../lib/game.js";

export default function Pronunciacion({ s, ai, update, today, toast, soundId, setSoundId }) {
  const snd = SOUNDS.find(x => x.id === soundId) || todaysSound(today);
  const [inputs, setInputs] = useState({});
  const [attempts, setAttempts] = useState({});
  const attemptsRef = useRef({});

  const pick = id => { setSoundId(id); setInputs({}); setAttempts({}); attemptsRef.current = {}; };
  const check = (i, said) => {
    const value = said ?? inputs[i] ?? "";
    if (!value.trim()) { toast("Primero di la frase (dicta en el campo)."); return; }
    record(i, alignWords(snd.sents[i], value));
  };
  const fromAI = (i, r) => record(i, { score: r.score, tokens: r.words.map(w => ({ text: w.word, status: w.ok ? "ok" : "miss", issue: w.issue_es })), ai: r });
  const record = (i, attempt) => {
    const prev = attemptsRef.current;
    const next = { ...prev, [i]: attempt };
    attemptsRef.current = next;
    setAttempts(next);
    if (Object.keys(next).length === snd.sents.length && Object.keys(prev).length < snd.sents.length) {
      const avg = Math.round(Object.values(next).reduce((a, b) => a + b.score, 0) / snd.sents.length);
      update(d => {
        bumpSkill(d, "pron", avg);
        logSession(d, "pron", { pron: avg, sound: snd.id }, today);
        return completeMission(d, "pron", "Pronunciación " + snd.name, today);
      });
    }
  };

  return (
    <div className="grid2">
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div className="sound-head">
            <span className="ipa">{snd.ipa}</span>
            <div><span className="eyebrow">{snd.id === todaysSound(today).id ? "Sonido del día" : "Sonido"}</span><h2>{snd.name}</h2></div>
          </div>
          <p>{snd.tip}</p>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Pares mínimos · escucha la diferencia</div>
            <div className="pairs">
              {snd.pairs.map(p => (
                <span className="pair" key={p}>{p}
                  <SpeakButton text={p.replace(/\/.*?\//g, "").replace("·", ", ")} iconOnly className="pairbtn" />
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Imita las frases</h2><span className="small muted">Escucha → repite → comprueba</span></div>
          <div className="sentences">
            {snd.sents.map((sent, i) => {
              const at = attempts[i];
              return (
                <div className="sent" key={snd.id + i}>
                  <div className="en">
                    {at ? <div className="words">{at.tokens.map((t, k) => <span key={k} title={t.issue || undefined} className={t.status === "ok" ? "w-ok" : t.status === "miss" ? "w-miss" : ""}>{t.text}</span>)}</div> : sent}
                  </div>
                  {at && at.ai && (
                    <div className="expl" data-testid={"pron-ai-" + i}>
                      {at.tokens.filter(t => t.issue).map((t, k) => <div key={k}><b>{t.text}</b>: {t.issue}</div>)}
                      {at.ai.sounds_to_practice.length > 0 && <div style={{ marginTop: 4 }}>Practica: <span className="mono">{at.ai.sounds_to_practice.join(" ")}</span></div>}
                      {at.ai.tip_es && <div style={{ marginTop: 4 }}>{at.ai.tip_es}</div>}
                      {at.ai.scores && <div className="small" style={{ marginTop: 4 }}>Precisión {at.ai.scores.accuracy} · Fluidez {at.ai.scores.fluency} · Completitud {at.ai.scores.completeness}</div>}
                      {at.ai.transcript && <div className="small muted" style={{ marginTop: 4 }}>Se escuchó: «{at.ai.transcript}»</div>}
                      {at.ai.method && <div className="small muted">Evaluado con {{ azure: "Azure (fonemas)", gemini: "Gemini (escucha el audio)", whisper: "Whisper (transcripción)" }[at.ai.method] || at.ai.method}</div>}
                    </div>
                  )}
                  <div className="row">
                    <SpeakButton text={sent} label="Normal" />
                    <SpeakButton text={sent} slow label="Lento" />
                    {at && <span className={"pill " + (at.score >= 85 ? "ok" : at.score >= 60 ? "" : "bad")}>{at.score}%</span>}
                  </div>
                  <RecordRow target={sent} id={snd.id + i} ai={ai} level={s.profile.level} toast={toast} onResult={r => fromAI(i, r)} />
                  <div className="composer" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
                    <input type="text" id={"pr" + i} value={inputs[i] || ""} onChange={e => setInputs({ ...inputs, [i]: e.target.value })} placeholder="Dicta la frase aquí" aria-label={`Lo que dijiste en la frase ${i + 1}`} />
                    <MicButton label="" maxMs={7000} onText={t => setInputs(prev => ({ ...prev, [i]: t }))} onStop={() => { const el = document.getElementById("pr" + i); if (el && el.value) check(i, el.value); }} />
                    <button className="btn" type="button" onClick={() => check(i)}>Comprobar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <h3>Cómo se calcula</h3>
          <p className="muted small"><b>Grábate</b> y compara tu voz con la nativa. {ai ? "Con «Evaluar con IA», Gemini escucha tu audio y te dice qué sonido fallaste en cada palabra. " : ""}También puedes dictar la frase: el reconocimiento de voz convierte lo que dices en texto. Si una palabra no se reconoce como la original, se marca en rojo: casi siempre es el sonido que hay que trabajar. Repite hasta llegar a 85% o más.</p>
          <p className="hint">Si dictas con el teclado, cámbialo a inglés (English). Si dictas en español, reconocerá palabras en español.</p>
        </div>
        <div className="card">
          <div className="card-head"><h2>Sonidos difíciles</h2><span className="small muted">para hispanohablantes</span></div>
          <div className="topics">
            {SOUNDS.map(x => (
              <button className="topic" type="button" key={x.id} aria-current={x.id === snd.id} onClick={() => pick(x.id)}>
                <span className="lv">{x.ipa.split(" ")[0]}</span><span>{x.name}</span><span className="small muted">{x.id === todaysSound(today).id ? "hoy" : ""}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
