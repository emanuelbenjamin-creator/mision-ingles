import { api } from "./api.js";
import { addDays } from "./dates.js";
import { weekStart } from "./report.js";

/** XP ganado desde el lunes (la liga se reinicia cada semana). */
export function weekXP(s, today) {
  const ws = weekStart(today);
  let sum = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (d <= today) sum += s.xpByDay[d] || 0; }
  return sum;
}

export const daysLeft = today => { const ws = weekStart(today); let n = 0; for (let i = 0; i < 7; i++) if (addDays(ws, i) >= today) n++; return n; };

export const joinLeague = (nickname, xp) => api("league", { action: "join", nickname, weekXP: xp });
export const syncLeague = (league, xp) => api("league", { action: "sync", playerId: league.playerId, secret: league.secret, weekXP: xp });
export const leaveLeague = league => api("league", { action: "leave", playerId: league.playerId, secret: league.secret });
