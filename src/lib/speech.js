/* Dictado con la Web Speech API del navegador (gratis). Para escuchar, ver audio.js. */

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canRecognize = () => !!SR;

/**
 * Empieza a dictar en inglés. onText recibe el texto acumulado de esta grabación.
 * Devuelve { stop } o null si el navegador no lo permite. onError recibe "blocked" o "other".
 */
export function startDictation({ onText, onEnd, onError }) {
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = ev => { let txt = ""; for (const r of ev.results) txt += r[0].transcript; onText?.(txt.trim()); };
  rec.onerror = ev => onError?.(["not-allowed", "service-not-allowed", "audio-capture"].includes(ev.error) ? "blocked" : "other");
  rec.onend = () => onEnd?.();
  try { rec.start(); } catch { return null; }
  return { stop: () => { try { rec.stop(); } catch { /* ya detenido */ } } };
}
