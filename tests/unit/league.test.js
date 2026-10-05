import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { join, leave, sync, weekKey } from "../../api/_lib/league.js";
import { _setStore, memoryStore } from "../../api/_lib/store.js";
import { _resetRateLimit } from "../../api/_lib/http.js";
import dispatcher from "../../api/[route].js";

const MON = Date.UTC(2026, 9, 5, 15); // lunes 5 oct 2026, 10:00 en Perú
const H = 3600e3, DAY = 24 * H;

function call(route, body, method = "POST") {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  req.method = method; req.url = "/api/" + route; req.query = { route }; req.headers = { "x-forwarded-for": "7.7.7.7" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    dispatcher(req, res);
  });
}

describe("ligas semanales", () => {
  let st;
  beforeEach(() => { st = memoryStore(); });

  it("la semana de liga empieza el lunes (hora de Perú)", () => {
    expect(weekKey(MON)).toBe("2026-10-05");
    expect(weekKey(Date.UTC(2026, 9, 5, 3))).toBe("2026-09-28"); // domingo 22:00 en Perú
    expect(weekKey(MON + 6 * DAY)).toBe("2026-10-05");
  });

  it("unirse, sumar XP y ver el grupo ordenado", async () => {
    const a = await join(st, "Ana");
    const b = await join(st, "Beto");
    await sync(st, { ...a, weekXP: 50 }, MON);
    const v = await sync(st, { ...b, weekXP: 80 }, MON);
    expect(v.division).toBe("Bronce");
    expect(v.rows.map(r => [r.nick, r.xp, r.me])).toEqual([["Beto", 80, true], ["Ana", 50, false]]);
    expect(v.myRank).toBe(1);
    expect(v.rows[0].zone).toBe("up");
  });

  it("rechaza apodos inválidos, secretos incorrectos y XP imposible", async () => {
    await expect(join(st, "x")).rejects.toMatchObject({ code: "bad_nick" });
    const a = await join(st, "Ana");
    await expect(sync(st, { playerId: a.playerId, secret: "nope" }, MON)).rejects.toMatchObject({ status: 401 });
    await expect(sync(st, { ...a, weekXP: 5000 }, MON)).rejects.toMatchObject({ code: "bad_xp" });
    await expect(sync(st, { ...a, weekXP: 900 }, MON)).rejects.toMatchObject({ code: "suspicious" });
    expect((await sync(st, { ...a, weekXP: 300 }, MON)).rows[0].xp).toBe(300);
    expect((await sync(st, { ...a, weekXP: 1000 }, MON + 2 * H)).rows[0].xp).toBe(1000); // 700 en 2 h está permitido
    expect((await sync(st, { ...a, weekXP: 100 }, MON + 3 * H)).rows[0].xp).toBe(1000); // nunca baja
  });

  it("al cambiar de semana suben los 5 primeros y bajan los 5 últimos", async () => {
    const players = [];
    for (let i = 0; i < 12; i++) players.push(await join(st, "P" + i));
    // Semana 1: todos en Plata para poder bajar
    for (const p of players) await st.hset("p:" + p.playerId, { div: 1 });
    for (const [i, p] of players.entries()) await sync(st, { ...p, weekXP: (12 - i) * 10 }, MON);
    const next = MON + 7 * DAY;
    const top = await sync(st, { ...players[0] }, next);
    const mid = await sync(st, { ...players[6] }, next);
    const last = await sync(st, { ...players[11] }, next);
    expect([top.division, top.last]).toEqual(["Oro", "up"]);
    expect([mid.division, mid.last]).toEqual(["Plata", "stay"]);
    expect([last.division, last.last]).toEqual(["Bronce", "down"]);
    expect(top.rows).toHaveLength(1); // grupo nuevo de la semana
  });

  it("grupos de máximo 30", async () => {
    const ids = [];
    for (let i = 0; i < 31; i++) { const p = await join(st, "J" + i); ids.push(p); await sync(st, p, MON); }
    const v1 = await sync(st, ids[0], MON), v31 = await sync(st, ids[30], MON);
    expect(v1.rows).toHaveLength(30);
    expect(v31.rows).toHaveLength(1);
  });

  it("salir de la liga borra al jugador", async () => {
    const a = await join(st, "Ana");
    await sync(st, a, MON);
    expect(await leave(st, a)).toEqual({ ok: true });
    await expect(sync(st, a, MON)).rejects.toMatchObject({ status: 401 });
  });
});

describe("router único de la API", () => {
  beforeEach(() => _resetRateLimit());
  afterEach(() => _setStore(undefined));
  it("despacha por nombre y responde 404 a rutas desconocidas", async () => {
    expect((await call("health", null, "GET")).body).toMatchObject({ ok: true });
    expect((await call("nada", null, "GET")).status).toBe(404);
  });
  it("league sin Redis → 503; con Redis → unirse", async () => {
    _setStore(null);
    expect((await call("league", { action: "join", nickname: "Ana" })).status).toBe(503);
    _setStore(memoryStore());
    const r = await call("league", { action: "join", nickname: "Ana", weekXP: 20 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ division: "Bronce", myRank: 1 });
    expect(r.body.playerId).toMatch(/^[a-f0-9]{12}$/);
    expect((await call("health", null, "GET")).body.leagues).toBe(true);
  });
});
