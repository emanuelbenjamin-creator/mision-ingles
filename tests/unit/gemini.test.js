import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _setClient, _setGenerator, generate, parseJson, race, synthesize } from "../../api/_lib/gemini.js";
import { pcmToWav } from "../../api/_lib/audio.js";

const wait = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  if (signal) signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("aborted")); });
});
const err = (status, message = "fail") => Object.assign(new Error(message), { status });

/** Cliente falso: cada modelo responde según `plan[model]` = { ms, text } | { ms, error }. */
function fakeClient(plan, existing) {
  const calls = [];
  return {
    calls,
    models: {
      list: async () => (async function* () { for (const name of existing || Object.keys(plan)) yield { name: "models/" + name }; })(),
      generateContent: async ({ model, config, contents }) => {
        calls.push({ model, config, contents });
        const p = plan[model];
        await wait(p.ms || 1, config.abortSignal);
        if (p.error) throw p.error;
        if (p.audio) return { candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: p.audio } }] } }] };
        return { text: p.text };
      },
    },
  };
}

const MODELS = "a-flash,b-lite,c-flash";
beforeEach(() => { _setGenerator(null); process.env.GEMINI_MODELS = MODELS; process.env.GEMINI_FALLBACK_MODELS = "gemma-x"; });
afterEach(() => { _setClient(null); delete process.env.GEMINI_MODELS; delete process.env.GEMINI_FALLBACK_MODELS; delete process.env.GEMINI_TTS_MODELS; });

describe("carrera de modelos gratuitos", () => {
  it("gana el más rápido y cancela a los demás", async () => {
    const c = fakeClient({ "a-flash": { ms: 80, text: '{"m":"a"}' }, "b-lite": { ms: 5, text: '{"m":"b"}' }, "c-flash": { ms: 60, text: '{"m":"c"}' }, "gemma-x": { text: "{}" } });
    _setClient(c);
    expect(await generate({ system: "s", contents: "hola", validate: parseJson })).toEqual({ m: "b" });
    expect(c.calls.map(x => x.model).sort()).toEqual(["a-flash", "b-lite", "c-flash"]);
    expect(c.calls.filter(x => x.model !== "b-lite").every(x => x.config.abortSignal.aborted)).toBe(true);
    expect(c.calls[0].config).toMatchObject({ systemInstruction: "s", responseMimeType: "application/json" });
  });
  it("ignora un JSON roto aunque llegue primero", async () => {
    _setClient(fakeClient({ "a-flash": { ms: 2, text: "lo siento" }, "b-lite": { ms: 20, text: '{"ok":1}' }, "c-flash": { ms: 30, error: err(503) }, "gemma-x": { text: "{}" } }));
    expect(await generate({ contents: "x", validate: parseJson })).toEqual({ ok: 1 });
  });
  it("si todos fallan usa Gemma, con la instrucción dentro del mensaje", async () => {
    const c = fakeClient({ "a-flash": { error: err(503) }, "b-lite": { error: err(500) }, "c-flash": { error: err(503) }, "gemma-x": { text: '{"g":1}' } });
    _setClient(c);
    expect(await generate({ system: "SYS", contents: "hola", validate: parseJson })).toEqual({ g: 1 });
    const g = c.calls.find(x => x.model === "gemma-x");
    expect(g.config.systemInstruction).toBeUndefined();
    expect(g.config.responseMimeType).toBeUndefined();
    expect(g.contents[0].parts[0].text).toBe("SYS\n\nhola");
  });
  it("sin cuota en todos → 429 con mensaje de cuota; y los modelos quedan enfriando", async () => {
    const c = fakeClient({ "a-flash": { error: err(429) }, "b-lite": { error: err(429) }, "c-flash": { error: err(429) }, "gemma-x": { error: err(429) } });
    _setClient(c);
    await expect(generate({ contents: "x" })).rejects.toMatchObject({ status: 429, code: "quota" });
    const before = c.calls.length;
    await expect(generate({ contents: "x" })).rejects.toMatchObject({ status: 502 });
    expect(c.calls.length).toBe(before); // nadie fue llamado: todos enfriando
  });
  it("descarta modelos que no existen para la clave", async () => {
    const c = fakeClient({ "a-flash": { text: "A" }, "b-lite": { text: "B" }, "c-flash": { text: "C" }, "gemma-x": { text: "G" } }, ["c-flash", "gemma-x"]);
    _setClient(c);
    expect(await generate({ contents: "x", json: false })).toBe("C");
    expect(c.calls.map(x => x.model)).toEqual(["c-flash"]);
  });
  it("con audio no recurre a Gemma", async () => {
    const c = fakeClient({ "a-flash": { error: err(503) }, "b-lite": { error: err(503) }, "c-flash": { error: err(503) }, "gemma-x": { text: "{}" } });
    _setClient(c);
    await expect(generate({ contents: [{ role: "user", text: "t", audio: { mimeType: "audio/webm", data: "AAA" } }], hasAudio: true })).rejects.toMatchObject({ status: 502 });
    expect(c.calls.some(x => x.model === "gemma-x")).toBe(false);
    expect(c.calls[0].contents[0].parts[1]).toEqual({ inlineData: { mimeType: "audio/webm", data: "AAA" } });
  });
  it("race respeta el tiempo límite", async () => {
    await expect(race(["m"], (_m, s) => wait(200, s), x => x, 20)).rejects.toEqual(expect.arrayContaining([["timeout", expect.any(Error)]]));
  });
});

describe("voz natural (TTS)", () => {
  it("devuelve el primer audio y su frecuencia", async () => {
    process.env.GEMINI_TTS_MODELS = "t1,t2";
    _setClient(fakeClient({ t1: { ms: 30, audio: "QUFB" }, t2: { ms: 5, error: err(429) } }));
    expect(await synthesize({ text: "Hello" })).toEqual({ data: "QUFB", rate: 24000 });
  });
  it("pcmToWav arma una cabecera RIFF válida", () => {
    const wav = pcmToWav(Buffer.alloc(4800), 24000);
    expect(wav.length).toBe(44 + 4800);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(40)).toBe(4800);
  });
});
