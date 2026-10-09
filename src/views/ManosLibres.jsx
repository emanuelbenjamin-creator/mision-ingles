import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { speakAndWait, stopAudio } from "../lib/audio.js";
import { canListen, listenOnce } from "../lib/listen.js";
import { buildPlaylist, runHandsFree } from "../lib/handsfree.js";
import { addPlayXP, bumpSkill, logSession } from "../lib/game.js";

const LABEL = { idle: "Listo para empezar", speaking: "Escucha…", listening: "Tu turno: repite la frase", done: "Sesión terminada" };
const COMMANDS = [["repeat", "repetir la frase"], ["slower", "más lento"], ["faster", "más rápido"], ["next", "pasar a la siguiente"], ["translate", "oír la traducción"], ["stop", "terminar"]];

/** Manos libres: toda la práctica por voz, sin tocar la pantalla. */
export default function ManosLibres({ s, update, today, toast }) {
  const items = useMemo(() => buildPlaylist(s, today), [today]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState("idle");
  const [i, setI] = useState(-1);
  const [scores, setScores] = useState({});
  const [summary, setSummary] = useState(null);
  const stopped = useRef(true);
  const ear = useRef(null);
  const lock = useRef(null);
  const running = state === "speaking" || state === "listening";

  const release = () => {
    try { if (lock.current) lock.current.release(); } catch { /* ya liberado */ }
    lock.current = null;
    try { if (navigator.mediaSession) { navigator.mediaSession.playbackState = "none"; ["pause", "stop", "nexttrack"].forEach(a => navigator.mediaSession.setActionHandler(a, null)); } } catch { /* sin Media Session */ }
  };
  const halt = () => {
    stopped.current = true;
    if (ear.current) ear.current.stop();
    stopAudio();
    release();
  };
  useEffect(() => () => halt(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    stopped.current = false;
    setScores({}); setSummary(null); setI(-1);
    // La pantalla no se apaga durante la sesión, y los botones de los audífonos pueden detenerla.
    try { if (navigator.wakeLock) lock.current = await navigator.wakeLock.request("screen"); } catch { /* sin Wake Lock */ }
    try {
      if (navigator.mediaSession) {
        navigator.mediaSession.metadata = new window.MediaMetadata({ title: "Manos libres", artist: "Misión Inglés" });
        navigator.mediaSession.playbackState = "playing";
        navigator.mediaSession.setActionHandler("pause", stop);
        navigator.mediaSession.setActionHandler("stop", stop);
      }
    } catch { /* sin Media Session */ }
    const r = await runHandsFree({
      items,
      speak: (text, { speed }) => speakAndWait(text, { speed }),
      listen: () => { ear.current = listenOnce(); return ear.current.done; },
      onItem: n => setI(n),
      onState: setState,
      onScore: (n, score) => setScores(prev => ({ ...prev, [n]: score })),
      isStopped: () => stopped.current,
    });
    stopped.current = true;
    release();
    setState("done");
    setSummary(r);
    if (r.done > 0) {
      const avg = Math.round(r.scores.reduce((a, b) => a + b, 0) / r.done);
      update(d => { bumpSkill(d, "comp", avg); logSession(d, "handsfree", { n: r.done, pct: avg }, today); d.speakSeconds += r.done * 6; return addPlayXP(d, r.done * 2, today, "Manos libres"); });
    }
    if (r.reason === "silence") toast("No se oyó nada tres veces seguidas: la sesión se detuvo.");
  };
  function stop() { halt(); setState("done"); }

  if (!canListen()) return <p className="hint">Manos libres necesita el micrófono con reconocimiento de voz. Usa Chrome, Edge o Safari, o activa Whisper (GROQ_API_KEY) en el servidor.</p>;
  const cur = i >= 0 ? items[i] : null;
  return (
    <div className="grid2">
      <div className={"card hf " + state} data-testid="handsfree">
        <span className="eyebrow">Manos libres · {items.length} frases</span>
        <div className="hf-orb" aria-hidden="true"><Icon name={state === "listening" ? "mic" : "headphones"} /></div>
        <b className="hf-state" aria-live="polite">{LABEL[state]}</b>
        <p className="hf-text" data-testid="hf-text">{cur ? cur.target : "El coach dice una frase y tú la repites. No hace falta mirar la pantalla."}</p>
        {running && <span className="pill neutral">{i + 1} / {items.length}</span>}
        {running ? <button type="button" className="btn rec hf-btn" onClick={stop}><Icon name="stop" /> Detener</button>
          : <button type="button" className="btn hf-btn" onClick={start}><Icon name="play" /> {state === "done" ? "Empezar otra vez" : "Empezar"}</button>}
        {summary && (
          <p className="hint" data-testid="hf-summary">
            {summary.done ? `Repetiste ${summary.done} frases, con ${Math.round(summary.scores.reduce((a, b) => a + b, 0) / summary.done)}% de precisión media.` : "No se registró ninguna frase."}
          </p>
        )}
      </div>
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Comandos de voz</h3>
          <p className="small muted">Dilos solos, en lugar de repetir la frase. También funcionan en español.</p>
          <div className="cmds">{COMMANDS.map(([c, es]) => <div key={c}><b className="mono">{c}</b><span className="small muted"> · {es}</span></div>)}</div>
        </div>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Antes de empezar</h3>
          <p className="small muted">Usa audífonos: así el micrófono no capta la voz del coach. La pantalla se mantiene encendida durante la sesión. En iPhone hay que dejar la app abierta: si pasa a segundo plano, el micrófono se corta.</p>
          <p className="small muted">Las primeras frases salen de tus tarjetas de repaso de hoy; el resto son frases de tu nivel.</p>
        </div>
        {Object.keys(scores).length > 0 && (
          <div className="card" style={{ display: "grid", gap: 6 }}>
            <h3>Esta sesión</h3>
            {Object.entries(scores).map(([n, sc]) => <div key={n} className="small"><span className={"pill " + (sc >= 85 ? "ok" : sc >= 70 ? "" : "bad")}>{sc}%</span> {items[n].target}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
