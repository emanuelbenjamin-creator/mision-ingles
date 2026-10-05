import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import MicButton from "../components/MicButton.jsx";
import { IELTS_SETS } from "../content/ielts.js";
import { hash } from "../lib/dates.js";
import { words } from "../lib/align.js";
import { api } from "../lib/api.js";
import { canRecord, startRecording } from "../lib/recorder.js";
import { stopAudio } from "../lib/audio.js";
import { addMistake, completeMission, logSession } from "../lib/game.js";

const CRITERIA = [["fc", "Fluency & Coherence"], ["lr", "Lexical Resource"], ["gra", "Grammatical Range & Accuracy"], ["p", "Pronunciation"]];
const mmss = s => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

function useCountdown(seconds, running, onEnd) {
  const [left, setLeft] = useState(seconds);
  const start = useRef(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!running) { setLeft(seconds); return undefined; }
    start.current = Date.now();
    const id = setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - start.current) / 1000);
      setLeft(l);
      if (l <= 0) { clearInterval(id); endRef.current(); }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, running]);
  return left;
}

/** Respuesta hablada: la pregunta (con la voz del examinador), dictado y texto editable. */
function Answer({ question, value, onChange }) {
  const base = useRef("");
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <SpeakButton text={question} iconOnly />
        <h2 style={{ flex: 1, minWidth: 0 }}>{question}</h2>
      </div>
      <div className="composer" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
        <textarea id="ieltsAns" value={value} onChange={e => onChange(e.target.value)} placeholder="Responde hablando (micrófono) o dicta con el teclado. Unas 2–4 frases." aria-label="Tu respuesta" />
        <MicButton label="" maxMs={90000} onStart={() => { base.current = value ? value.trim() + " " : ""; }} onText={t => onChange(base.current + t)} />
      </div>
    </div>
  );
}

