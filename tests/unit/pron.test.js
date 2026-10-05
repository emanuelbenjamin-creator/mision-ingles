import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { encodeWav } from "../../src/lib/recorder.js";
import pronAssess from "../../api/pron-assess.js";
import { _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";

function call(body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "3.3.3.3" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    pronAssess(req, res);
  });
}
const AUDIO = Buffer.alloc(4000, 7).toString("base64");

describe("pronunciación con audio", () => {
  beforeEach(() => _resetRateLimit());
  afterEach(() => _setGenerator(null));
  it("encodeWav arma un WAV de 16 kHz", () => {
    const wav = encodeWav(new Int16Array([1, -1, 0]), 16000);
    expect(wav.length).toBe(50);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(16000);
  });
  it("envía el audio a Gemini y alinea las palabras con la frase objetivo", async () => {
    let got;
    _setGenerator(args => { got = args; return JSON.stringify({ score: 120, transcript: "I sink", words: [{ word: "I", ok: true }, { word: "think", ok: false, issue_es: "TH" }], tip_es: "x" }); });
    const r = await call({ target: "I think so.", audio: AUDIO, level: "B1" });
    expect(r.status).toBe(200);
    expect(r.body.score).toBe(100);
    expect(r.body.words).toEqual([{ word: "I", ok: true, issue_es: "" }, { word: "think", ok: false, issue_es: "TH" }, { word: "so.", ok: true, issue_es: "" }]);
    expect(got.hasAudio).toBe(true);
    expect(got.contents[0].audio).toEqual({ mimeType: "audio/wav", data: AUDIO });
  });
  it("rechaza audio vacío o dañado", async () => {
    _setGenerator(() => "{}");
    expect((await call({ target: "Hi", audio: "abc" })).status).toBe(400);
    expect((await call({ target: "Hi", audio: "@@@".repeat(1000) })).status).toBe(400);
  });
});
