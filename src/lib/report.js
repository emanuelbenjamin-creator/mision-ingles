import { addDays } from "./dates.js";

/** Lunes de la semana que contiene la fecha (YYYY-MM-DD). */
export function weekStart(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 domingo
  return addDays(key, -((dow + 6) % 7));
}

/** Guarda una foto de las habilidades al empezar cada semana (para medir el avance). */
export function ensureWeekSnap(s, today) {
  const ws = weekStart(today);
  s.skillSnap = s.skillSnap || {};
  if (!s.skillSnap[ws]) {
    s.skillSnap[ws] = { ...s.skills };
    const keys = Object.keys(s.skillSnap).sort();
    while (keys.length > 12) delete s.skillSnap[keys.shift()];
  }
}

const SKILL_NAMES = { pron: "Pronunciación", flu: "Fluidez", gram: "Gramática", vocab: "Vocabulario", comp: "Comprensión" };

/** Reporte de la semana (offset 0 = esta semana, -1 = la anterior). Todo local, sin IA. */
export function weeklyReport(s, today, offset = 0) {
  const ws = addDays(weekStart(today), offset * 7);
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i)).filter(d => d <= today);
  const inWeek = d => d >= ws && d <= addDays(ws, 6);
  const xp = d => s.xpByDay[d] || 0;
  const xpThis = days.reduce((a, d) => a + xp(d), 0);
  const prevWs = addDays(ws, -7);
  const xpPrev = [0, 1, 2, 3, 4, 5, 6].reduce((a, i) => a + xp(addDays(prevWs, i)), 0);
  const best = days.reduce((b, d) => (xp(d) > (b ? xp(b) : 0) ? d : b), null);
  const missions = days.reduce((a, d) => a + (s.missions[d] || []).length, 0);
  const sessions = s.sessions.filter(x => inWeek(x.d));
  const speakMin = Math.round(sessions.reduce((a, x) => a + (x.type === "live" ? (x.scores && x.scores.secs) || 60 : x.type === "speak" ? 60 : x.type === "ielts" ? 600 : 0), 0) / 60);
  const rules = {};
  s.mistakes.filter(m => inWeek(m.d)).forEach(m => { rules[m.rule] = (rules[m.rule] || 0) + 1; });
  const snapStart = (s.skillSnap || {})[ws];
  const snapEnd = offset === 0 ? s.skills : (s.skillSnap || {})[addDays(ws, 7)] || s.skills;
  const deltas = Object.keys(SKILL_NAMES).map(k => ({ key: k, name: SKILL_NAMES[k], now: snapEnd[k] ?? null, delta: snapStart && snapStart[k] != null && snapEnd[k] != null ? snapEnd[k] - snapStart[k] : null }));
  return {
    weekStart: ws,
    xp: xpThis, xpPrev,
    change: xpPrev ? Math.round((xpThis - xpPrev) / xpPrev * 100) : null,
    daysPracticed: days.filter(d => xp(d) > 0).length,
    missions, speakMin,
    bestDay: best && xp(best) > 0 ? { day: best, xp: xp(best) } : null,
    topErrors: Object.entries(rules).sort((a, b) => b[1] - a[1]).slice(0, 3),
    deltas,
  };
}
