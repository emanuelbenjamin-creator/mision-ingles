import { api } from "./api.js";

/* Recordatorios por notificación (Web Push). En iPhone solo funcionan con la app instalada. */

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

function keyToBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function currentSub() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Pide permiso, se suscribe y registra la hora preferida en el servidor. */
export async function enableReminders(vapidKey, { hour, streak, lastDay, missionsLeft }) {
  if (!pushSupported()) throw new Error(isIOS() ? "En iPhone primero instala la app: Compartir → «Agregar a inicio», y ábrela desde ahí." : "Tu navegador no admite notificaciones.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Las notificaciones están bloqueadas. Actívalas en los permisos del navegador.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidKey) });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Lima";
  await api("push-subscribe", { action: "subscribe", subscription: sub.toJSON(), hour, tz, streak, lastDay, missionsLeft });
}

export async function disableReminders() {
  if (!pushSupported()) return;
  const sub = await currentSub();
  if (!sub) return;
  try { await api("push-subscribe", { action: "unsubscribe", subscription: sub.toJSON() }); } catch { /* igual se cancela en el navegador */ }
  await sub.unsubscribe();
}

/** Avisa al servidor que hoy ya practicaste (para no enviar el recordatorio). */
export async function reportPractice(info) {
  if (!pushSupported()) return;
  const sub = await currentSub();
  if (sub) await api("push-subscribe", { action: "practice", subscription: sub.toJSON(), ...info });
}
