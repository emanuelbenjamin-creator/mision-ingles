import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { LIVE_TOOLS, cardKey, normalizeCard, splitCards, toolResponses } from "../../src/lib/cards.js";
import liveToken from "../../api/_routes/live-token.js";
import voiceTurn from "../../api/_routes/voice-turn.js";
import { _setClient, _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";

function call(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "6.6.6.6" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}

describe("tarjetas en vivo", () => {
  it("normaliza cada tipo y descarta lo incompleto", () => {
    expect(normalizeCard("show_correction", { original: "I have 30 years", corrected: "I am 30 years old", explanation_es: "Edad con «to be»." }))
      .toEqual({ type: "correction", original: "I have 30 years", corrected: "I am 30 years old", explanation_es: "Edad con «to be»." });
    expect(normalizeCard("show_word", { word: "deadline", meaning_es: "fecha límite" })).toMatchObject({ type: "word", example: "" });
    expect(normalizeCard("give_challenge", { challenge_es: "Usa «although»", target: "although" })).toMatchObject({ type: "challenge", target: "although" });
    expect(normalizeCard("show_correction", { original: "Same", corrected: "same" })).toBeNull();
    expect(normalizeCard("show_word", { word: "x" })).toBeNull();
    expect(normalizeCard("delete_everything", { a: 1 })).toBeNull();
    expect(normalizeCard("show_word", null)).toBeNull();
    expect(normalizeCard("show_word", { word: "a".repeat(500), meaning_es: "b" }).word).toHaveLength(60);
  });
  it("la clave evita tarjetas repetidas", () => {
    const a = normalizeCard("word", { word: "Deadline", meaning_es: "x" }), b = normalizeCard("word", { word: "deadline", meaning_es: "y" });
    expect(cardKey(a)).toBe(cardKey(b));
  });
  it("responde a cada función que llamó Gemini Live", () => {
    expect(toolResponses([{ id: "1", name: "show_word", args: {} }, { id: "2", name: "give_challenge" }]))
      .toEqual([{ id: "1", name: "show_word", response: { result: "shown" } }, { id: "2", name: "give_challenge", response: { result: "shown" } }]);
    expect(toolResponses(undefined)).toEqual([]);
  });
  it("separa la respuesta hablada del bloque CARDS", () => {
    const r = splitCards('Nice! What did you do next?\nCARDS: [{"type":"correction","original":"I goed","corrected":"I went","explanation_es":"Pasado irregular."},{"type":"nope"}]');
    expect(r.reply).toBe("Nice! What did you do next?");
    expect(r.cards).toEqual([{ type: "correction", original: "I goed", corrected: "I went", explanation_es: "Pasado irregular." }]);
    expect(splitCards("Just a reply.")).toEqual({ reply: "Just a reply.", cards: [] });
    expect(splitCards("Hello there.\nCARDS: [not json").cards).toEqual([]);
    expect(splitCards("Hello there.\nCARDS: [not json").reply).toBe("Hello there.");
  });
});

describe("tarjetas en las rutas de voz", () => {
  let created;
  beforeEach(() => {
    _resetRateLimit();
    created = [];
    _setClient({
      models: { list: async () => (async function* () { yield { name: "models/gemini-3.8-live" }; })() },
      authTokens: { create: async p => { created.push(p); return { name: "auth_tokens/abc" }; } },
    });
  });
  afterEach(() => { _setClient(null); _setGenerator(null); delete process.env.LIVE_CARDS; });

  it("live-token declara las tres funciones y explica cuándo usarlas", async () => {
    const r = await call(liveToken, { scenario: "free", level: "B1" });
    const cfg = created[0].config.liveConnectConstraints.config;
    expect(r.body.cards).toBe(true);
    expect(cfg.tools[0].functionDeclarations.map(f => f.name)).toEqual(LIVE_TOOLS.map(f => f.name));
    expect(cfg.systemInstruction).toContain("SCREEN CARDS");
  });
  it("sin tarjetas en IELTS, si la app las apaga o con LIVE_CARDS=0", async () => {
    await call(liveToken, { scenario: "ielts" });
    await call(liveToken, { scenario: "free", cards: false });
    process.env.LIVE_CARDS = "0";
    await call(liveToken, { scenario: "free" });
    for (const c of created) {
      expect(c.config.liveConnectConstraints.config.tools).toBeUndefined();
      expect(c.config.liveConnectConstraints.config.systemInstruction).not.toContain("SCREEN CARDS");
    }
  });
  it("voice-turn devuelve la respuesta limpia y sus tarjetas", async () => {
    let seen;
    _setGenerator(async x => { seen = x; return '**Good!** Tell me more.\nCARDS: [{"type":"word","word":"commute","meaning_es":"trayecto al trabajo","example":"My commute is long."}]'; });
    const r = await call(voiceTurn, { scenario: "free", level: "B1", turns: [{ role: "model", text: "Hi!" }, { role: "user", text: "I go to work in bus" }] });
    expect(r.body.reply).toBe("Good! Tell me more.");
    expect(r.body.cards).toEqual([{ type: "word", word: "commute", meaning_es: "trayecto al trabajo", example: "My commute is long." }]);
    expect(seen.system).toContain("CARDS:");
  });
  it("voice-turn no pide tarjetas en el saludo ni cuando se apagan", async () => {
    let seen;
    _setGenerator(async x => { seen = x; return "Hi! How are you?\nCARDS: [{\"type\":\"challenge\",\"challenge_es\":\"x\"}]"; });
    const first = await call(voiceTurn, { scenario: "free" });
    expect(seen.system).not.toContain("CARDS:");
    expect(first.body).toEqual({ reply: "Hi! How are you?", cards: [] });
    await call(voiceTurn, { scenario: "free", cards: false, turns: [{ role: "user", text: "Hello" }] });
    expect(seen.system).not.toContain("CARDS:");
  });
});
