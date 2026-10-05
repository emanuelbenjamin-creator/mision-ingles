import { addDays } from "./dates.js";

export const NEW_PER_DAY = 8;

/** Tarjetas para hoy: las vencidas + hasta NEW_PER_DAY nuevas (primero tus errores). */
export function dueCards(s, today) {
  const due = s.cards.filter(c => c.reps > 0 && c.due && c.due <= today);
  const newLeft = Math.max(0, NEW_PER_DAY - (s.newByDay[today] || 0));
  const mine = s.cards.filter(c => c.reps === 0 && c.tag === "mi error");
  const fresh = s.cards.filter(c => c.reps === 0 && c.tag !== "mi error");
  return due.concat(mine.concat(fresh).slice(0, newLeft));
}

/** SM-2 simplificado. g: 0 otra vez, 1 difícil, 2 bien, 3 fácil. Devuelve una tarjeta nueva. */
export function schedule(c, g, today) {
  const n = { ...c };
  if (g === 0) { n.lapses++; n.ivl = 0; n.ease = Math.max(1.3, n.ease - 0.2); n.reps = Math.max(1, n.reps); n.due = today; return n; }
  if (g === 1) { n.ivl = Math.max(1, Math.round((n.ivl || 1) * 1.2)); n.ease = Math.max(1.3, n.ease - 0.15); }
  if (g === 2) { n.ivl = n.reps === 0 ? 1 : n.ivl <= 1 ? 3 : Math.round(n.ivl * n.ease); }
  if (g === 3) { n.ivl = n.reps === 0 ? 4 : Math.round(Math.max(n.ivl, 2) * n.ease * 1.3); n.ease += 0.15; }
  n.reps++;
  n.due = addDays(today, n.ivl);
  return n;
}

export function ivlLabel(c, g, today) {
  const n = schedule(c, g, today);
  return g === 0 ? "hoy" : n.ivl === 1 ? "1 día" : n.ivl + " días";
}

export const learnedCount = s => s.cards.filter(c => c.ivl >= 3).length;
