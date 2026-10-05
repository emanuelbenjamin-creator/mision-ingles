import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { base64ToFloat32, bytesToBase64, downsample, floatToPcm16, rms } from "../../src/lib/live.js";
import { VOICES } from "../../src/content/voices.js";
import liveToken from "../../api/_routes/live-token.js";
import chatReview from "../../api/_routes/chat-review.js";
import { _setClient, _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";

function call(handler, body, headers = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.headers = { "x-forwarded-for": "9.9.9.9", ...headers };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}

describe("conversión de audio para Gemini Live", () => {
  it("downsample 48 kHz → 16 kHz promedia de a 3 muestras", () => {
    const out = downsample(new Float32Array([0, 0.3, 0.6, 1, 1, 1]), 48000, 16000);
    expect(Array.from(out).map(x => +x.toFixed(2))).toEqual([0.3, 1]);
    const same = new Float32Array([0.1]);
    expect(downsample(same, 16000, 16000)).toBe(same);
  });
  it("rms mide el volumen", () => {
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rms(new Float32Array([]))).toBe(0);
  });
  it("catálogo de 30 voces de Gemini sin repetir", () => {
    expect(VOICES).toHaveLength(30);
    expect(new Set(VOICES.map(v => v.id)).size).toBe(30);
  });
  it("float → PCM16 recorta a ±1", () => {
    expect(Array.from(floatToPcm16(new Float32Array([0, 1, -1, 2, -3])))).toEqual([0, 32767, -32768, 32767, -32768]);
  });
  it("PCM16 ida y vuelta por base64", () => {
    const pcm = floatToPcm16(new Float32Array([0.5, -0.5, 0]));
    const back = base64ToFloat32(bytesToBase64(new Uint8Array(pcm.buffer)));
    expect(Array.from(back).map(x => +x.toFixed(2))).toEqual([0.5, -0.5, 0]);
  });
});

describe("API live-token", () => {
  let created;
  beforeEach(() => {
    _resetRateLimit();
    created = [];
    _setClient({
      models: { list: async () => (async function* () { yield { name: "models/gemini-3.8-live" }; })() },
      authTokens: { create: async p => { created.push(p); return { name: "auth_tokens/abc" }; } },
    });
  });
  afterEach(() => { _setClient(null); delete process.env.LIVE_SESSIONS_PER_DAY; delete process.env.APP_ACCESS_CODE; });

  it("crea un token de un uso con la configuración fijada", async () => {
    const r = await call(liveToken, { scenario: "job", level: "B2", voice: "Puck" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ token: "auth_tokens/abc", model: "gemini-3.8-live", minutes: 10 });
    const cfg = created[0].config;
    expect(cfg.uses).toBe(1);
    expect(new Date(cfg.expireTime) - Date.now()).toBeGreaterThan(9 * 60 * 1000);
    expect(cfg.liveConnectConstraints.model).toBe("gemini-3.8-live");
    expect(cfg.liveConnectConstraints.config).toMatchObject({ responseModalities: ["AUDIO"], inputAudioTranscription: {}, outputAudioTranscription: {} });
    expect(cfg.liveConnectConstraints.config.systemInstruction).toContain("CEFR level is B2");
    expect(cfg.liveConnectConstraints.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Puck");
  });
  it("conversación libre con tema, corrección al momento, ritmo lento y cualquier voz de Gemini", async () => {
    await call(liveToken, { scenario: "free", topic: 'football "and" music', correction: "now", pace: "slow", voice: "Sulafat", profession: "contabilidad" });
    const cfg = created[0].config.liveConnectConstraints.config;
    expect(cfg.systemInstruction).toContain('about "football and music"');
    expect(cfg.systemInstruction).toContain("Small tip");
    expect(cfg.systemInstruction).toContain("Speak slowly");
    expect(cfg.systemInstruction).toContain("accounting");
    expect(cfg.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Sulafat");
  });
  it("profesor de speaking y voz desconocida → Kore", async () => {
    await call(liveToken, { scenario: "tutor", voice: "Hacker" });
    const cfg = created[0].config.liveConnectConstraints.config;
    expect(cfg.systemInstruction).toContain("speaking tutor");
    expect(cfg.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Kore");
  });
  it("modo examinador IELTS", async () => {
    await call(liveToken, { scenario: "ielts" });
    expect(created[0].config.liveConnectConstraints.config.systemInstruction).toContain("IELTS Speaking examiner");
  });
  it("respeta el límite diario de sesiones y el código de acceso", async () => {
    process.env.LIVE_SESSIONS_PER_DAY = "1";
    expect((await call(liveToken, { scenario: "cafe" })).status).toBe(200);
    expect((await call(liveToken, { scenario: "cafe" })).status).toBe(429);
    process.env.APP_ACCESS_CODE = "x1";
    _resetRateLimit();
    expect((await call(liveToken, { scenario: "cafe" })).status).toBe(401);
  });
  it("rechaza escenarios desconocidos", async () => {
    expect((await call(liveToken, { scenario: "nope" })).status).toBe(400);
  });
});

describe("API chat-review", () => {
  beforeEach(() => _resetRateLimit());
  afterEach(() => _setGenerator(null));
  it("revisa solo las líneas del alumno y normaliza", async () => {
    let prompt;
    _setGenerator(({ contents }) => { prompt = contents; return JSON.stringify({ summary_es: "Bien", strengths_es: ["claridad"], corrections: [{ original: "I have 30 years", corrected: "I am 30", explanation_es: "edad", rule: "Edad" }], fluency: 77, grammar: 150, vocabulary: "x" }); });
    const r = await call(chatReview, { scenario: "job", turns: [{ role: "model", text: "Tell me about you" }, { role: "user", text: "I have 30 years" }] });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ fluency: 77, grammar: 100, vocabulary: null });
    expect(r.body.corrections).toHaveLength(1);
    expect(prompt).toContain("LEARNER: I have 30 years");
    expect(prompt).toContain("PARTNER: Tell me about you");
  });
  it("sin líneas del alumno → 400", async () => {
    expect((await call(chatReview, { scenario: "job", turns: [{ role: "model", text: "hi" }] })).status).toBe(400);
  });
});
