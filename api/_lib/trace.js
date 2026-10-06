import { AsyncLocalStorage } from "node:async_hooks";

/*
 * Registro de qué modelo respondió cada llamada, para el modo diagnóstico.
 * Cada petición tiene su propio registro; endpoint() lo envía al navegador en los encabezados
 * X-AI-Model (los ganadores) y X-AI-Trace (JSON con todos los intentos) y lo deja en los logs de Vercel.
 */
const store = new AsyncLocalStorage();

export const withTrace = fn => store.run([], fn);
export const currentTrace = () => store.getStore() || null;

/**
 * kind: text | tts | live | stt | pron. model: el que respondió (null si todos fallaron).
 * tried: [{ m, r, ms }] con r = ok | lost (otro ganó antes) | 429 | 404 | timeout | invalid | error.
 */
export function note(entry) {
  const t = store.getStore();
  if (t && t.length < 20) t.push({ kind: "text", ms: 0, tried: [], ...entry });
}

export const outcomeOf = e => {
  const msg = String((e && e.message) || "");
  const st = Number(e && (e.status || e.code)) || 0;
  if (e && e.name === "AbortError") return "lost";
  if (st === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg)) return "429";
  if (st === 404 || /NOT_FOUND|not found|not supported/i.test(msg)) return "404";
  if (/tiempo agotado|timeout|timed out/i.test(msg)) return "timeout";
  if (/json|vac[ií]o|empty|incompleta|invalid/i.test(msg)) return "invalid";
  return st ? String(st) : "error";
};

/** Encabezados para la respuesta (seguros para HTTP: el JSON va codificado). */
export function traceHeaders(t) {
  if (!t || !t.length) return {};
  const compact = t.map(x => ({ k: x.kind, m: x.model, ms: x.ms, ...(x.tier ? { tier: x.tier } : {}), ...(x.tried.length ? { t: x.tried } : {}) }));
  return {
    "X-AI-Model": t.map(x => x.model || "ninguno").join(", "),
    "X-AI-Trace": encodeURIComponent(JSON.stringify(compact)).slice(0, 6000),
  };
}

export function logTrace(route, status, t) {
  if (!t || !t.length) return;
  const parts = t.map(x => `${x.kind}=${x.model || "FALLÓ"} ${x.ms}ms` + (x.tried.length ? ` [${x.tried.map(y => `${y.m}:${y.r}${y.ms ? "@" + y.ms : ""}`).join(" ")}]` : ""));
  console.log(`[ai] ${route} ${status} ${parts.join(" | ")}`);
}
