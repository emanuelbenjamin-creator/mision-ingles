import { LEVELS } from "../content/meta.js";
import { GRAMMAR } from "../content/grammar.js";
import { learnedCount } from "./srs.js";

export const levelIdx = lv => Math.max(0, LEVELS.indexOf(lv));
/** Banda de temas de habla: A (A1–A2), B (B1–B2), C (C1–C2). */
export const band = lv => { const i = levelIdx(lv); return i <= 1 ? "A" : i <= 3 ? "B" : "C"; };

/** % de avance en el nivel actual: gramática del nivel dominada, puntajes de habla y vocabulario aprendido. */
export function levelProgress(s) {
  const lv = s.profile.level;
  const own = GRAMMAR.filter(g => g.lv === lv);
  const pool = own.length ? own : GRAMMAR.filter(g => levelIdx(g.lv) <= levelIdx(lv));
  const gram = pool.length ? pool.filter(g => s.grammar[g.id] >= 75).length / pool.length : 0;
  const vals = Object.values(s.skills).filter(v => v != null);
  const sk = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length / 100 : 0;
  const cards = Math.min(1, learnedCount(s) / 30);
  return Math.round((gram * 0.4 + sk * 0.35 + cards * 0.25) * 100);
}