export default function IeltsMock({ s, update, today, ai, toast }) {
  const [setIdx, setSetIdx] = useState(() => (hash(today + "ielts") + s.ielts.length) % IELTS_SETS.length);
  const set = IELTS_SETS[setIdx];
  const [phase, setPhase] = useState("intro");
  const [qi, setQi] = useState(0);
  const [p1, setP1] = useState(["", "", "", ""]);
  const [p3, setP3] = useState(["", "", ""]);
  const [notes, setNotes] = useState("");
  const [p2, setP2] = useState("");
  const [clip, setClip] = useState(null);
  const [rec, setRec] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const base2 = useRef("");

  const prepLeft = useCountdown(60, phase === "p2prep", () => setPhase("p2talk"));
  const talkLeft = useCountdown(120, phase === "p2talk", () => finishTalk());

  useEffect(() => {
    if (phase !== "p2talk" || !canRecord()) return undefined;
    let r = null, cancelled = false;
    stopAudio();
    startRecording({ maxMs: 125000, rate: 8000 }).then(x => {
      if (cancelled) { x.stop(); return; }
      r = x;
      setRec(x);
      x.done.then(c => setClip(c)).catch(() => toast("No se pudo guardar el audio de la Part 2; se evaluará con el texto."));
    }).catch(() => toast("Sin micrófono: la Part 2 se evaluará con el texto que dictes o escribas."));
    return () => { cancelled = true; if (r) r.stop(); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function finishTalk() { if (rec) rec.stop(); setRec(null); setPhase("p3"); setQi(0); }

  const reset = next => {
    setPhase("intro"); setQi(0); setP1(["", "", "", ""]); setP3(["", "", ""]); setNotes(""); setP2(""); setClip(null); setResult(null);
    if (next) setSetIdx(i => (i + 1) % IELTS_SETS.length);
  };

  const evaluate = async () => {
    setBusy(true);
    try {
      const r = await api("ielts-evaluate", {
        part1: set.part1.map((q, i) => ({ q, a: p1[i] })),
        part2: { topic: set.part2.topic, a: p2 },
        part3: set.part3.map((q, i) => ({ q, a: p3[i] })),
        audio: clip ? clip.wavBase64 : undefined,
      });
      setResult(r);
      update(d => {
        d.ielts.push({ d: today, set: set.id, overall: r.overall, bands: r.bands });
        if (d.ielts.length > 30) d.ielts = d.ielts.slice(-30);
        r.corrections.forEach(x => addMistake(d, { wrong: x.original, right: x.corrected, why: x.explanation_es, rule: x.rule, src: "IELTS" }, today));
        logSession(d, "ielts", { overall: r.overall }, today);
        return completeMission(d, "ielts", `Simulacro IELTS (banda ${r.overall})`, today);
      });
    } catch (e) { toast(e.message); }
    setBusy(false);
  };

  const step = { intro: 0, p1: 1, p2prep: 2, p2talk: 2, p3: 3, done: 4 }[phase];
  const totalWords = words([...p1, ...p3, p2].join(" ")).length;

  return (
    <div className="grid2">
      <div className="card" style={{ display: "grid", gap: 16 }} data-testid="ielts">
        <div className="progress-dots" aria-hidden="true">{[1, 2, 3, 4].map(i => <i key={i} className={i <= step ? "on" : ""} />)}</div>

        {phase === "intro" && <>
          <span className="eyebrow">IELTS Speaking · simulacro completo · 11–14 min</span>
          <h1>Simulacro IELTS</h1>
          <p className="muted">Mismo formato del examen real. <b>Part 1:</b> 4 preguntas sobre ti. <b>Part 2:</b> una tarjeta con 1 minuto para preparar y hasta 2 minutos hablando (se graba tu voz para evaluar la pronunciación). <b>Part 3:</b> 3 preguntas de discusión.</p>
          <p className="muted small">Al final recibes tu banda en los 4 criterios oficiales y la banda global, con explicación en español.</p>
          <div className="row">
            <button type="button" className="btn" onClick={() => setPhase("p1")}>Empezar Part 1</button>
            <button type="button" className="btn ghost" onClick={() => setSetIdx(i => (i + 1) % IELTS_SETS.length)}>Otro tema</button>
          </div>
          <p className="small muted">Tema de la tarjeta: <i>{set.part2.topic}</i></p>
        </>}

        {phase === "p1" && <>
          <span className="eyebrow">Part 1 · pregunta {qi + 1} de {set.part1.length} · unos 30 s</span>
          <Answer key={"p1" + qi} question={set.part1[qi]} value={p1[qi]} onChange={v => setP1(a => a.map((x, i) => (i === qi ? v : x)))} />
          <div className="row">
            {qi > 0 && <button type="button" className="btn ghost" onClick={() => setQi(qi - 1)}>Anterior</button>}
            {qi < set.part1.length - 1 ? <button type="button" className="btn" onClick={() => setQi(qi + 1)}>Siguiente</button>
              : <button type="button" className="btn" onClick={() => setPhase("p2prep")}>Ir a la Part 2</button>}
          </div>
        </>}

        {(phase === "p2prep" || phase === "p2talk") && <>
          <span className="eyebrow">Part 2 · {phase === "p2prep" ? "preparación" : "habla hasta 2 minutos"}</span>
          <div className="cue">
            <div className="row" style={{ alignItems: "flex-start" }}><SpeakButton text={set.part2.topic} iconOnly /><h2 style={{ flex: 1 }}>{set.part2.topic}</h2></div>
            <p className="small">You should say:</p>
            <ul>{set.part2.bullets.map(b => <li key={b}>{b}</li>)}</ul>
          </div>
          {phase === "p2prep" ? <>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="timer">{mmss(prepLeft)}</span><button type="button" className="btn" onClick={() => setPhase("p2talk")}>Estoy listo</button></div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas rápidas (palabras clave)" aria-label="Notas" style={{ minHeight: 90 }} />
          </> : <>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="row"><span className="timer">{mmss(talkLeft)}</span>{rec && <span className="pill bad"><Icon name="rec" /> Grabando</span>}</span>
              <button type="button" className="btn" onClick={finishTalk}>Terminar Part 2</button>
            </div>
            {notes && <p className="small muted">Tus notas: {notes}</p>}
            <div className="composer" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <textarea id="ieltsP2" value={p2} onChange={e => setP2(e.target.value)} placeholder="Habla sin parar. Si tu navegador lo permite, pulsa el micrófono para ver el texto; si no, se evalúa con el audio grabado." aria-label="Tu respuesta de la Part 2" />
              <MicButton label="" maxMs={125000} onStart={() => { base2.current = p2 ? p2.trim() + " " : ""; }} onText={t => setP2(base2.current + t)} />
            </div>
          </>}
        </>}

        {phase === "p3" && <>
          <span className="eyebrow">Part 3 · pregunta {qi + 1} de {set.part3.length} · desarrolla tus ideas</span>
          <Answer key={"p3" + qi} question={set.part3[qi]} value={p3[qi]} onChange={v => setP3(a => a.map((x, i) => (i === qi ? v : x)))} />
          <div className="row">
            {qi > 0 && <button type="button" className="btn ghost" onClick={() => setQi(qi - 1)}>Anterior</button>}
            {qi < set.part3.length - 1 ? <button type="button" className="btn" onClick={() => setQi(qi + 1)}>Siguiente</button>
              : <button type="button" className="btn" onClick={() => setPhase("done")}>Terminar examen</button>}
          </div>
        </>}

        {phase === "done" && !result && <>
          <h2>¡Terminaste!</h2>
          <p className="muted">{totalWords} palabras en total{clip ? ` · ${Math.round(clip.seconds)} s de audio en la Part 2` : ""}.</p>
          {ai ? <button type="button" className="btn" onClick={evaluate} disabled={busy}>{busy ? "El examinador está evaluando… (hasta 1 min)" : "Ver mi banda IELTS"}</button>
            : <p className="hint">La evaluación de bandas necesita el coach IA. Revisa la clave de Gemini en el servidor o tu código de acceso.</p>}
          <button type="button" className="btn ghost" onClick={() => reset(false)}>Empezar de nuevo</button>
        </>}

        {result && (
          <div style={{ display: "grid", gap: 14 }} data-testid="ielts-result">
            <div className="band-hero"><span className="eyebrow">Banda global estimada</span><b>{result.overall?.toFixed(1)}</b></div>
            <div className="bands">
              {CRITERIA.map(([k, n]) => (
                <div key={k} className="band-row">
                  <div className="row" style={{ justifyContent: "space-between" }}><b>{n}</b><span className="pill ok mono">{result.bands[k].toFixed(1)}</span></div>
                  <p className="small muted">{result.criteria_es[k]}</p>
                </div>
              ))}
            </div>
            {!result.pronunciationFromAudio && <p className="hint">La pronunciación se estimó con el texto porque no hubo audio de la Part 2.</p>}
            {result.corrections.length > 0 && <div><h3 style={{ marginBottom: 8 }}>Correcciones</h3><div className="fixes">{result.corrections.map((x, i) => (
              <div className="fix" key={i}><span className="was">{x.original}</span> → <span className="now">{x.corrected}</span><div className="why">{x.explanation_es}</div></div>
            ))}</div></div>}
            {result.better_phrases.length > 0 && <div><h3 style={{ marginBottom: 8 }}>Frases de banda más alta</h3><div className="mistakes">{result.better_phrases.map((x, i) => (
              <div className="mk" key={i}><span><span className="muted">{x.instead}</span> → <b>{x.try}</b></span></div>
            ))}</div></div>}
            {result.next_steps_es.length > 0 && <div className="hint"><b>Para subir de banda:</b><ul>{result.next_steps_es.map(x => <li key={x}>{x}</li>)}</ul></div>}
            <button type="button" className="btn" onClick={() => reset(true)}>Hacer otro simulacro</button>
          </div>
        )}
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head"><h2>Tus simulacros</h2><span className="small muted">banda global</span></div>
          {s.ielts.length ? (
            <div className="mistakes">{s.ielts.slice(-6).reverse().map((x, i) => (
              <div className="mk row" key={i} style={{ justifyContent: "space-between" }}><span className="small muted">{x.d}</span><b className="mono">{Number(x.overall).toFixed(1)}</b></div>
            ))}</div>
          ) : <p className="empty">Aquí verás tu banda en cada simulacro.</p>}
        </div>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Consejos del examen</h3>
          <p className="muted small">Responde con 2–4 frases en la Part 1, usa conectores (however, on the other hand) y da ejemplos personales. En la Part 2 sigue los puntos de la tarjeta en orden y no pares de hablar. En la Part 3 justifica tus opiniones y compara situaciones.</p>
        </div>
      </div>
    </div>
  );
}
