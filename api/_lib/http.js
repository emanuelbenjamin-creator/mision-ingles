import { timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

const MAX_BODY = 64 * 1024;

export async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = "";
  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) raw = String(req.body);
  else {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) throw new HttpError(413, "too_large", "El texto es demasiado largo.");
      chunks.push(c);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (raw.length > MAX_BODY) throw new HttpError(413, "too_large", "El texto es demasiado largo.");
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, "bad_json", "La solicitud no es un JSON válido."); }
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : String(fwd || "")).split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "local";
}

/* Límite diario por IP. Vive en la memoria de cada instancia serverless: es un freno de costos, no una garantía exacta. */
const hits = new Map();
export function rateLimit(ip, limit, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const key = day + "|" + ip;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (hits.size > 5000) for (const k of hits.keys()) if (!k.startsWith(day)) hits.delete(k);
  return n <= limit;
}
export const _resetRateLimit = () => hits.clear();

export function checkAccess(req) {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) return;
  const given = String(req.headers["x-access-code"] || "");
  const a = Buffer.from(given), b = Buffer.from(code);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "access_code", "Código de acceso incorrecto. Revísalo en Ajustes.");
}

/** Envuelve un endpoint POST: método, código de acceso, límite diario, lectura del JSON y errores. */
export function endpoint(fn) {
  return async function handler(req, res) {
    try {
      if (req.method !== "POST") throw new HttpError(405, "method", "Método no permitido.");
      checkAccess(req);
      const limit = Number(process.env.DAILY_LIMIT_PER_IP || 80);
      if (!rateLimit(clientIp(req), limit)) throw new HttpError(429, "rate_limited", "Llegaste al límite de consultas al coach por hoy. Vuelve mañana.");
      const body = await readJson(req);
      send(res, 200, await fn(body || {}, req));
    } catch (e) {
      if (e instanceof HttpError) send(res, e.status, { code: e.code, error: e.message });
      else { console.error(e); send(res, 500, { code: "server", error: "Error interno. Inténtalo otra vez." }); }
    }
  };
}
