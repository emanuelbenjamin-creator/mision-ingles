import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "./http.js";

/* Ligas semanales anónimas: grupos de hasta 30 por división; los 5 primeros suben y los 5 últimos bajan. */

export const DIVISIONS = ["Bronce", "Plata", "Oro", "Zafiro", "Diamante"];
export const GROUP_SIZE = 30, PROMOTE = 5, DEMOTE = 5, MIN_FOR_DEMOTION = 10;
const MAX_WEEK_XP = 3000, MAX_XP_PER_HOUR = 400;
const TTL = 60 * 60 * 24 * 28;

const sha = s => createHash("sha256").update(String(s)).digest("hex");

/** Semana de liga: lunes en hora de Perú (UTC-5). */
export function weekKey(now = Date.now()) {
  const d = new Date(now - 5 * 3600e3);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const pairs = flat => { const out = []; for (let i = 0; i < flat.length; i += 2) out.push([String(flat[i]), Number(flat[i + 1])]); return out; };

export async function join(store, nickname) {
  const nick = String(nickname || "").replace(/\s+/g, " ").trim();
  if (!/^[\p{L}\p{N} ._-]{2,20}$/u.test(nick)) throw new HttpError(400, "bad_nick", "El apodo debe tener entre 2 y 20 letras o números.");
  const playerId = randomBytes(6).toString("hex");
  const secret = randomBytes(16).toString("hex");
  await store.hset("p:" + playerId, { nick, sh: sha(secret), div: 0, week: "", group: "", xp: 0, at: 0, last: "" });
  return { playerId, secret };
}

async function auth(store, playerId, secret) {
  const id = String(playerId || "");
  const p = /^[a-f0-9]{12}$/.test(id) ? await store.hgetall("p:" + id) : null;
  if (!p || p.sh !== sha(secret)) throw new HttpError(401, "bad_player", "No encontramos tu jugador de la liga. Vuelve a unirte.");
  return { ...p, id };
}

/** Al empezar una semana nueva: aplica ascenso/descenso de la anterior y asigna un grupo. */
async function placeInWeek(store, p, week, now) {
  if (p.week === week) return p;
  let div = Number(p.div) || 0, last = "";
  if (p.group) {
    const board = pairs(await store.zrange("g:" + p.group, 0, -1, { rev: true, withScores: true }));
    const rank = board.findIndex(([m]) => m === p.id);
    if (rank >= 0) {
      if (rank < PROMOTE && Number(p.xp) > 0 && div < DIVISIONS.length - 1) { div++; last = "up"; }
      else if (board.length >= MIN_FOR_DEMOTION && rank >= board.length - DEMOTE && div > 0) { div--; last = "down"; }
      else last = "stay";
    }
  }
  const fillKey = `gfill:${week}:${div}`;
  let group = await store.get(fillKey);
  if (!group || (await store.zcard("g:" + group)) >= GROUP_SIZE) {
    group = `${week}:${div}:${await store.incr(`gc:${week}:${div}`)}`;
    await store.set(fillKey, group);
  }
  await store.zadd("g:" + group, { score: 0, member: p.id });
  await store.expire("g:" + group, TTL);
  const upd = { div, week, group, xp: 0, at: now, last };
  await store.hset("p:" + p.id, upd);
  return { ...p, ...upd };
}

async function view(store, p) {
  const board = pairs(await store.zrange("g:" + p.group, 0, -1, { rev: true, withScores: true }));
  const nicks = await Promise.all(board.map(([m]) => store.hget("p:" + m, "nick")));
  const div = Number(p.div) || 0, n = board.length;
  const demote = n >= MIN_FOR_DEMOTION && div > 0 ? DEMOTE : 0;
  const rows = board.map(([m, xp], i) => ({
    rank: i + 1, nick: String(nicks[i] || "Jugador"), xp, me: m === p.id,
    zone: i < PROMOTE && div < DIVISIONS.length - 1 ? "up" : i >= n - demote ? "down" : "",
  }));
  return { division: DIVISIONS[div], divIndex: div, week: p.week, rows, myRank: rows.findIndex(r => r.me) + 1, last: p.last || "", nick: p.nick };
}

/** Sincroniza el XP semanal del jugador y devuelve su grupo. Rechaza saltos imposibles. */
export async function sync(store, { playerId, secret, weekXP }, now = Date.now()) {
  let p = await auth(store, playerId, secret);
  p = await placeInWeek(store, p, weekKey(now), now);
  if (weekXP != null) {
    const x = Math.floor(Number(weekXP));
    if (!Number.isFinite(x) || x < 0 || x > MAX_WEEK_XP) throw new HttpError(400, "bad_xp", "XP semanal inválido.");
    const prev = Number(p.xp) || 0;
    if (x > prev) {
      const hours = Math.max(0, (now - (Number(p.at) || now)) / 3.6e6);
      if (x - prev > MAX_XP_PER_HOUR * Math.max(1, hours)) throw new HttpError(400, "suspicious", "Ese aumento de XP no es posible. Si es un error, espera un rato y vuelve a intentar.");
      await store.zadd("g:" + p.group, { score: x, member: p.id });
      await store.hset("p:" + p.id, { xp: x, at: now });
      p = { ...p, xp: x, at: now };
    }
  }
  return view(store, p);
}

export async function leave(store, { playerId, secret }) {
  const p = await auth(store, playerId, secret);
  if (p.group) await store.zrem("g:" + p.group, p.id);
  await store.del("p:" + p.id);
  return { ok: true };
}
