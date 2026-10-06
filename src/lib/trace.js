/*
 * Modo diagnóstico: qué modelo respondió cada llamada y cada audio.
 * El servidor manda X-AI-Trace (JSON con el ganador y todos los intentos de la carrera); aquí se
 * guarda un registro local (últimos 500 eventos) para ver, resumir y exportar en CSV/JSON.
 */

const KEY = "mi-model-log";
const MAX = 500;
let log = load();
let diag = false;
const listeners = new Set();

function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* sin almacenamiento */ } }
function emit() { listeners.forEach(f => f()); }

export const getLog = () => log;
export const getDiag = () => diag;
export function setDiag(v) { if (diag !== !!v) { diag = !!v; emit(); } }
export function subscribeTrace(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function clearLog() { log = []; save(); emit(); }

/** Lee X-AI-Trace (codificado) → [{ kind, model, ms, tier?, tried: [{ m, r, ms }] }]. */
export function parseTrace(header) {
  if (!header) return [];
  try {
    const arr = JSON.parse(decodeURIComponent(header));
    return (Array.isArray(arr) ? arr : []).map(x => ({ kind: x.k || "text", model: x.m || null, ms: Number(x.ms) || 0, ...(x.tier ? { tier: x.tier } : {}), tried: Array.isArray(x.t) ? x.t : [] }));
  } catch { return []; }
}

function push(ev) {
  log = [...log, ev].slice(-MAX);
  save();
  emit();
  return ev;
}

/** Una respuesta de /api/<route>. Devuelve el evento (se adjunta a la respuesta como _ai). */
export function recordCall({ route, status, ms, header, cached = false }) {
  const calls = parseTrace(header);
  if (!calls.length) return null;
  return push({ at: Date.now(), route, status, ms: Math.round(ms || 0), cached, calls });
}

/** Algo que se resolvió en el navegador: voz Kokoro o del navegador, audio desde la caché, Web Speech. */
export function recordLocal({ route, kind, model, ms = 0, cached = false }) {
  return push({ at: Date.now(), route, status: 200, ms: Math.round(ms), cached, local: true, calls: [{ kind, model, ms: Math.round(ms), tried: [] }] });
}

/** Texto corto para una etiqueta: «groq:llama-3.3-70b-versatile · 820 ms». */
export function label(ev) {
  if (!ev || !ev.calls || !ev.calls.length) return "";
  const main = ev.calls[ev.calls.length - 1];
  const m = ev.calls.map(c => c.model || "falló").join(" + ");
  const ms = ev.cached ? "caché" : `${(main.ms || ev.ms) >= 1000 ? ((main.ms || ev.ms) / 1000).toFixed(1) + " s" : (main.ms || ev.ms) + " ms"}`;
  return `${m} · ${ms}${main.tier === "respaldo" ? " · respaldo" : ""}`;
}

/** Detalle de la carrera: «gemini-2.5-flash ✓ 820 ms · groq:llama 429 · …». */
export function detail(ev) {
  if (!ev) return "";
  return ev.calls.map(c => `${c.kind}: ${c.tried.length ? c.tried.map(t => `${t.m} ${t.r === "ok" ? "✓" : t.r}${t.ms ? " " + t.ms + "ms" : ""}`).join(" · ") : (c.model || "falló")}`).join("\n");
}

const avg = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);

/**
 * Resumen por modelo: veces que participó, ganó, perdió por lento, falló (por motivo),
 * tiempo medio al ganar y en qué rutas ganó. Ordenado por victorias.
 */
export function summarize(events = log) {
  const by = new Map();
  const get = (model, kind) => {
    const k = kind + "|" + model;
    if (!by.has(k)) by.set(k, { model, kind, tries: 0, wins: 0, lost: 0, fails: {}, winMs: [], routes: {} });
    return by.get(k);
  };
  for (const ev of events) {
    for (const c of ev.calls || []) {
      if (c.tried && c.tried.length) {
        for (const t of c.tried) {
          const row = get(t.m, c.kind);
          row.tries++;
          if (t.r === "ok") { row.wins++; row.winMs.push(t.ms || 0); row.routes[ev.route] = (row.routes[ev.route] || 0) + 1; }
          else if (t.r === "lost") row.lost++;
          else row.fails[t.r] = (row.fails[t.r] || 0) + 1;
        }
      } else if (c.model) {
        const row = get(c.model, c.kind);
        row.tries++; row.wins++;
        if (!ev.cached) row.winMs.push(c.ms || 0);
        row.routes[ev.route] = (row.routes[ev.route] || 0) + 1;
      }
    }
  }
  return [...by.values()].map(r => ({
    model: r.model, kind: r.kind, tries: r.tries, wins: r.wins, lost: r.lost,
    failed: Object.values(r.fails).reduce((a, b) => a + b, 0), fails: r.fails,
    winRate: r.tries ? Math.round(r.wins / r.tries * 100) : 0, avgMs: avg(r.winMs), routes: r.routes,
  })).sort((a, b) => b.wins - a.wins || b.tries - a.tries);
}

const csvCell = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Una fila por intento de modelo, para abrir en Excel o Google Sheets. */
export function toCSV(events = log) {
  const rows = [["fecha", "ruta", "estado", "ms_total", "cache", "tipo", "modelo_ganador", "nivel", "modelo_intentado", "resultado", "ms_modelo"]];
  for (const ev of events) {
    const at = new Date(ev.at).toISOString();
    for (const c of ev.calls || []) {
      const tried = c.tried && c.tried.length ? c.tried : [{ m: c.model || "", r: c.model ? "ok" : "falló", ms: c.ms }];
      for (const t of tried) rows.push([at, ev.route, ev.status, ev.ms, ev.cached ? "sí" : "", c.kind, c.model || "", c.tier || "", t.m, t.r, t.ms || ""]);
    }
  }
  return rows.map(r => r.map(csvCell).join(",")).join("\n");
}
