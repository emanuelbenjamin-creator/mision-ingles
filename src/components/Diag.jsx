import { useEffect, useState, useSyncExternalStore } from "react";
import { clearLog, detail, getDiag, getLog, label, setDiag, subscribeTrace, summarize, toCSV } from "../lib/trace.js";
import { Sheet } from "./Modals.jsx";

/* Modo diagnóstico: etiquetas con el modelo que respondió, barra de últimos eventos y panel «Modelos». */

export const useDiag = () => useSyncExternalStore(subscribeTrace, getDiag);
const useLog = () => useSyncExternalStore(subscribeTrace, getLog);

const KIND = { text: "texto", "audio-eval": "escucha audio", tts: "voz", live: "en vivo", stt: "transcripción", pron: "pronunciación" };
const ROUTE = {
  "chat-turn": "Chat", "chat-suggest": "Sugerencias", "chat-review": "Revisión de llamada", "voice-turn": "Voz económica",
  "speak-evaluate": "Habla 60 s", "pron-assess": "Pronunciación", "ielts-evaluate": "IELTS", "grammar-explain": "Gramática",
  "grammar-ask": "Pregúntale al profe", reading: "Lectura", word: "Palabra", dictation: "Dictado", "mistakes-lesson": "Lección de errores",
  tts: "Audio", "live-token": "Gemini Live", transcribe: "Whisper", "web-speech": "Reconocimiento",
};
export const routeName = r => ROUTE[r] || r;

/** Etiqueta con el modelo (solo en modo diagnóstico). ev: evento del registro; o text para un texto fijo. */
export function ModelTag({ ev, text, style }) {
  const on = useDiag();
  if (!on || (!ev && !text)) return null;
  const failed = ev && ev.calls.some(c => !c.model);
  return <span className={"model-tag" + (failed ? " bad" : "")} title={ev ? detail(ev) : text} data-testid="model-tag" style={style}>{ev ? label(ev) : text}</span>;
}

/** Barra flotante con los últimos eventos (texto y audio) mientras el modo diagnóstico está activo. */
export function DiagBar({ onOpen }) {
  const on = useDiag();
  const log = useLog();
  const [min, setMin] = useState(() => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
  // Deja espacio al final de la página para que la barra no tape botones.
  useEffect(() => {
    const b = document.body.classList;
    b.toggle("diag-on", on); b.toggle("diag-min", on && min);
    return () => { b.remove("diag-on"); b.remove("diag-min"); };
  }, [on, min]);
  if (!on) return null;
  const last = log.slice(-4).reverse();
  return (
    <div className={"diag-bar" + (min ? " min" : "")} data-testid="diag-bar" aria-live="polite">
      <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
        <b className="small">Diagnóstico</b>
        <span className="row" style={{ gap: 4 }}>
          <button type="button" className="btn ghost xs" onClick={onOpen}>Ver todo</button>
          <button type="button" className="btn ghost xs" onClick={() => setMin(m => !m)} aria-label={min ? "Mostrar" : "Minimizar"}>{min ? "▴" : "▾"}</button>
        </span>
      </div>
      {min ? (last[0] ? <div className="diag-ev" title={detail(last[0])}><span className="muted">{routeName(last[0].route)}</span><span className="mono">{label(last[0])}</span></div> : null) : (last.length ? last.map((ev, i) => (
        <div key={ev.at + "-" + i} className="diag-ev" title={detail(ev)}>
          <span className="muted">{routeName(ev.route)}</span>
          <span className={"mono" + (ev.calls.some(c => !c.model) ? " err-txt" : "")}>{label(ev)}</span>
        </div>
      )) : <div className="small muted">Aún no hay respuestas. Usa la app y aquí verás qué modelo respondió.</div>)}
    </div>
  );
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const FAIL = { 429: "sin cuota", 404: "no existe", timeout: "tiempo agotado", invalid: "respuesta inválida", error: "error" };
const fmtMs = ms => (ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : ms + " ms");

/** Panel «Modelos»: activar el modo, resumen por modelo, últimos eventos y exportar. */
export function ModelsModal({ server = {}, onClose, onToggle }) {
  const on = useDiag();
  const log = useLog();
  const rows = summarize(log);
  const m = server.models || {};
  const day = new Date().toISOString().slice(0, 10);
  return (
    <Sheet title="Modelos (diagnóstico)" onClose={onClose} testid="models">
      <label className="diag-check">
        <input type="checkbox" checked={on} onChange={e => { setDiag(e.target.checked); if (onToggle) onToggle(e.target.checked); }} data-testid="diag-toggle" />
        <span>Mostrar qué modelo respondió en cada respuesta y audio</span>
      </label>
      <p className="small muted">Cada vez que el coach responde, los modelos gratuitos compiten: gana el primero con una respuesta válida. Aquí ves quién ganó, quién llegó tarde (<b>Lento</b>: otro ya había ganado) y quién falló y por qué. Se guarda solo en este dispositivo (últimos 500 eventos).</p>

      <h3>Resumen por modelo</h3>
      {rows.length ? (
        <div className="table-wrap">
          <table className="diag-table" data-testid="models-summary">
            <thead><tr><th>Modelo</th><th>Uso</th><th>Ganó</th><th>Lento</th><th>Falló</th><th>Tiempo medio</th><th>Dónde ganó</th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.kind + r.model}>
                <td className="mono">{r.model}</td>
                <td>{KIND[r.kind] || r.kind}</td>
                <td><b>{r.wins}</b>/{r.tries} <span className="muted">({r.winRate}%)</span></td>
                <td>{r.lost || ""}</td>
                <td>{r.failed ? Object.entries(r.fails).map(([k, n]) => `${n} ${FAIL[k] || k}`).join(", ") : ""}</td>
                <td>{r.avgMs ? fmtMs(r.avgMs) : "—"}</td>
                <td className="small">{Object.entries(r.routes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${routeName(k)} ${n}`).join(" · ")}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="empty">Todavía no hay datos. Activa el modo diagnóstico y usa la app.</p>}

      <h3>Últimos eventos</h3>
      <div className="diag-list" data-testid="models-events">
        {log.slice(-40).reverse().map((ev, i) => (
          <details key={ev.at + "-" + i}>
            <summary><span className="muted mono small">{new Date(ev.at).toLocaleTimeString()}</span> <b>{routeName(ev.route)}</b> → <span className="mono">{label(ev)}</span></summary>
            <pre className="small mono">{detail(ev)}</pre>
          </details>
        ))}
      </div>

      {(m.text || m.tts || m.live) && (
        <>
          <h3>Configurados en el servidor</h3>
          <p className="small mono" style={{ wordBreak: "break-word" }}>
            texto: {(m.text || []).join(", ") || "—"}<br />respaldo: {(m.fallback || []).join(", ") || "—"}<br />
            voz: {(m.tts || []).join(", ") || "—"}<br />en vivo: {(m.live || []).join(", ") || "—"}
            {server.providers && server.providers.length ? <><br />proveedores: {server.providers.join(", ")}</> : null}
          </p>
        </>
      )}

      <div className="row">
        <button type="button" className="btn sm" onClick={() => download(`modelos-${day}.csv`, toCSV(log), "text/csv")} disabled={!log.length}>Descargar CSV</button>
        <button type="button" className="btn ghost sm" onClick={() => download(`modelos-${day}.json`, JSON.stringify({ summary: rows, events: log }, null, 2), "application/json")} disabled={!log.length}>Descargar JSON</button>
        <button type="button" className="btn ghost sm" onClick={clearLog} disabled={!log.length}>Borrar registro</button>
      </div>
    </Sheet>
  );
}
