import { describe, expect, it } from "vitest";
import { alignWords, words } from "../../src/lib/align.js";
import { localAnalyze } from "../../src/lib/analyze.js";

describe("pronunciación por alineación", () => {
  it("100% cuando se reconoce todo, sin importar mayúsculas ni puntuación", () => {
    const r = alignWords("I think three things are worth it.", "i think three things are worth it");
    expect(r.score).toBe(100);
    expect(r.tokens.every(t => t.status === "ok")).toBe(true);
  });
  it("marca en rojo las palabras mal reconocidas", () => {
    const r = alignWords("I think three things are worth it.", "I sink tree things are worth it");
    expect(r.score).toBe(71);
    expect(r.tokens.filter(t => t.status === "miss").map(t => t.text)).toEqual(["think", "three"]);
  });
  it("0% sin texto", () => {
    expect(alignWords("Hello there", "").score).toBe(0);
  });
  it("words() normaliza", () => {
    expect(words("Hi, I'm OK!")).toEqual(["hi", "i'm", "ok"]);
  });
});

describe("evaluación básica sin IA", () => {
  const text = "Um, I have 30 years and I work in a bank. The people is very friendly, because we help each other and I like my job so much.";
  it("detecta errores típicos y muletillas", () => {
    const r = localAnalyze(text, 30);
    expect(r.n).toBeGreaterThan(20);
    expect(r.fixes.map(f => f.corrected)).toEqual(expect.arrayContaining(["I am 30 years old", "people are"]));
    expect(r.fillers).toBe(1);
    expect(r.wpm).toBe(Math.round(r.n / 0.5));
  });
  it("todos los puntajes están entre 0 y 100", () => {
    for (const secs of [null, 10, 60]) {
      const { scores } = localAnalyze(text, secs);
      for (const v of Object.values(scores)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });
});
