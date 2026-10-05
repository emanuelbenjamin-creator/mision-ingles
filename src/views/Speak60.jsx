import { useEffect, useRef, useState } from "react";
import MicButton from "../components/MicButton.jsx";
import { GOALS } from "../content/meta.js";
import { todaysTopic } from "../lib/missions.js";
import { localAnalyze } from "../lib/analyze.js";
import { words } from "../lib/align.js";
import SpeakButton from "../components/SpeakButton.jsx";
import { api } from "../lib/api.js";
import { addMistake, bumpSkill, completeMission, logSession } from "../lib/game.js";

const DRAFT = "mi-speak-draft";
const readDraft = () => { try { return sessionStorage.getItem(DRAFT) || ""; } catch { return ""; } };

export default function Speak60({ s, update, today, ai, toast }) {
  const [offset, setOffset] = useState(0);
  const [text, setText] = useState(readDraft);
  const [start, setStart] = useState(null);
  const [left, setLeft] = useState(60);
  const [secs, setSecs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState(null);
  const ctl = useRef(null);
  const base = useRef("");
  const tp = todaysTopic(s, today, offset);

  useEffect(() => { try { sessionStorage.setItem(DRAFT, text); } catch { /* sin almacenamiento */ } }, [text]);
  useEffect(() => {
    if (!start) return undefined;
    const id = setInterval(() => {
      const l = Math.max(0, 60 - (Date.now() - start) / 1000);
      setLeft(l);
      if (l <= 0) { setSecs(60); setStart(null); }
    }, 250);
    return () => clearInterval(id);
  }, [start]);
  useEffect(() => () => ctl.current && ctl.current.abort(), []);

  const toggleTimer = () => {
    if (start) { setSecs(Math.min(60, (Date.now() - start) / 1000)); setStart(null); }
    else { setStart(Date.now()); setLeft(60); setSecs(null); document.getElementById("spText")?.focus(); }
  };

  const evaluate = async () => {
    if (words(text).length < 15) { toast("Di al menos 15 palabras para poder evaluarte."); return; }
    if (start) toggleTimer();
    const local = localAnalyze(text, secs);
    let aiRes = null, err = "";
    if (ai) {
      setBusy(true);
      ctl.current = new AbortController();
      try {
        aiRes = await api("speak-evaluate", { text, topic: tp.t, level: s.profile.level, goal: s.profile.goal, seconds: secs ? Math.round(secs) : null }, { signal: ctl.current.signal });
      } catch (e) {
        if (e.code === "cancelled") { setBusy(false); return; }
        err = e.message + " Te muestro la evaluación básica.";
      }
      setBusy(false);
    }
    const f = { local, ai: aiRes, err };
    setFb(f);
    update(d => {
      const sc = aiRes ? aiRes.scores : local.scores;
      const flu = local.wpm != null && aiRes ? Math.round(sc.fluency * 0.6 + local.scores.fluency * 0.4) : sc.fluency;
      bumpSkill(d, "flu", flu); bumpSkill(d, "gram", sc.grammar); bumpSkill(d, "vocab", sc.vocabulary);
      const fixes = aiRes ? aiRes.corrections : local.fixes;
      fixes.forEach(x => addMistake(d, { wrong: x.original, right: x.corrected, why: x.explanation_es, rule: x.rule, src: "habla" }, today));
      d.speakSeconds += Math.round(secs || 60);
      logSession(d, "speak", { flu, gram: sc.grammar, vocab: sc.vocabulary }, today);
      return completeMission(d, "speak", "Habla 60 s", today);
    });
  };

  const timeLabel = start ? `0:${String(Math.ceil(left)).padStart(2, "0")}`.replace("0:60", "1:00") : "1:00";

  return (
    <div className="grid2">
      <div className="stack">
        <div className="prompt-card">
          <span className="eyebrow">Tema · nivel {s.profile.level} · {GOALS[s.profile.goal]}</span>
          <h2>{tp.t}</h2>
          <p className="hints">Frases útiles: {tp.h}</p>
          <div className="row">
            <SpeakButton text={tp.t} label="Escuchar tema" />
            <button className="btn ghost sm" type="button" onClick={() => { setOffset(o => o + 1); setFb(null); }}>Cambiar tema</button>
          </div>
        </div>
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <button className={"btn" + (start ? " rec" : "")} type="button" onClick={toggleTimer}>{start ? "Parar reloj" : "Empezar 60 s"}</button>
              <span className="timer" aria-live="off">{timeLabel}</span>
              <MicButton label="Hablar" maxMs={65000} onStart={() => { base.current = text ? text.trim() + " " : ""; if (!start) toggleTimer(); }} onText={t => setText(base.current + t)} />
            </div>
            <span className="small muted">{words(text).length} palabras</span>
          </div>
          <label htmlFor="spText" className="small muted">Tu respuesta en inglés. Habla sin parar: el objetivo es fluidez, no perfección.</label>
          <textarea id="spText" value={text} onChange={e => setText(e.target.value)} placeholder="Pulsa «Hablar» o usa el micrófono de tu teclado… (también puedes escribir)" />
          <div className="row">
            <button className="btn" type="button" onClick={evaluate} disabled={busy}>{busy ? "Evaluando…" : "Evaluar mi respuesta"}</button>
            {busy && <button className="btn ghost" type="button" onClick={() => ctl.current && ctl.current.abort()}>Cancelar</button>}
            <button className="btn ghost" type="button" onClick={() => { setText(""); setFb(null); setSecs(null); }}>Borrar</button>
          </div>
          {!ai && <p className="hint">Modo básico: se evalúan fluidez, vocabulario y errores típicos sin IA. Con el coach IA activo recibes correcciones completas y una versión mejorada.</p>}
        </div>
      </div>
      <div className="stack"><Feedback busy={busy} fb={fb} /></div>
    </div>
  );
}

function Feedback({ busy, fb }) {
  if (busy) return <div className="card"><p className="thinking">El coach está analizando tu respuesta… (unos segundos)</p></div>;
  if (!fb) {
    return (
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h3>Cómo funciona</h3>
        <p className="muted">1. Lee el tema y pulsa <b>Hablar</b> (o <b>Empezar 60 s</b> y dicta con el teclado).<br />2. Habla sin parar durante un minuto.<br />3. Pulsa <b>Evaluar</b>: recibes puntajes de fluidez, gramática, vocabulario y coherencia, tus errores corregidos con la regla explicada y una versión mejorada que puedes escuchar.</p>
        <p className="small muted">Cada error corregido se guarda en tu cuaderno y vuelve como tarjeta de repaso.</p>
      </div>
    );
  }
  const a = fb.ai, l = fb.local, sc = a ? a.scores : l.scores;
  const fixes = a ? a.corrections : l.fixes;
  return (
    <div className="card" style={{ display: "grid", gap: 14 }} data-testid="speak-feedback">
      <div className="card-head" style={{ margin: 0 }}>
        <h2>Tu evaluación</h2>
        {a ? <span className="pill ok">Nivel estimado {a.cefr_estimate || "—"}</span> : <span className="pill neutral">Evaluación básica sin IA</span>}
      </div>
      {fb.err && <p className="hint">{fb.err}</p>}
      <div className="scores">
        {[["fluency", "Fluidez"], ["grammar", "Gramática"], ["vocabulary", "Vocabulario"], ["coherence", "Coherencia"]].map(([k, n]) => (
          <div className="score" key={k}><b>{Math.round(sc[k] ?? 0)}</b><span>{n}</span></div>
        ))}
      </div>
      <p className="small muted">{l.n} palabras{l.wpm ? ` · ${l.wpm} palabras por minuto (ideal 110–150)` : ""} · {l.fillers} muletillas</p>
      <div>
        <h3 style={{ marginBottom: 8 }}>Correcciones</h3>
        {fixes.length ? (
          <div className="fixes">
            {fixes.map((x, i) => (
              <div className="fix" key={i}>
                <span className="was">{x.original}</span> → <span className="now">{x.corrected}</span>
                <div className="why">{x.explanation_es} {x.rule && <span className="pill neutral">{x.rule}</span>}</div>
              </div>
            ))}
          </div>
        ) : <p className="empty">{a ? "Sin errores importantes. ¡Bien hecho!" : "No se detectaron errores típicos. El coach IA encuentra errores más finos."}</p>}
      </div>
      {a && a.better_version && (
        <div className="better">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <h3>Versión mejorada</h3>
            <div className="row">
              <SpeakButton text={a.better_version} />
              <SpeakButton text={a.better_version} slow label="Lento" />
            </div>
          </div>
          <p className="ai-out">{a.better_version}</p>
        </div>
      )}
      {a && a.vocabulary_upgrades.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Sube tu vocabulario</h3>
          <div className="mistakes">{a.vocabulary_upgrades.map((v, i) => (
            <div className="mk" key={i}><span><span className="muted">{v.basic}</span> → <b>{v.advanced}</b></span><span className="small muted">{v.example}</span></div>
          ))}</div>
        </div>
      )}
      {a && a.tip_es && <p className="hint"><b>Consejo:</b> {a.tip_es}</p>}
    </div>
  );
}
