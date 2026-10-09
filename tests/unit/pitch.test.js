import { describe, expect, it } from "vitest";
import { analyze, compare, contour, correlation, envelope, pitchTrack, resample, voicedSpan, wordTimes } from "../../src/lib/pitch.js";

const RATE = 16000;
/** Tono puro con silencio antes y después; freq puede ser una función del tiempo (glissando). */
function tone(freq, secs = 0.6, { pad = 0.2, amp = 0.5 } = {}) {
  const n = Math.round(RATE * (secs + pad * 2)), out = new Float32Array(n);
  let phase = 0;
  for (let i = Math.round(RATE * pad); i < Math.round(RATE * (pad + secs)); i++) {
    const t = (i / RATE - pad) / secs;
    phase += 2 * Math.PI * (typeof freq === "function" ? freq(t) : freq) / RATE;
    out[i] = amp * Math.sin(phase);
  }
  return out;
}
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

describe("análisis de voz para shadowing", () => {
  it("el volumen detecta dónde empieza y termina la voz", () => {
    const env = envelope(tone(200), RATE, 10);
    const span = voicedSpan(env);
    expect(span.start).toBeGreaterThanOrEqual(18);
    expect(span.start).toBeLessThanOrEqual(22);
    expect(span.end - span.start).toBeGreaterThanOrEqual(58);
    expect(span.end - span.start).toBeLessThanOrEqual(62);
  });
  it("el silencio total no rompe nada", () => {
    const a = analyze(new Float32Array(RATE), RATE);
    expect(a.melody).toBeNull();
    expect(compare(a, a).melody).toBeNull();
  });
  it("mide el tono de una voz grave y de una aguda", () => {
    for (const hz of [110, 220, 300]) {
      const voiced = pitchTrack(tone(hz), RATE).filter(f => f > 0);
      expect(voiced.length).toBeGreaterThan(10);
      expect(Math.abs(median(voiced) - hz) / hz).toBeLessThan(0.06);
    }
  });
  it("resample interpola y conserva los extremos", () => {
    expect(Array.from(resample([0, 10], 5))).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(resample([], 3)).toHaveLength(3);
  });
  it("el contorno es relativo: la misma melodía una octava arriba se ve igual", () => {
    const up = t => 120 + 60 * t;
    const low = contour(pitchTrack(tone(up), RATE));
    const high = contour(pitchTrack(tone(t => 2 * up(t)), RATE));
    expect(correlation(low, high)).toBeGreaterThan(0.9);
    expect(low[low.length - 1]).toBeGreaterThan(low[0]);
  });
  it("una melodía que sube y otra que baja se parecen poco", () => {
    const rise = analyze(tone(t => 140 + 80 * t), RATE), fall = analyze(tone(t => 220 - 80 * t), RATE);
    expect(compare(rise, rise).melody).toBeGreaterThan(95);
    expect(compare(rise, fall).melody).toBeLessThan(20);
  });
  it("compara ritmo y velocidad", () => {
    const a = analyze(tone(180, 0.6), RATE), slow = analyze(tone(180, 0.9), RATE);
    expect(compare(a, a).rhythm).toBeGreaterThan(95);
    expect(compare(a, slow).pace).toBeGreaterThan(1.4);
    expect(compare(a, slow).pace).toBeLessThan(1.6);
  });
  it("reparte las palabras en orden dentro del tramo con voz", () => {
    const t = wordTimes("I think three things", { start: 20, end: 80 }, 100);
    expect(t.map(x => x.word)).toEqual(["I", "think", "three", "things"]);
    expect(t[0].start).toBeCloseTo(0.2);
    expect(t[3].end).toBeCloseTo(0.8);
    for (let i = 1; i < t.length; i++) expect(t[i].start).toBeCloseTo(t[i - 1].end);
    expect(t[1].end - t[1].start).toBeGreaterThan(t[0].end - t[0].start);
  });
});
