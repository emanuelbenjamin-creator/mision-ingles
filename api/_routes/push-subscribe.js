import { endpoint, HttpError } from "../_lib/http.js";
import { getStore } from "../_lib/store.js";
import { hasPush, subId } from "../_lib/push.js";

/* Guarda o actualiza la suscripción a recordatorios: { action: "subscribe" | "practice" | "unsubscribe", ... } */
export default endpoint(async body => {
  const store = getStore();
  if (!store || !hasPush()) throw new HttpError(503, "no_push", "Los recordatorios no están activados en este servidor.");
  const sub = body.subscription;
  const ep = sub && typeof sub.endpoint === "string" && sub.endpoint.startsWith("https://") ? sub.endpoint : null;
  if (!ep) throw new HttpError(400, "bad_sub", "Suscripción inválida.");
  const id = subId(ep), key = "push:" + id;
  if (body.action === "unsubscribe") { await store.del(key); await store.srem("push:subs", id); return { ok: true }; }
  const info = {
    lastDay: /^\d{4}-\d{2}-\d{2}$/.test(body.lastDay) ? body.lastDay : "",
    streak: Math.max(0, Math.min(3650, Number(body.streak) || 0)),
    missionsLeft: Math.max(0, Math.min(10, Number(body.missionsLeft) || 0)),
  };
  if (body.action === "practice") {
    if (!(await store.hgetall(key))) return { ok: false };
    await store.hset(key, info);
    return { ok: true };
  }
  if (!sub.keys || typeof sub.keys.p256dh !== "string" || typeof sub.keys.auth !== "string") throw new HttpError(400, "bad_sub", "Suscripción inválida.");
  const hour = Math.max(0, Math.min(23, Math.round(Number(body.hour))));
  await store.hset(key, { sub: JSON.stringify({ endpoint: ep, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }), hour: Number.isFinite(hour) ? hour : 19, tz: String(body.tz || "America/Lima").slice(0, 60), notified: "", ...info });
  await store.sadd("push:subs", id);
  return { ok: true };
}, { bucket: "push", limitEnv: "PUSH_DAILY_LIMIT_PER_IP", limitDefault: 200 });
