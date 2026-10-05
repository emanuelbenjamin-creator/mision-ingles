import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import dispatcher from "../../api/[route].js";
import { _setStore, memoryStore } from "../../api/_lib/store.js";
import { _setSender, localNow, reminderText, subId } from "../../api/_lib/push.js";
import { _resetRateLimit } from "../../api/_lib/http.js";

function call(route, { body, method = "POST", headers = {}, url } = {}) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  req.method = method; req.url = url || "/api/" + route; req.query = { route }; req.headers = { "x-forwarded-for": "8.8.8.8", ...headers };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    dispatcher(req, res);
  });
}
const sub = n => ({ endpoint: "https://push.example/" + n, keys: { p256dh: "p" + n, auth: "a" + n } });
const today = localNow("America/Lima").day;

let st, sent;
beforeEach(() => {
  _resetRateLimit();
  st = memoryStore(); _setStore(st);
  sent = []; _setSender(async (s, p) => { if (s.endpoint.endsWith("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 }); sent.push([s.endpoint, p]); });
  Object.assign(process.env, { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", CRON_SECRET: "cron-secret" });
});
afterEach(() => { _setStore(undefined); _setSender(null); for (const k of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET"]) delete process.env[k]; });

describe("recordatorios push", () => {
  it("textos según la racha", () => {
    expect(reminderText({ streak: 5, missionsLeft: 2 }).title).toContain("racha de 5 días");
    expect(reminderText({ streak: 0 }).tab).toBe("hablar");
  });
  it("localNow usa la zona horaria y tolera zonas inválidas", () => {
    const t = Date.UTC(2026, 9, 6, 3, 30); // 22:30 del 5 en Lima
    expect(localNow("America/Lima", t)).toEqual({ day: "2026-10-05", hour: 22 });
    expect(localNow("Mars/Base", t)).toEqual({ day: "2026-10-05", hour: 22 });
  });
  it("suscribir, informar práctica y desuscribir", async () => {
    expect((await call("push-subscribe", { body: { action: "subscribe", subscription: sub(1), hour: 20, tz: "America/Lima", streak: 3 } })).status).toBe(200);
    const id = subId(sub(1).endpoint);
    expect(await st.smembers("push:subs")).toEqual([id]);
    expect(await st.hgetall("push:" + id)).toMatchObject({ hour: 20, tz: "America/Lima", streak: 3 });
    await call("push-subscribe", { body: { action: "practice", subscription: sub(1), lastDay: today, streak: 4 } });
    expect(await st.hgetall("push:" + id)).toMatchObject({ lastDay: today, streak: 4 });
    await call("push-subscribe", { body: { action: "unsubscribe", subscription: sub(1) } });
    expect(await st.smembers("push:subs")).toEqual([]);
  });
  it("valida la suscripción y avisa si no hay claves", async () => {
    expect((await call("push-subscribe", { body: { subscription: { endpoint: "http://inseguro" } } })).status).toBe(400);
    delete process.env.VAPID_PRIVATE_KEY;
    expect((await call("push-subscribe", { body: { subscription: sub(1) } })).status).toBe(503);
  });
  it("cron: exige el secreto, avisa solo a quien no practicó y limpia suscripciones vencidas", async () => {
    for (const [n, lastDay] of [["1", ""], ["2", today], ["gone", ""]]) await call("push-subscribe", { body: { action: "subscribe", subscription: sub(n), hour: 19, tz: "America/Lima", streak: 2, lastDay } });
    expect((await call("cron-remind", { method: "GET" })).status).toBe(401);
    const r = await call("cron-remind", { method: "GET", headers: { authorization: "Bearer cron-secret" } });
    expect(r.body).toEqual({ sent: 1, skipped: 1, removed: 1 });
    expect(sent[0][0]).toBe("https://push.example/1");
    expect(sent[0][1].title).toContain("racha de 2 días");
    const again = await call("cron-remind", { method: "GET", headers: { authorization: "Bearer cron-secret" } });
    expect(again.body.sent).toBe(0); // no se repite el mismo día
  });
  it("modo horario: solo a quien eligió esta hora", async () => {
    const { hour } = localNow("America/Lima");
    await call("push-subscribe", { body: { action: "subscribe", subscription: sub("a"), hour, tz: "America/Lima" } });
    await call("push-subscribe", { body: { action: "subscribe", subscription: sub("b"), hour: (hour + 3) % 24, tz: "America/Lima" } });
    const r = await call("cron-remind", { method: "GET", url: "/api/cron-remind?mode=hourly&key=cron-secret" });
    expect(r.body).toMatchObject({ sent: 1, skipped: 1 });
  });
});
