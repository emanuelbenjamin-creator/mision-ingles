import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import LiveVisualizer from "../components/LiveVisualizer.jsx";
import { api } from "../lib/api.js";
import { liveSupported, startLive } from "../lib/live.js";
import { economySupported, startEconomy } from "../lib/economy.js";
import { stopAudio } from "../lib/audio.js";
import { addMistake, addXP, bumpSkill, completeMission, logSession } from "../lib/game.js";

const STATE_LABEL = { idle: "Listo para llamar", connecting: "Conectando…", listening: "Te escucha · habla cuando quieras", thinking: "Pensando…", speaking: "Hablando…", ended: "Llamada terminada" };
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Conversación por voz en tiempo real (Gemini Live) + revisión al final.
 * opts: { scenario, topic?, correction?, pace?, voice? }  ·  title: nombre que se muestra.
 */
export default function LiveVoice({ s, update, today, ai, toast, opts, title, onLiveChange, server = {}, engine = "live", onEngineChange }) {
  const [status, setStatus] = useState("idle");
  const [turns, setTurns] = useState([]);
  const [secs, setSecs] = useState(0);
  const [limit, setLimit] = useState(10);
  const [muted, setMuted] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [err, setErr] = useState("");
  const sess = useRef(null);
  const started = useRef(0);
  const box = useRef(null);
  const live = status === "connecting" || status === "listening" || status === "speaking" || status === "thinking";
  const [suggestEco, setSuggestEco] = useState(false);
  const liveOK = ai && server.gemini !== false && liveSupported();
  const ecoOK = ai && economySupported();
  const useEco = engine === "economy" || (!liveOK && ecoOK);

  useEffect(() => { if (onLiveChange) onLiveChange(live); }, [live, onLiveChange]);
  useEffect(() => () => sess.current && sess.current.stop(), []);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [turns]);
  useEffect(() => {
    if (!live || status === "connecting") return undefined;
    const id = setInterval(() => {
      const t = (Date.now() - started.current) / 1000;
      setSecs(t);
      if (t >= limit * 60) hangUp();
    }, 500);
    return () => clearInterval(id);
  }, [live, status, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const getLevels = useCallback(() => (sess.current && sess.current.levels ? sess.current.levels() : { user: 0, model: 0 }), []);

  const onTranscript = (role, text) => setTurns(prev => {
    const last = prev[prev.length - 1];
    if (last && last.role === role) return [...prev.slice(0, -1), { role, text: (last.text + " " + text).replace(/\s+/g, " ").trim() }];
    return [...prev, { role, text: text.trim() }];
  });

  const callEconomy = async () => {
    setErr(""); setReview(null); setTurns([]); setSecs(0); setMuted(false); setSuggestEco(false);
    stopAudio();
    setStatus("connecting");
    try {
      setLimit(15);
      started.current = Date.now();
      sess.current = await startEconomy({
        opts, level: s.profile.level, profession: s.profile.profession,
        onTranscript, onState: setStatus,
        onError: m => setErr(m),
        onClose: () => { sess.current = null; setStatus("ended"); },
      });
    } catch (e) {
      sess.current = null;
      setStatus("idle");
      setErr(e.message || "No se pudo iniciar la llamada.");
    }
  };

  const call = async () => {
    if (useEco) return callEconomy();
    setErr(""); setReview(null); setTurns([]); setSecs(0); setMuted(false); setSuggestEco(false);
    stopAudio();
    setStatus("connecting");
    try {
      const t = await api("live-token", { level: s.profile.level, profession: s.profile.profession, voice: s.profile.liveVoice || s.profile.voice, ...opts });
      setLimit(t.minutes);
      started.current = Date.now();
      sess.current = await startLive({
        token: t.token, model: t.model, config: t.config,
        onTranscript, onState: setStatus,
        onError: m => setErr(m),
        onClose: () => { sess.current = null; setStatus("ended"); },
      });
    } catch (e) {
      sess.current = null;
      setStatus("idle");
      setErr(e.message || "No se pudo iniciar la llamada.");
      if (ecoOK) setSuggestEco(true);
    }
  };

  function hangUp() {
    if (sess.current) sess.current.stop();
    sess.current = null;
    setStatus("ended");
  }

  const doReview = async () => {
    setReviewing(true);
    try {
      const r = await api("chat-review", { scenario: opts.scenario, level: s.profile.level, turns });
      setReview(r);
      const minutes = Math.max(1, Math.round(secs / 60));
      update(d => {
        r.corrections.forEach(x => addMistake(d, { wrong: x.original, right: x.corrected, why: x.explanation_es, rule: x.rule, src: "voz en vivo" }, today));
        if (r.fluency != null) bumpSkill(d, "flu", r.fluency);
        if (r.grammar != null) bumpSkill(d, "gram", r.grammar);
        if (r.vocabulary != null) bumpSkill(d, "vocab", r.vocabulary);
        d.speakSeconds += Math.round(secs);
        logSession(d, "live", { scen: opts.scenario, secs: Math.round(secs) }, today);
        d.liveSessions = [...(d.liveSessions || []), { d: today, title, secs: Math.round(secs), fluency: r.fluency, grammar: r.grammar, errors: r.corrections.length }].slice(-20);
        const msgs = addXP(d, Math.min(20, minutes * 2), today, `${minutes} min de voz en vivo`);
        return secs >= 60 ? msgs.concat(completeMission(d, "chat", "Conversación", today)) : msgs;
      });
    } catch (e) { toast(e.message); }
    setReviewing(false);
  };

  if (!ai) return <p className="hint">La voz en vivo necesita el coach IA. Revisa las claves en el servidor o tu código de acceso en Ajustes.</p>;
  if (!liveOK && !ecoOK) return <p className="hint">Tu navegador no permite audio en vivo. Usa Chrome, Edge o Safari actualizados.</p>;

  return (
    <div style={{ display: "grid", gap: 14 }} data-testid="live">
      <div className={"live-stage " + status}>
        <div className="live-orb" aria-hidden="true"><Icon name={status === "speaking" ? "headphones" : "mic"} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{title}</div>
          <b>{STATE_LABEL[status]}</b>
          {live && status !== "connecting" && <div className="small muted mono">{mmss(secs)} / {limit}:00</div>}
        </div>
        <div className="row" style={{ marginLeft: "auto" }}>
          {live && <button type="button" className="btn ghost sm" onClick={() => { const m = !muted; setMuted(m); if (sess.current) sess.current.setMuted(m); }}>{muted ? "Activar micrófono" : "Silenciar"}</button>}
          {live ? <button type="button" className="btn rec" onClick={hangUp}><Icon name="phone" /> Colgar</button>
            : <button type="button" className="btn" onClick={call}><Icon name="phone" /> {status === "ended" ? "Llamar otra vez" : "Iniciar llamada"}</button>}
        </div>
        <LiveVisualizer getLevels={getLevels} status={status} />
      </div>
      {useEco && <p className="small muted" data-testid="eco-note">Modo económico: hablan por turnos (el coach no se puede interrumpir). Usa Whisper/reconocimiento del navegador, modelos gratuitos y tu voz elegida.</p>}
      {err && <p className="err">{err}</p>}
      {suggestEco && !live && (
        <div className="hint row" style={{ justifyContent: "space-between" }} data-testid="eco-suggest">
          <span>Gemini Live no está disponible ahora. Puedes seguir practicando en <b>modo económico</b>.</span>
          <button type="button" className="btn sm" onClick={() => { if (onEngineChange) onEngineChange("economy"); callEconomy(); }}>Usar modo económico</button>
        </div>
      )}
      <p className="hint small" data-testid="spanish-bridge">¿No sabes cómo decir algo? <b>Dilo en español</b>: el coach te dice cómo se dice en inglés, te pide repetirlo y siguen en inglés.</p>
      <div className="chat" ref={box} aria-live="polite">
        {turns.length === 0 && <p className="empty">{status === "idle" ? "Al llamar, el coach te saluda primero. Usa audífonos para evitar eco y habla con naturalidad: puedes interrumpirlo como en una llamada real." : "El coach está empezando la llamada… La transcripción aparece aquí."}</p>}
        {turns.map((t, i) => (
          <div key={i} className={"msg " + (t.role === "user" ? "me" : "ai")}>
            <span className="who">{t.role === "user" ? "Tú" : title}</span>
            <div className="bub">{t.text}</div>
          </div>
        ))}
      </div>
      {status === "ended" && turns.some(t => t.role === "user") && !review && (
        <button type="button" className="btn" onClick={doReview} disabled={reviewing}>{reviewing ? "Revisando…" : "Revisar mi conversación"}</button>
      )}
      {review && (
        <div className="card" style={{ display: "grid", gap: 12 }} data-testid="live-review">
          <h3>Tu revisión</h3>
          {review.summary_es && <p>{review.summary_es}</p>}
          <div className="scores" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
            {[["fluency", "Fluidez"], ["grammar", "Gramática"], ["vocabulary", "Vocabulario"]].map(([k, n]) => <div className="score" key={k}><b>{review[k] ?? "—"}</b><span>{n}</span></div>)}
          </div>
          {review.strengths_es.length > 0 && <p className="small"><b>Bien:</b> {review.strengths_es.join(" · ")}</p>}
          {review.corrections.length > 0 ? (
            <div className="fixes">{review.corrections.map((x, i) => (
              <div className="fix" key={i}><span className="was">{x.original}</span> → <span className="now">{x.corrected}</span><div className="why">{x.explanation_es}</div></div>
            ))}</div>
          ) : <p className="empty">Sin errores importantes. ¡Muy bien!</p>}
          {review.next_step_es && <p className="hint"><b>Siguiente paso:</b> {review.next_step_es}</p>}
        </div>
      )}
    </div>
  );
}
