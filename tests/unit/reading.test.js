import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import reading from "../../api/reading.js";
import word from "../../api/word.js";
import dictation from "../../api/dictation.js";
import { _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";
import { addCard } from "../../src/lib/game.js";
import { defaultState } from "../../src/lib/state.js";

function call(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "4.4.4.4" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}
const TEXT = Array.from({ length: 60 }, (_, i) => "word" + i).join(" ") + "\n\nSecond paragraph here.";

beforeEach(() => _resetRateLimit());
afterEach(() => _setGenerator(null));

describe("lectura graduada", () => {
  it("normaliza historia, glosario y preguntas, y usa la profesión", async () => {
    let prompt;
    _setGenerator(({ contents }) => { prompt = contents; return JSON.stringify({ title: "T", text: TEXT, glossary: [{ word: "audit", es: "auditoría" }, { word: "", es: "x" }], questions: [{ q: "Q1", o: ["a", "b", "c"], a: 2 }, { q: "Q2", o: ["a", "b"], a: 9 }, { q: "Q3", o: ["a", "b", "c"], a: 0 }] }); });
    const r = await call(reading, { level: "B1", profession: "contabilidad" });
    expect(r.status).toBe(200);
    expect(r.body.glossary).toEqual([["audit", "auditoría"]]);
    expect(r.body.questions.map(q => q.a)).toEqual([2, 0, 0]);
    expect(r.body.text).toContain("\n\n");
    expect(prompt).toContain("accounting, auditing and taxes");
    expect(prompt).toContain("CEFR B1");
  });
  it("una historia demasiado corta cuenta como respuesta inválida", async () => {
    _setGenerator(() => JSON.stringify({ title: "T", text: "too short", questions: [] }));
    expect((await call(reading, { level: "A1" })).status).toBe(502);
  });
});

describe("palabra tocada y dictado", () => {
  it("traduce una palabra en contexto y valida la entrada", async () => {
    _setGenerator(() => '{"es":"plazo","ipa":"/ˈded.laɪn/","example":"The deadline is Friday."}');
    expect((await call(word, { word: "deadline", sentence: "The deadline was Friday." })).body).toEqual({ es: "plazo", ipa: "/ˈded.laɪn/", example: "The deadline is Friday." });
    expect((await call(word, { word: "<script>" })).status).toBe(400);
  });
  it("dictado: hasta 5 frases útiles", async () => {
    _setGenerator(() => JSON.stringify({ sentences: ["One two three four.", "x", "I like my new job a lot.", "a", "b", "We met at the bank today.", "c", "She works from home on Fridays.", "Can you call me back later?", "Extra sentence number six here."] }));
    const r = await call(dictation, { level: "A2" });
    expect(r.body.sentences).toHaveLength(5);
    expect(r.body.sentences.every(x => x.split(" ").length >= 3)).toBe(true);
  });
  it("addCard no duplica tarjetas", () => {
    const s = defaultState(), n = s.cards.length;
    expect(addCard(s, { front: "deadline", back: "plazo" })).toBe(true);
    expect(addCard(s, { front: "Deadline", back: "plazo" })).toBe(false);
    expect(s.cards).toHaveLength(n + 1);
    expect(s.cards.at(-1).tag).toBe("lectura");
  });
});
