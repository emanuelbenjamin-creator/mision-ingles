import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { canRecognize, startDictation } from "../lib/speech.js";

/**
 * Botón de micrófono (Web Speech API). onText recibe el texto dictado en esta grabación.
 * Si el navegador no lo permite, no se muestra: queda el micrófono del teclado.
 */
export default function MicButton({ onText, onStart, onStop, maxMs = 60000, label = "Dictar", className = "btn ghost", disabled }) {
  const [rec, setRec] = useState(null);
  const [blocked, setBlocked] = useState(!canRecognize());
  const timer = useRef(null);
  const live = useRef(null);
  useEffect(() => () => { clearTimeout(timer.current); if (live.current) live.current.stop(); }, []);
  if (blocked) return null;
  const stop = () => { clearTimeout(timer.current); if (rec) rec.stop(); };
  const start = () => {
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
  return (
    <button type="button" className={rec ? "btn rec" : className} onClick={rec ? stop : start} disabled={disabled} aria-label={rec ? "Detener" : label}>
      <Icon name="mic" />{rec ? "Detener" : label}
    </button>
  );
}
