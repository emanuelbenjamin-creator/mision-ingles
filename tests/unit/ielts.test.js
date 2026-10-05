import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { clampBand, ieltsOverall } from "../../src/lib/ielts.js";
import { IELTS_SETS } from "../../src/content/ielts.js";
import ieltsEvaluate from "../../api/ielts-evaluate.js";
import { _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";

function call(body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "6.6.6.6" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    ieltsEvaluate(req, res);
  });
}

describe("banda global IELTS (regla oficial)", () => {
  it.each([
    [{ fc: 6, lr: 6, gra: 6, p: 7 }, 6.5], // 6.25 → 6.5
    [{ fc: 7, lr: 7, gra: 7, p: 6 }, 7], // 6.75 → 7
    [{ fc: 6.5, lr: 6, gra: 6, p: 6 }, 6], // 6.125 → 6
    [{ fc: 6.5, lr: 6.5, gra: 6, p: 6.5 }, 6.5], // 6.375 → 6.5
    [{ fc: 5, lr: 5, gra: 5, p: 5 }, 5],
    [{ fc: 9, lr: 9, gra: 9, p: 8.5 }, 9], // 8.875 → 9
  ])("%o → %d", (b, want) => expect(ieltsOverall(b)).toBe(want));
  it("bandas fuera de rango y faltantes", () => {
    expect(clampBand(10)).toBe(9);
    expect(clampBand(6.3)).toBe(6.5);
    expect(ieltsOverall({ fc: 6, lr: 6, gra: 6 })).toBe(null);
  });
  it("el banco tiene 6 simulacros completos", () => {
    expect(IELTS_SETS).toHaveLength(6);
    for (const s of IELTS_SETS) { expect(s.part1).toHaveLength(4); expect(s.part2.bullets.length).toBeGreaterThanOrEqual(3); expect(s.part3).toHaveLength(3); }
  });
});

describe("API ielts-evaluate", () => {
  beforeEach(() => _resetRateLimit());
  afterEach(() => _setGenerator(null));
  const ans = "I think this is an interesting question because in my city people usually work a lot and they do not have much free time to relax";
  const body = { part1: [{ q: "Q1", a: ans }, { q: "Q2", a: ans }], part2: { topic: "A place", a: ans }, part3: [{ q: "Q3", a: ans }] };
  it("calcula la banda global en el servidor y usa el audio para pronunciación", async () => {
    let got;
    _setGenerator(a => { got = a; return JSON.stringify({ bands: { fc: 6, lr: 6, gra: 6, p: 7.2 }, criteria_es: { fc: "ok" }, corrections: [], better_phrases: [{ instead: "good", try: "rewarding" }], next_steps_es: ["Practica"] }); });
    const r = await call({ ...body, audio: Buffer.alloc(3000, 1).toString("base64") });
    expect(r.status).toBe(200);
    expect(r.body.bands).toEqual({ fc: 6, lr: 6, gra: 6, p: 7 });
    expect(r.body.overall).toBe(6.5);
    expect(r.body.pronunciationFromAudio).toBe(true);
    expect(got.hasAudio).toBe(true);
    expect(got.contents[0].text).toContain("PART 2 — Topic: A place");
  });
  it("sin audio estima la pronunciación con el texto", async () => {
    let got;
    _setGenerator(a => { got = a; return '{"bands":{"fc":5,"lr":5,"gra":5,"p":5}}'; });
    const r = await call(body);
    expect(r.body).toMatchObject({ overall: 5, pronunciationFromAudio: false });
    expect(got.contents[0].text).toContain("There is no audio");
  });
  it("respuestas muy cortas → 400; bandas faltantes → 502", async () => {
    expect((await call({ part1: [{ q: "Q", a: "yes" }] })).status).toBe(400);
    _setGenerator(() => '{"bands":{"fc":5}}');
    expect((await call(body)).status).toBe(502);
  });
});
