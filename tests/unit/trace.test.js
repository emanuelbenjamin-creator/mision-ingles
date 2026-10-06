import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { _setClient, _setGenerator, generate, parseJson } from "../../api/_lib/gemini.js";
import { currentTrace, withTrace } from "../../api/_lib/trace.js";
import { endpoint, _resetRateLimit } from "../../api/_lib/http.js";
import { label, parseTrace, recordCall, recordLocal, summarize, toCSV, clearLog, getLog } from "../../src/lib/trace.js";

const wait = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  if (signal) signal.addEventListener("abort", () => { clearTimeout(t); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); });
});
const err = (status, message = "fail") => Object.assign(new Error(message), { status });
function fakeClient(plan) {
  return {
    models: {
      list: async () => (async function* () { for (const name of Object.keys(plan)) yield { name: "models/" + name }; })(),
      generateContent: async ({ model, config }) => {
        const p = plan[model];
        await wait(p.ms || 1, config.abortSignal);
        if (p.error) throw p.error;
        return { text: p.text };
      },
    },
  };
}

beforeEach(() => { _setGenerator(null); _resetRateLimit(); process.env.GEMINI_MODELS = "a-flash,b-lite,c-flash"; process.env.GEMINI_FALLBACK_MODELS = "gemma-x"; });
afterEach(() => { _setClient(null); delete process.env.GEMINI_MODELS; delete process.env.GEMINI_FALLBACK_MODELS; });

describe("registro de modelos en el servidor", () => {
  it("anota el ganador, quién perdió por lento y quién falló y por qué", async () => {
    _setClient(fakeClient({ "a-flash": { ms: 80, text: "{}" }, "b-lite": { ms: 20, text: '{"ok":1}' }, "c-flash": { ms: 5, error: err(429) }, "gemma-x": { text: "{}" } }));
    const t = await withTrace(async () => { await generate({ contents: "x", validate: parseJson }); return currentTrace(); });
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ kind: "text", model: "b-lite", tier: "principal" });
    const r = Object.fromEntries(t[0].tried.map(x => [x.m, x.r]));
    expect(r).toEqual({ "a-flash": "lost", "b-lite": "ok", "c-flash": "429" });
  });

  it("si gana el respaldo, lo marca y conserva los fallos de la carrera principal", async () => {
    _setClient(fakeClient({ "a-flash": { error: err(503) }, "b-lite": { text: "no es json" }, "c-flash": { error: err(404) }, "gemma-x": { text: '{"g":1}' } }));
    const t = await withTrace(async () => { await generate({ contents: "x", validate: parseJson }); return currentTrace(); });
    expect(t[0]).toMatchObject({ model: "gemma-x", tier: "respaldo" });
    const r = Object.fromEntries(t[0].tried.map(x => [x.m, x.r]));
    expect(r).toEqual({ "a-flash": "503", "b-lite": "invalid", "c-flash": "404", "gemma-x": "ok" });
  });

  it("endpoint() envía X-AI-Model y X-AI-Trace, también cuando todo falla", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const call = (handler, plan) => {
      _setClient(fakeClient(plan));
      const req = Readable.from([Buffer.from("{}")]);
      req.method = "POST"; req.headers = {}; req.url = "/api/chat-turn";
      const headers = {};
      return new Promise(resolve => handler(req, { statusCode: 200, setHeader(k, v) { headers[k] = v; }, end(b) { resolve({ status: this.statusCode, headers, body: JSON.parse(b) }); } }));
    };
    const h = endpoint(async () => generate({ contents: "x", validate: parseJson }));
    const ok = await call(h, { "a-flash": { ms: 5, text: '{"a":1}' }, "b-lite": { ms: 50, text: "{}" }, "c-flash": { ms: 50, text: "{}" }, "gemma-x": { text: "{}" } });
    expect(ok.headers["X-AI-Model"]).toBe("a-flash");
    expect(parseTrace(ok.headers["X-AI-Trace"])[0]).toMatchObject({ kind: "text", model: "a-flash" });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("[ai] chat-turn 200 text=a-flash"));
    const bad = await call(h, { "a-flash": { error: err(429) }, "b-lite": { error: err(429) }, "c-flash": { error: err(429) }, "gemma-x": { error: err(429) } });
    expect(bad.status).toBe(429);
    expect(bad.headers["X-AI-Model"]).toBe("ninguno");
    expect(parseTrace(bad.headers["X-AI-Trace"])[0].tried.every(x => x.r === "429")).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("registro de modelos en el navegador", () => {
  beforeEach(() => clearLog());
  const header = calls => encodeURIComponent(JSON.stringify(calls));

  it("guarda cada respuesta y la resume por modelo", () => {
    const ev = recordCall({ route: "chat-turn", status: 200, ms: 900, header: header([{ k: "text", m: "groq:llama", ms: 820, tier: "principal", t: [{ m: "groq:llama", r: "ok", ms: 820 }, { m: "gemini-2.5-flash", r: "lost", ms: 820 }, { m: "gemini-3-flash-preview", r: "429", ms: 40 }] }]) });
    expect(label(ev)).toBe("groq:llama · 820 ms");
    recordCall({ route: "speak-evaluate", status: 200, ms: 2100, header: header([{ k: "text", m: "gemini-2.5-flash", ms: 2000, t: [{ m: "gemini-2.5-flash", r: "ok", ms: 2000 }, { m: "groq:llama", r: "invalid", ms: 300 }] }]) });
    recordLocal({ route: "tts", kind: "tts", model: "kokoro-82M · af_heart", ms: 700 });
    expect(recordCall({ route: "health", status: 200, ms: 5, header: null })).toBeNull();
    expect(getLog()).toHaveLength(3);
    const rows = summarize();
    const by = Object.fromEntries(rows.map(r => [r.model, r]));
    expect(by["groq:llama"]).toMatchObject({ tries: 2, wins: 1, failed: 1, fails: { invalid: 1 }, avgMs: 820, routes: { "chat-turn": 1 } });
    expect(by["gemini-2.5-flash"]).toMatchObject({ tries: 2, wins: 1, lost: 1, avgMs: 2000 });
    expect(by["gemini-3-flash-preview"]).toMatchObject({ wins: 0, fails: { 429: 1 } });
    expect(by["kokoro-82M · af_heart"]).toMatchObject({ kind: "tts", wins: 1 });
    const csv = toCSV().split("\n");
    expect(csv[0]).toMatch(/^fecha,ruta,estado/);
    expect(csv).toHaveLength(1 + 3 + 2 + 1);
    expect(csv.some(l => l.includes("chat-turn") && l.includes("gemini-3-flash-preview,429"))).toBe(true);
  });

  it("tolera un encabezado dañado", () => {
    expect(parseTrace("%E0%A4%A")).toEqual([]);
  });
});
