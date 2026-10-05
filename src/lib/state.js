import { DECK } from "../content/deck.js";

export const STATE_VERSION = 1;

export function seedCards() {
  return DECK.map((c, i) => ({ id: "d" + i, front: c[0], back: c[1], ex: c[2], tag: c[3], due: null, ivl: 0, ease: 2.5, reps: 0, lapses: 0 }));
}

export function defaultState() {
  return {
    v: STATE_VERSION, updatedAt: 0,
    profile: { name: "", level: "B1", goal: "trabajo", dailyGoal: 50, rate: 0.9, onboarded: false, accessCode: "", voiceMode: "natural", voice: "Kore", accent: "us" },
    xpByDay: {}, totalXP: 0, gems: 0,
    skills: { pron: null, flu: null, gram: null, vocab: null, comp: null },
    sessions: [], missions: {}, reviewsByDay: {}, newByDay: {},
    cards: seedCards(), mistakes: [], grammar: {}, badges: {}, speakSeconds: 0,
  };
}

/** Une un estado guardado con los valores por defecto (tolera versiones viejas o incompletas). */
export function migrate(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const s = { ...base, ...raw };
  s.profile = { ...base.profile, ...raw.profile };
  s.skills = { ...base.skills, ...raw.skills };
  for (const k of ["xpByDay", "missions", "reviewsByDay", "newByDay", "grammar", "badges"]) if (typeof s[k] !== "object" || Array.isArray(s[k]) || !s[k]) s[k] = {};
  for (const k of ["sessions", "mistakes", "cards"]) if (!Array.isArray(s[k])) s[k] = base[k];
  // Agrega al mazo las tarjetas nuevas del contenido que aún no existan.
  const ids = new Set(s.cards.map(c => c.id));
  for (const c of base.cards) if (!ids.has(c.id)) s.cards.push(c);
  s.v = STATE_VERSION;
  return s;
}
