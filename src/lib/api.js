/* Cliente de las funciones serverless (/api/*). La clave de Gemini nunca llega al navegador. */
import { recordCall } from "./trace.js";

/** Registra qué modelo respondió (modo diagnóstico) y lo adjunta como propiedad oculta _ai. */
function traced(path, res, t0, target) {
  const ev = recordCall({ route: path, status: res.status, ms: Date.now() - t0, header: res.headers && res.headers.get && res.headers.get("X-AI-Trace") });
  if (ev && target && typeof target === "object") { try { Object.defineProperty(target, "_ai", { value: ev, enumerable: false }); } catch { /* objeto congelado */ } }
  return ev;
}
/** Qué modelo produjo esta respuesta de api()/apiBlob() (o null). */
export const aiOf = x => (x && x._ai) || null;

export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

let accessCode = "";

/* Conteo local de consultas por día (para «Mi uso»). */
const NO_COUNT = new Set(["health", "league", "push-subscribe"]);
const bucketOf = path => (path === "tts" ? "tts" : path === "live-token" ? "live" : "ai");
const usageKey = () => { const d = new Date(); return `mi-usage-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function getUsage() {
  try { return { ai: 0, tts: 0, live: 0, ...JSON.parse(localStorage.getItem(usageKey()) || "{}") }; } catch { return { ai: 0, tts: 0, live: 0 }; }
}
function countUsage(path) {
  if (NO_COUNT.has(path)) return;
  try { const u = getUsage(); u[bucketOf(path)]++; localStorage.setItem(usageKey(), JSON.stringify(u)); } catch { /* sin almacenamiento */ }
}
export const setAccessCode = c => { accessCode = c || ""; };

export async function api(path, body, { signal } = {}) {
  countUsage(path);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch("/api/" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(accessCode ? { "x-access-code": accessCode } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw new ApiError("cancelled", "");
    throw new ApiError("offline", "Sin conexión con el servidor. Revisa tu internet.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* respuesta vacía */ }
  const ev = traced(path, res, t0, data);
  if (!res.ok) throw Object.assign(new ApiError((data && data.code) || "server", (data && data.error) || "El coach no respondió. Inténtalo otra vez."), { _ai: ev });
  return data;
}

/** Estado del servidor: { ai: hay clave de Gemini, accessCodeRequired }. Nunca lanza. */
export async function health() {
  try { return await api("health"); } catch { return { ai: false, accessCodeRequired: false }; }
}

/** Igual que api() pero devuelve el cuerpo como Blob (audio). */
export async function apiBlob(path, body, { signal } = {}) {
  countUsage(path);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch("/api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessCode ? { "x-access-code": accessCode } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw new ApiError("cancelled", "");
    throw new ApiError("offline", "Sin conexión con el servidor.");
  }
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    const ev = traced(path, res, t0, null);
    throw Object.assign(new ApiError((data && data.code) || "server", (data && data.error) || "No se pudo generar el audio."), { _ai: ev });
  }
  const blob = await res.blob();
  traced(path, res, t0, blob);
  return blob;
}
