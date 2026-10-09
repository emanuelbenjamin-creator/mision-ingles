import { DECK } from "../content/deck.js";
import { PROFESSIONS } from "../content/professions.js";

export const STATE_VERSION = 1;

export function seedCards() {
  return DECK.map((c, i) => ({ id: "d" + i, front: c[0], back: c[1], ex: c[2], tag: c[3], due: null, ivl: 0, ease: 2.5, reps: 0, lapses: 0 }));
}

export function defaultState() {
  return {
    v: STATE_VERSION, updatedAt: 0,
    profile: { name: "", level: "B1", goal: "trabajo", dailyGoal: 50, rate: 0.9, onboarded: false, accessCode: "", voiceMode: "natural", voice: "Kore", accent: "us", tone: "friendly", profession: "general", liveVoice: "Puck", liveVoiceMode: "character", liveCards: true, theme: "system", kokoroVoice: "af_heart", kokoroEnabled: false },
    xpByDay: {}, totalXP: 0, gems: 0,
    skills: { pron: null, flu: null, gram: null, vocab: null, comp: null },
    sessions: [], missions: {}, reviewsByDay: {}, newByDay: {},
    cards: seedCards(), mistakes: [], grammar: {}, badges: {}, speakSeconds: 0, skillSnap: {}, lessons: {}, ielts: [], liveSessions: [], stories: [], games: {}, playXP: {},
  };
}

/** Une un estado guardado con los valores por defecto (tolera versiones viejas o incompletas). */
export function migrate(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const s = { ...base, ...raw };
  s.profile = { ...base.profile, ...raw.profile };
  s.skills = { ...base.skills, ...raw.skills };
  for (const k of ["xpByDay", "missions", "reviewsByDay", "newByDay", "grammar", "badges", "skillSnap", "lessons", "games", "playXP"]) if (typeof s[k] !== "object" || Array.isArray(s[k]) || !s[k]) s[k] = {};
  for (const k of ["sessions", "mistakes", "cards", "ielts", "liveSessions", "stories"]) if (!Array.isArray(s[k])) s[k] = base[k];
  // Agrega al mazo las tarjetas nuevas del contenido que aún no existan.
  const ids = new Set(s.cards.map(c => c.id));
  for (const c of base.cards) if (!ids.has(c.id)) s.cards.push(c);
  s.v = STATE_VERSION;
  return s;
}

/** Agrega al mazo las tarjetas de vocabulario de la profesión (sin duplicar). */
export function addProfessionCards(s) {
  const p = PROFESSIONS[s.profile.profession];
  if (!p) return 0;
  const have = new Set(s.cards.map(c => c.front.toLowerCase()));
  let n = 0;
  p.cards.forEach(([front, back, ex], i) => {
    if (have.has(front.toLowerCase())) return;
    s.cards.push({ id: `p-${s.profile.profession}-${i}`, front, back, ex, tag: p.name, due: null, ivl: 0, ease: 2.5, reps: 0, lapses: 0 });
    n++;
  });
  return n;
}
