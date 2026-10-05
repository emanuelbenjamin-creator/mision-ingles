import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import speakEvaluate from "../../api/_routes/speak-evaluate.js";
import chatTurn from "../../api/_routes/chat-turn.js";
import chatSuggest from "../../api/_routes/chat-suggest.js";
import grammarExplain from "../../api/_routes/grammar-explain.js";
import grammarAsk from "../../api/_routes/grammar-ask.js";
import health from "../../api/_routes/health.js";
import { _setGenerator, parseJson } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";
import { chatContents } from "../../api/_lib/prompts.js";
import { SCENARIOS } from "../../src/content/scenarios.js";

function call(handler, body, { method = "POST", headers = {}, ip = "1.1.1.1" } = {}) {
  const raw = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.headers = { "x-forwarded-for": ip, ...headers };
  return new Promise(resolve => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}

const SPEECH = "I have 30 years and I work in a bank in Lima. The people is very friendly and I like my job because I help clients every day.";
let lastCall;

beforeEach(() => {
  _resetRateLimit();
  delete process.env.APP_ACCESS_CODE;
  delete process.env.DAILY_LIMIT_PER_IP;
  _setGenerator(args => { lastCall = args; return JSON.stringify({ scores: { fluency: 70, grammar: 140, vocabulary: "60", coherence: 65 }, cefr_estimate: "B1", corrections: [{ original: "I have 30 years", corrected: "I am 30 years old", explanation_es: "Edad con to be", rule: "Edad" }, { original: "", corrected: "x" }], better_version: "I'm 30 years old and I work at a bank in Lima.", vocabulary_upgrades: [{ basic: "like", advanced: "enjoy", example: "I enjoy my job." }], tip_es: "Usa conectores." }); });
});
afterEach(() => _setGenerator(null));

describe("API /speak-evaluate", () => {
  it("normaliza la respuesta del modelo", async () => {
    const r = await call(speakEvaluate, { text: SPEECH, topic: "Your job", level: "B1", goal: "trabajo", seconds: 45 });
    expect(r.status).toBe(200);
    expect(r.body.scores).toEqual({ fluency: 70, grammar: 100, vocabulary: 60, coherence: 65 });
    expect(r.body.corrections).toHaveLength(1);
    expect(r.body.cefr_estimate).toBe("B1");
    expect(lastCall.contents).toContain("about 45 seconds");
    expect(lastCall.json).toBe(true);
  });
  it("rechaza textos muy cortos", async () => {
    const r = await call(speakEvaluate, { text: "hello there" });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("too_short");
  });
  it("rechaza JSON inválido y métodos distintos de POST", async () => {
    expect((await call(speakEvaluate, "{bad")).status).toBe(400);
    expect((await call(speakEvaluate, undefined, { method: "GET" })).status).toBe(405);
  });
  it("devuelve 502 si el modelo no entrega JSON", async () => {
    _setGenerator(() => "lo siento, no puedo");
    const r = await call(speakEvaluate, { text: SPEECH });
    expect(r.status).toBe(502);
    expect(r.body.code).toBe("invalid_json");
  });
});

describe("código de acceso y límite diario", () => {
  it("exige el código cuando está configurado", async () => {
    process.env.APP_ACCESS_CODE = "secreto";
    expect((await call(speakEvaluate, { text: SPEECH })).status).toBe(401);
    expect((await call(speakEvaluate, { text: SPEECH }, { headers: { "x-access-code": "otro123" } })).status).toBe(401);
    expect((await call(speakEvaluate, { text: SPEECH }, { headers: { "x-access-code": "secreto" } })).status).toBe(200);
    const h = await call(health, undefined, { method: "GET" });
    expect(h.body).toMatchObject({ ok: true, ai: true, accessCodeRequired: true });
  });
  it("corta al pasar el límite por IP", async () => {
    process.env.DAILY_LIMIT_PER_IP = "2";
    expect((await call(grammarAsk, { question: "make vs do?" })).status).toBe(200);
    expect((await call(grammarAsk, { question: "make vs do?" })).status).toBe(200);
    expect((await call(grammarAsk, { question: "make vs do?" })).status).toBe(429);
    expect((await call(grammarAsk, { question: "make vs do?" }, { ip: "2.2.2.2" })).status).toBe(200);
  });
});

describe("API de conversación y gramática", () => {
  it("chat-turn usa el escenario del servidor y devuelve corrección", async () => {
    _setGenerator(args => { lastCall = args; return '```json\n{"reply":"Nice to meet you! Why do you want this job?","correction":{"corrected":"I am 30 years old.","explanation_es":"Edad con to be","rule":"Edad"}}\n```'; });
    const turns = [{ role: "assistant", content: SCENARIOS[0].open }, { role: "user", content: "I have 30 years" }];
    const r = await call(chatTurn, { scenario: "job", level: "B1", turns });
    expect(r.status).toBe(200);
    expect(r.body.reply).toMatch(/Why do you want/);
    expect(r.body.correction.corrected).toBe("I am 30 years old.");
    expect(lastCall.system).toContain(SCENARIOS[0].role);
    expect(lastCall.contents[0].role).toBe("user");
    expect(lastCall.contents.at(-1)).toEqual({ role: "user", text: "I have 30 years" });
  });
  it("chat-turn sin corrección y escenario inválido", async () => {
    _setGenerator(() => '{"reply":"Great!","correction":null}');
    const ok = await call(chatTurn, { scenario: "cafe", turns: [{ role: "user", content: "A latte, please" }] });
    expect(ok.body).toEqual({ reply: "Great!", correction: null });
    expect((await call(chatTurn, { scenario: "hack", turns: [{ role: "user", content: "hi" }] })).status).toBe(400);
  });
  it("chatContents exige terminar con el mensaje del alumno", () => {
    expect(() => chatContents(SCENARIOS[0], [{ role: "assistant", content: "hi" }])).toThrow();
  });
  it("chat-suggest acepta arreglo u objeto", async () => {
    _setGenerator(() => '["Sure!","Maybe later.","I would love to.","extra"]');
    const r = await call(chatSuggest, { scenario: "small", last: "How was your weekend?" });
    expect(r.body.suggestions).toEqual(["Sure!", "Maybe later.", "I would love to."]);
  });
  it("grammar-explain valida el ejercicio", async () => {
    _setGenerator(args => { lastCall = args; return "Porque «every day» indica rutina."; });
    const good = await call(grammarExplain, { stem: "She ___ to work every day.", options: ["goes", "is going"], correct: "goes", picked: "is going" });
    expect(good.body.text).toMatch(/rutina/);
    expect(lastCall.json).toBe(false);
    expect((await call(grammarExplain, { stem: "x", options: ["a", "b"], correct: "c", picked: "a" })).status).toBe(400);
  });
});

describe("parseJson", () => {
  it("lee JSON envuelto en texto o bloques", () => {
    expect(parseJson('Aquí va: {"a":1} listo')).toEqual({ a: 1 });
    expect(parseJson("```json\n[1,2]\n```")).toEqual([1, 2]);
  });
});
