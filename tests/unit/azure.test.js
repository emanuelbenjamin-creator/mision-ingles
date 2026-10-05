import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import pronAssess from "../../api/_routes/pron-assess.js";
import transcribe from "../../api/_routes/transcribe.js";
import { _setAzureFetch } from "../../api/_lib/azure.js";
import { _setFetch } from "../../api/_lib/providers.js";
import { _setClient, _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";

function call(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "10.0.0.9" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}
const AUDIO = Buffer.alloc(4000, 3).toString("base64");
const AZ = {
  RecognitionStatus: "Success", DisplayText: "I sink three things.",
  NBest: [{ Display: "I sink three things.", PronunciationAssessment: { AccuracyScore: 78, FluencyScore: 90, CompletenessScore: 100, PronScore: 82 },
    Words: [
      { Word: "I", PronunciationAssessment: { AccuracyScore: 100, ErrorType: "None" }, Phonemes: [{ Phoneme: "aɪ", PronunciationAssessment: { AccuracyScore: 100 } }] },
      { Word: "think", PronunciationAssessment: { AccuracyScore: 40, ErrorType: "Mispronunciation" }, Phonemes: [{ Phoneme: "θ", PronunciationAssessment: { AccuracyScore: 20 } }, { Phoneme: "ɪ", PronunciationAssessment: { AccuracyScore: 90 } }] },
      { Word: "uh", PronunciationAssessment: { AccuracyScore: 0, ErrorType: "Insertion" } },
      { Word: "three", PronunciationAssessment: { AccuracyScore: 95, ErrorType: "None" }, Phonemes: [] },
      { Word: "things", PronunciationAssessment: { AccuracyScore: 0, ErrorType: "Omission" }, Phonemes: [] },
    ] }],
};

let azCalls;
beforeEach(() => {
  _resetRateLimit(); _setGenerator(null); _setClient(null);
  azCalls = [];
  _setAzureFetch(async (url, opts) => { azCalls.push({ url, opts }); return { ok: true, json: async () => AZ }; });
  Object.assign(process.env, { AZURE_SPEECH_KEY: "az", AZURE_SPEECH_REGION: "eastus" });
});
afterEach(() => { _setAzureFetch(null); _setFetch(null); for (const k of ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "GROQ_API_KEY"]) delete process.env[k]; });

describe("pronunciación con Azure (fonemas)", () => {
  it("usa Azure primero y marca cada palabra con sus fonemas débiles", async () => {
    const r = await call(pronAssess, { target: "I think three things.", audio: AUDIO });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ method: "azure", score: 82, scores: { accuracy: 78, fluency: 90, completeness: 100 } });
    expect(r.body.words.map(w => [w.word, w.ok])).toEqual([["I", true], ["think", false], ["three", true], ["things.", false]]);
    expect(r.body.words[1].issue_es).toContain("/θ/");
    expect(r.body.words[3].issue_es).toBe("No se escuchó esta palabra.");
    expect(r.body.sounds_to_practice).toEqual(["/θ/"]);
    const cfg = JSON.parse(Buffer.from(azCalls[0].opts.headers["Pronunciation-Assessment"], "base64").toString());
    expect(cfg).toMatchObject({ ReferenceText: "I think three things.", Granularity: "Phoneme", PhonemeAlphabet: "IPA" });
    expect(azCalls[0].url).toContain("eastus.stt.speech.microsoft.com");
  });
  it("si Azure falla usa Gemini; si no hay Gemini, Whisper de Groq", async () => {
    _setAzureFetch(async () => ({ ok: false, status: 429 }));
    _setGenerator(() => JSON.stringify({ score: 70, words: [{ word: "Hi", ok: true }] }));
    expect((await call(pronAssess, { target: "Hi", audio: AUDIO })).body.method).toBe("gemini");
    _setGenerator(null);
    process.env.GROQ_API_KEY = "kg";
    _setFetch(async () => ({ ok: true, json: async () => ({ text: "I sink so" }) }));
    const r = await call(pronAssess, { target: "I think so", audio: AUDIO });
    expect(r.body.method).toBe("whisper");
    expect(r.body.words.map(w => w.ok)).toEqual([true, false, true]);
  });
});

describe("transcripción con Whisper", () => {
  it("sin clave de Groq → 503; con clave transcribe", async () => {
    expect((await call(transcribe, { audio: AUDIO })).status).toBe(503);
    process.env.GROQ_API_KEY = "kg";
    _setFetch(async () => ({ ok: true, json: async () => ({ text: " hello there " }) }));
    expect((await call(transcribe, { audio: AUDIO })).body).toEqual({ text: "hello there" });
  });
});
