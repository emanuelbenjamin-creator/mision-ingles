import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _setClient, _setGenerator, generate, hasAI, parseJson } from "../../api/_lib/gemini.js";
import { _setFetch, externalModels, groqTranscribe } from "../../api/_lib/providers.js";

const wait = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  if (signal) signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("aborted")); });
});

/** fetch falso: /models lista modelos por proveedor; /chat/completions responde según plan. */
function fakeFetch(plan, models) {
  const calls = [];
  const f = async (url, opts = {}) => {
    const host = new URL(url).host;
    if (url.endsWith("/models")) return { ok: true, json: async () => ({ data: (models[host] || []).map(id => ({ id })) }) };
    if (url.endsWith("/audio/transcriptions")) { calls.push({ url, opts }); return { ok: true, json: async () => ({ text: " I think so " }) }; }
    const body = JSON.parse(opts.body);
    calls.push({ host, body, headers: opts.headers });
    const p = plan[`${host}|${body.model}`] || { status: 404 };
    await wait(p.ms || 1, opts.signal);
    if (p.status) return { ok: false, status: p.status, text: async () => "err" };
    return { ok: true, json: async () => ({ choices: [{ message: { content: p.text } }] }) };
  };
  f.calls = calls;
  return f;
}
const G = "api.groq.com", C = "api.cerebras.ai", M = "api.mistral.ai", O = "openrouter.ai";

beforeEach(() => {
  _setGenerator(null); _setClient(null);
  for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) delete process.env[k];
  Object.assign(process.env, { GROQ_MODELS: "g-big,g-small", CEREBRAS_MODELS: "c-fast", MISTRAL_MODELS: "m-small", OPENROUTER_MODELS: "o-free:free" });
});
afterEach(() => { _setFetch(null); for (const k of ["GROQ_MODELS", "CEREBRAS_MODELS", "MISTRAL_MODELS", "OPENROUTER_MODELS", "GROQ_API_KEY", "CEREBRAS_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) delete process.env[k]; });

describe("proveedores fuera de Gemini", () => {
  it("sin ninguna clave no hay IA; con Groq sí", () => {
    expect(hasAI()).toBe(false);
    process.env.GROQ_API_KEY = "k";
    expect(hasAI()).toBe(true);
  });
  it("Groq y Cerebras compiten; gana el primero válido y se manda system + modo JSON", async () => {
    Object.assign(process.env, { GROQ_API_KEY: "kg", CEREBRAS_API_KEY: "kc" });
    const f = fakeFetch({ [`${G}|g-big`]: { ms: 40, text: '{"w":"groq"}' }, [`${G}|g-small`]: { ms: 30, text: "no json" }, [`${C}|c-fast`]: { ms: 5, text: '{"w":"cerebras"}' } }, { [G]: ["g-big", "g-small"], [C]: ["c-fast"] });
    _setFetch(f);
    expect(await generate({ system: "SYS", contents: "hola json", validate: parseJson })).toEqual({ w: "cerebras" });
    const call = f.calls.find(x => x.host === C);
    expect(call.body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(call.body.response_format).toEqual({ type: "json_object" });
    expect(call.headers.Authorization).toBe("Bearer kc");
  });
  it("descarta modelos que no existen para la clave", async () => {
    process.env.GROQ_API_KEY = "kg";
    _setFetch(fakeFetch({}, { [G]: ["g-small"] }));
    expect(await externalModels("primary")).toEqual(["groq:g-small"]);
  });
  it("si fallan los principales usa Mistral y OpenRouter de respaldo", async () => {
    Object.assign(process.env, { GROQ_API_KEY: "kg", MISTRAL_API_KEY: "km", OPENROUTER_API_KEY: "ko" });
    const f = fakeFetch({ [`${G}|g-big`]: { status: 429 }, [`${G}|g-small`]: { status: 503 }, [`${M}|m-small`]: { ms: 20, text: '{"w":"mistral"}' }, [`${O}|o-free:free`]: { ms: 50, text: '{"w":"or"}' } },
      { [G]: ["g-big", "g-small"], [M]: ["m-small"], [O]: ["o-free:free"] });
    _setFetch(f);
    expect(await generate({ contents: "x json", validate: parseJson })).toEqual({ w: "mistral" });
    const or = f.calls.find(x => x.host === O);
    expect(or.body.response_format).toBeUndefined(); // OpenRouter sin modo JSON forzado
  });
  it("las consultas con audio no van a proveedores de solo texto", async () => {
    process.env.GROQ_API_KEY = "kg";
    const f = fakeFetch({ [`${G}|g-big`]: { text: "{}" } }, { [G]: ["g-big"] });
    _setFetch(f);
    await expect(generate({ contents: [{ role: "user", text: "t", audio: { mimeType: "audio/wav", data: "AAA" } }], hasAudio: true })).rejects.toMatchObject({ status: 502 });
    expect(f.calls.length).toBe(0);
  });
  it("Groq Whisper transcribe audio en base64", async () => {
    expect(await groqTranscribe({ audio: "AAAA" })).toBe(null); // sin clave
    process.env.GROQ_API_KEY = "kg";
    const f = fakeFetch({}, {});
    _setFetch(f);
    expect(await groqTranscribe({ audio: Buffer.from("RIFF....").toString("base64") })).toBe("I think so");
    const form = f.calls[0].opts.body;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("language")).toBe("en");
  });
});
