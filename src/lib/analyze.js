import { words } from "./align.js";
import { findMistakes } from "./rules.js";

const FILLERS = /\b(um+|uh+|eh+|ehm|este|you know|i mean)\b|,\s*like\s*,/g;
const CONNECTORS = /\b(because|so|however|first|then|finally|although|but|also|therefore|while)\b/gi;

/** Evaluación básica sin IA: métricas de fluidez y errores típicos detectados localmente. */
export function localAnalyze(text, secs) {
  const w = words(text), n = w.length;
  const fixes = findMistakes(text);
  const fillers = (String(text).toLowerCase().match(FILLERS) || []).length;
  const ttr = n ? new Set(w).size / n : 0;
  const longW = w.filter(x => x.length >= 7).length / (n || 1);
  const wpm = secs > 5 ? Math.round(n / (secs / 60)) : null;
  const flu = wpm == null ? Math.min(100, 40 + n * 0.6) : Math.max(20, 100 - Math.abs(130 - wpm) * 0.7) - fillers * 3;
  const vocab = Math.min(100, Math.round(ttr * 70 + longW * 120 + 10));
  const gram = Math.max(30, Math.round(100 - fixes.length * (60 / Math.max(1, n / 25))));
  const coh = Math.min(100, Math.round(35 + Math.min(n, 120) * 0.45 + (String(text).match(CONNECTORS) || []).length * 4));
  return { n, wpm, fillers, fixes, scores: { fluency: Math.round(Math.max(0, flu)), grammar: gram, vocabulary: vocab, coherence: coh } };
}
