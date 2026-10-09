import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import dialogue from "../../api/_routes/dialogue.js";
import { dialogueScript } from "../../api/_routes/tts.js";
import { _setClient, _setGenerator, synthesize } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";
import { DIALOGUES, PAIRS } from "../../src/content/dialogues.js";
import { CHARACTERS } from "../../src/content/characters.js";
import { lineAt } from "../../src/views/Dialogos.jsx";

function call(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "5.5.5.5" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}
const LINES = Array.from({ length: 8 }, (_, i) => ({ s: i % 2, text: `This is line number ${i} of the talk.` }));
const QS = [{ q: "Q1", o: ["a", "b", "c"], a: 1 }, { q: "Q2", o: ["a", "b", "c"], a: 7 }, { q: "Q3", o: ["a", "b", "c"], a: 2 }];

beforeEach(() => _resetRateLimit());
afterEach(() => { _setGenerator(null); _setClient(null); delete process.env.GEMINI_TTS_MODELS; });

describe("diálogo generado", () => {
  it("normaliza líneas y preguntas, y el servidor elige la pareja", async () => {
    let prompt;
    _setGenerator(({ contents }) => { prompt = contents; return JSON.stringify({ title: "T", setting_es: "Una situación.", lines: LINES, questions: QS }); });
    const r = await call(dialogue, { level: "B2", profession: "ventas", seed: "abc" });
    expect(r.status).toBe(200);
    expect(r.body.lines).toHaveLength(8);
    expect(r.body.lines[1]).toEqual([1, "This is line number 1 of the talk."]);
    expect(r.body.questions.map(q => q.a)).toEqual([1, 0, 2]);
    expect(PAIRS).toContainEqual(r.body.speakers);
    expect(prompt).toContain("CEFR B2");
    expect(prompt).toContain(CHARACTERS[r.body.speakers[0]].name);
  });
  it("un diálogo con una sola voz o muy corto es inválido", async () => {
    _setGenerator(() => JSON.stringify({ title: "T", lines: LINES.map(l => ({ ...l, s: 0 })), questions: QS }));
    expect((await call(dialogue, { level: "A2" })).status).toBe(502);
    _setGenerator(() => JSON.stringify({ title: "T", lines: LINES.slice(0, 2), questions: QS }));
    expect((await call(dialogue, { level: "A2" })).status).toBe(502);
  });
  it("recorta un guion demasiado largo para el TTS", async () => {
    const long = Array.from({ length: 14 }, (_, i) => ({ s: i % 2, text: "word ".repeat(40) }));
    _setGenerator(() => JSON.stringify({ title: "T", lines: long, questions: QS }));
    const r = await call(dialogue, { level: "C1" });
    expect(r.body.lines.length).toBeLessThan(14);
    expect(r.body.lines.reduce((n, l) => n + l[1].length + 12, 0)).toBeLessThanOrEqual(1100);
  });
});

describe("guion a dos voces para el TTS", () => {
  const speakers = [{ name: "Megan", voice: "Sulafat" }, { name: "Dr. Patel", voice: "Iapetus" }];
  it("arma «Nombre: frase» y limpia los nombres", () => {
    const r = dialogueScript({ speakers: [{ name: "Megan<script>", voice: "Sulafat" }, speakers[1]], lines: [{ s: 0, text: "Hello there." }, { s: 1, text: "Hi!" }] });
    expect(r.text).toBe("Meganscript: Hello there.\nDr. Patel: Hi!");
    expect(r.speakers.map(s => s.voice)).toEqual(["Sulafat", "Iapetus"]);
  });
  it("rechaza voces desconocidas, una sola voz y guiones largos", () => {
    const lines = [{ s: 0, text: "Hello." }, { s: 1, text: "Hi!" }];
    expect(() => dialogueScript({ speakers: [speakers[0], { name: "X", voice: "Nope" }], lines })).toThrow();
    expect(() => dialogueScript({ speakers: [speakers[0]], lines })).toThrow();
    expect(() => dialogueScript({ speakers: [speakers[0], { ...speakers[0] }], lines })).toThrow();
    expect(() => dialogueScript({ speakers, lines: Array.from({ length: 10 }, (_, i) => ({ s: i % 2, text: "a".repeat(200) })) })).toThrow();
  });
  it("synthesize usa la configuración multi-hablante", async () => {
    process.env.GEMINI_TTS_MODELS = "t1";
    const calls = [];
    _setClient({ models: {
      list: async () => ({ async *[Symbol.asyncIterator]() { yield { name: "models/t1" }; } }),
      generateContent: async req => { calls.push(req); return { candidates: [{ content: { parts: [{ inlineData: { data: "QUFB", mimeType: "audio/L16;rate=24000" } }] } }] }; },
    } });
    expect(await synthesize({ text: "Megan: Hi\nDr. Patel: Hello", speakers })).toEqual({ data: "QUFB", rate: 24000 });
    const cfg = calls[0].config.speechConfig;
    expect(cfg.voiceConfig).toBeUndefined();
    expect(cfg.multiSpeakerVoiceConfig.speakerVoiceConfigs.map(x => [x.speaker, x.voiceConfig.prebuiltVoiceConfig.voiceName])).toEqual([["Megan", "Sulafat"], ["Dr. Patel", "Iapetus"]]);
  });
});

describe("diálogos fijos", () => {
  it("2 por banda, con dos personajes reales, líneas alternadas y 3 preguntas", () => {
    for (const b of ["A", "B", "C"]) {
      expect(DIALOGUES[b]).toHaveLength(2);
      for (const d of DIALOGUES[b]) {
        expect(d.speakers).toHaveLength(2);
        d.speakers.forEach(id => expect(CHARACTERS[id], id).toBeTruthy());
        d.lines.forEach(([s], i) => expect(s).toBe(i % 2));
        expect(d.questions).toHaveLength(3);
        d.questions.forEach(q => expect(q.a).toBeLessThan(q.o.length));
        expect(d.lines.reduce((n, l) => n + l[1].length + 12, 0)).toBeLessThanOrEqual(1200);
      }
    }
  });
  it("las parejas de los diálogos generados usan personajes distintos", () => {
    for (const [a, b] of PAIRS) { expect(CHARACTERS[a]).toBeTruthy(); expect(CHARACTERS[b]).toBeTruthy(); expect(CHARACTERS[a].voice).not.toBe(CHARACTERS[b].voice); }
  });
  it("lineAt reparte el avance del audio entre las líneas", () => {
    const lines = [[0, "aaaa"], [1, "bbbbbbbb"], [0, "cccc"]];
    expect(lineAt(lines, 0)).toBe(0);
    expect(lineAt(lines, 0.3)).toBe(1);
    expect(lineAt(lines, 0.9)).toBe(2);
    expect(lineAt(lines, 1)).toBe(2);
  });
});
