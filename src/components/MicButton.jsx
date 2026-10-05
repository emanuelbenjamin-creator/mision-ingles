import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { canRecognize, canServerTranscribe, startDictation } from "../lib/speech.js";
import { canRecord, startRecording } from "../lib/recorder.js";
import { api } from "../lib/api.js";

/**
 * Botón de micrófono. Usa el reconocimiento de voz del navegador (Web Speech API); si no existe,
 * graba y transcribe con Whisper en el servidor. Si nada de eso es posible, no se muestra
 * (queda el micrófono del teclado).
 */
export default function MicButton({ onText, onStart, onStop, maxMs = 60000, label = "Dictar", className = "btn ghost", disabled }) {
  const [rec, setRec] = useState(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const timer = useRef(null);
  const live = useRef(null);
  useEffect(() => () => { clearTimeout(timer.current); if (live.current) live.current.stop(); }, []);
  const mode = blocked ? null : canRecognize() ? "web" : canRecord() && canServerTranscribe() ? "server" : null;
  if (!mode) return null;

  const stop = () => { clearTimeout(timer.current); if (rec) rec.stop(); };
  const startWeb = () => {
    const r = startDictation({
      onText,
      onEnd: () => { live.current = null; setRec(null); onStop?.(); },
      onError: kind => { if (kind === "blocked") setBlocked(true); },
    });
    if (!r) { setBlocked(true); return; }
    live.current = r;
    onStart?.();
    setRec(r);
    timer.current = setTimeout(() => r.stop(), maxMs);
  };
  const startServer = async () => {
    let r;
    try { r = await startRecording({ maxMs }); } catch { setBlocked(true); return; }
    live.current = r;
    onStart?.();
    setRec(r);
    try {
      const clip = await r.done;
      live.current = null; setRec(null); setBusy(true);
      const { text } = await api("transcribe", { audio: clip.wavBase64 });
      if (text) onText?.(text);
    } catch { /* sin texto */ }
    setBusy(false);
    setTimeout(() => onStop?.(), 50); // deja que el texto llegue a la pantalla antes de comprobar
  };
  const label2 = busy ? "Transcribiendo…" : rec ? "Detener" : label;
  return (
    <button type="button" className={rec ? "btn rec" : className} onClick={rec ? stop : mode === "web" ? startWeb : startServer} disabled={disabled || busy} aria-label={label2 || "Dictar"} data-mode={mode}>
      <Icon name={busy ? "dots" : "mic"} />{label ? label2 : null}
    </button>
  );
}
