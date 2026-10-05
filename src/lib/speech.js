/* Voz en el navegador: speechSynthesis para escuchar y Web Speech API para dictar. Ambas gratuitas. */

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canRecognize = () => !!SR;

let voices = [];
function loadVoices() { try { voices = window.speechSynthesis.getVoices(); } catch { voices = []; } }
if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function speak(text, rate = 0.9) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    const v = voices.find(x => /^en[-_]US/i.test(x.lang) && /natural|google|samantha|aria|jenny/i.test(x.name))
      || voices.find(x => /^en[-_]US/i.test(x.lang)) || voices.find(x => /^en/i.test(x.lang));
    if (v) u.voice = v;
    synth.speak(u);
    return true;
  } catch { return false; }
}

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
