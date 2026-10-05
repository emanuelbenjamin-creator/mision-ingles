import { Redis } from "@upstash/redis";

/*
 * Almacenamiento compartido para ligas y recordatorios: Upstash Redis (capa gratuita),
 * conectado desde Vercel → Storage → Upstash. Sin variables configuradas, devuelve null
 * y esas funciones se desactivan sin afectar al resto de la app.
 */
let store = null;
let override = false;

export function getStore() {
  if (override || store) return store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  store = new Redis({ url, token });
  return store;
}
export const hasStore = () => !!getStore();

/** Solo para pruebas: usa un almacén falso (o null para simular que no hay Redis). */
export const _setStore = s => { store = s; override = s !== undefined; };

/** Almacén en memoria con la misma interfaz que usamos de @upstash/redis (para pruebas). */
export function memoryStore() {
  const kv = new Map(), hashes = new Map(), zsets = new Map(), sets = new Map();
  const z = k => { if (!zsets.has(k)) zsets.set(k, new Map()); return zsets.get(k); };
  return {
    async get(k) { return kv.has(k) ? kv.get(k) : null; },
    async set(k, v) { kv.set(k, v); return "OK"; },
    async incr(k) { const n = Number(kv.get(k) || 0) + 1; kv.set(k, n); return n; },
    async del(...ks) { ks.forEach(k => { kv.delete(k); hashes.delete(k); zsets.delete(k); sets.delete(k); }); return ks.length; },
    async expire() { return 1; },
    async hset(k, obj) { hashes.set(k, { ...hashes.get(k), ...obj }); return Object.keys(obj).length; },
    async hget(k, f) { const h = hashes.get(k); return h && f in h ? h[f] : null; },
    async hgetall(k) { return hashes.has(k) ? { ...hashes.get(k) } : null; },
    async zadd(k, ...entries) { entries.forEach(e => z(k).set(e.member, e.score)); return entries.length; },
    async zrem(k, m) { return z(k).delete(m) ? 1 : 0; },
    async zcard(k) { return z(k).size; },
    async zrange(k, start, stop, opts = {}) {
      const list = [...z(k).entries()].sort((a, b) => (opts.rev ? b[1] - a[1] : a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
      const end = stop < 0 ? list.length + stop + 1 : stop + 1;
      const slice = list.slice(start, end);
      return opts.withScores ? slice.flatMap(([m, s]) => [m, s]) : slice.map(([m]) => m);
    },
    async sadd(k, ...ms) { if (!sets.has(k)) sets.set(k, new Set()); ms.forEach(m => sets.get(k).add(m)); return ms.length; },
    async srem(k, m) { return sets.has(k) && sets.get(k).delete(m) ? 1 : 0; },
    async smembers(k) { return [...(sets.get(k) || [])]; },
  };
}
