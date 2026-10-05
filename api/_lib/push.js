import webpush from "web-push";
import { createHash } from "node:crypto";

/* Envío de notificaciones Web Push con claves VAPID (gratis, sin servicios externos). */

let configured = false;
let sender = null;
/** Solo para pruebas: reemplaza el envío real. */
export const _setSender = fn => { sender = fn; };

export const hasPush = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const subId = endpoint => createHash("sha256").update(String(endpoint)).digest("hex").slice(0, 24);

export async function sendPush(subscription, payload) {
  if (sender) return sender(subscription, payload);
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 6 * 3600 });
}

/** Fecha (YYYY-MM-DD) y hora local de una zona horaria IANA. */
export function localNow(tz, now = Date.now()) {
  let zone = tz;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = "America/Lima"; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function reminderText({ streak, missionsLeft }) {
  const s = Number(streak) || 0, m = Number(missionsLeft) || 0;
  if (s >= 2) return { title: `🔥 Tu racha de ${s} días está en peligro`, body: m ? `Te faltan ${m} misiones. Con 5 minutos la salvas.` : "Practica 5 minutos para mantenerla.", tab: "hoy" };
  if (s === 1) return { title: "¡Ayer empezaste una racha!", body: "Haz una misión hoy para llegar a 2 días seguidos.", tab: "hoy" };
  return { title: "Tus misiones de inglés te esperan", body: "Habla 60 segundos con tu coach y gana tus primeros XP del día.", tab: "hablar" };
}
