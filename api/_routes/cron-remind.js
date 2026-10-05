import { timingSafeEqual } from "node:crypto";
import { endpoint, HttpError } from "../_lib/http.js";
import { getStore } from "../_lib/store.js";
import { hasPush, localNow, reminderText, sendPush } from "../_lib/push.js";

/*
 * Recordatorios diarios. Vercel Cron lo llama con "Authorization: Bearer <CRON_SECRET>".
 * - Sin ?mode: (cron diario del plan gratis) avisa a todos los que hoy no practicaron.
 * - ?mode=hourly: (cron horario externo, p. ej. cron-job.org) avisa solo a quien eligió esta hora.
 */
function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") || new URL(req.url || "/", "http://x").searchParams.get("key") || "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default endpoint(async (query, req) => {
  if (!authorized(req)) throw new HttpError(401, "unauthorized", "No autorizado.");
  const store = getStore();
  if (!store || !hasPush()) return { sent: 0, skipped: 0, removed: 0, disabled: true };
  const hourly = query.mode === "hourly";
  const ids = await store.smembers("push:subs");
  let sent = 0, skipped = 0, removed = 0;
  for (const id of ids) {
    const s = await store.hgetall("push:" + id);
    if (!s) { await store.srem("push:subs", id); continue; }
    const { day, hour } = localNow(s.tz);
    if (s.lastDay === day || s.notified === day || (hourly && Number(s.hour) !== hour)) { skipped++; continue; }
    try {
      const sub = typeof s.sub === "string" ? JSON.parse(s.sub) : s.sub;
      await sendPush(sub, reminderText(s));
      await store.hset("push:" + id, { notified: day });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { await store.del("push:" + id); await store.srem("push:subs", id); removed++; }
      else skipped++;
    }
  }
  return { sent, skipped, removed };
}, { method: "GET", access: false, limitDefault: 0, limitEnv: "CRON_LIMIT_UNUSED" });
