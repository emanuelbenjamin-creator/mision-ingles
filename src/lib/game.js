import { addDays } from "./dates.js";
import { learnedCount } from "./srs.js";

/*
 * Reglas del juego. Todas las funciones reciben el estado (ya clonado) y lo modifican;
 * devuelven mensajes para mostrar como avisos.
 */

export const MISSION_XP = { speak: 20, pron: 15, grammar: 15, review: 10, chat: 20, dictation: 15, reading: 15, ielts: 40 };
export const CORE_MISSIONS = ["speak", "pron", "grammar", "review"];

export function streak(s, today) {
  let d = today, n = 0;
  if (!(s.xpByDay[d] > 0)) d = addDays(d, -1);
  while (s.xpByDay[d] > 0) { n++; d = addDays(d, -1); }
  return n;
}

export function addXP(s, n, today, why) {
  const msgs = [];
  const before = s.xpByDay[today] || 0;
  s.xpByDay[today] = before + n;
  s.totalXP += n;
  s.gems += Math.floor(n / 5);
  if (why) msgs.push(`+${n} XP · ${why}`);
  if (before < s.profile.dailyGoal && s.xpByDay[today] >= s.profile.dailyGoal) msgs.push("¡Meta diaria cumplida! Tu racha suma un día.");
  return msgs.concat(checkBadges(s, today));
}

export const missionDone = (s, id, today) => (s.missions[today] || []).includes(id);

/** La primera vez en el día da el XP de la misión; repetirla da 5 XP de práctica extra. */
export function completeMission(s, id, label, today) {
  s.missions[today] = s.missions[today] || [];
  if (s.missions[today].includes(id)) return addXP(s, 5, today, label + " (práctica extra)");
  s.missions[today].push(id);
  return addXP(s, MISSION_XP[id], today, "Misión: " + label);
}

/** Promedio móvil: 70% historia, 30% última sesión. */
export function bumpSkill(s, k, v) {
  if (v == null || Number.isNaN(Number(v))) return;
  v = Math.max(0, Math.min(100, Math.round(Number(v))));
  s.skills[k] = s.skills[k] == null ? v : Math.round(s.skills[k] * 0.7 + v * 0.3);
}

export function logSession(s, type, scores, today) {
  s.sessions.push({ d: today, type, scores });
  if (s.sessions.length > 80) s.sessions = s.sessions.slice(-80);
}

/** Guarda el error en el cuaderno y lo convierte en tarjeta de repaso (sin duplicados). */
export function addMistake(s, { wrong, right, why, rule, src }, today) {
  if (!wrong || !right) return false;
  const norm = String(wrong).trim().toLowerCase();
  if (norm === String(right).trim().toLowerCase()) return false;
  if (s.mistakes.some(m => m.wrong.trim().toLowerCase() === norm)) return false;
  s.mistakes.unshift({ d: today, wrong: String(wrong).trim(), right: String(right).trim(), why: why || "", rule: rule || "Otro", src: src || "" });
  if (s.mistakes.length > 150) s.mistakes.length = 150;
  s.cards.push({ id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), front: "Corrige: «" + String(wrong).trim() + "»", back: String(right).trim(), ex: why || "", tag: "mi error", due: null, ivl: 0, ease: 2.5, reps: 0, lapses: 0 });
  return true;
}

/** Agrega una tarjeta de vocabulario al mazo (sin duplicar). Devuelve true si la agregó. */
export function addCard(s, { front, back, ex = "", tag = "lectura" }) {
  const f = String(front || "").trim();
  if (!f || !back) return false;
  if (s.cards.some(c => c.front.toLowerCase() === f.toLowerCase())) return false;
  s.cards.push({ id: "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), front: f, back: String(back).trim(), ex, tag, due: null, ivl: 0, ease: 2.5, reps: 0, lapses: 0 });
  return true;
}

export const BADGES = [
  ["first", "Primera misión", s => s.totalXP > 0],
  ["s3", "Racha de 3 días", (s, t) => streak(s, t) >= 3],
  ["s7", "Racha de 7 días", (s, t) => streak(s, t) >= 7],
  ["s30", "Racha de 30 días", (s, t) => streak(s, t) >= 30],
  ["xp500", "500 XP", s => s.totalXP >= 500],
  ["talk", "Primera conversación", s => s.sessions.some(x => x.type === "chat")],
  ["perfect", "Gramática perfecta", s => Object.values(s.grammar).some(v => v === 100)],
  ["cards20", "20 palabras aprendidas", s => learnedCount(s) >= 20],
];

export function checkBadges(s, today) {
  const msgs = [];
  for (const [id, name, ok] of BADGES) if (!s.badges[id] && ok(s, today)) { s.badges[id] = today; msgs.push("Logro desbloqueado: " + name); }
  return msgs;
}
