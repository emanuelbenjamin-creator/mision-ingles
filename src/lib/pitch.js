import { downsample, rms } from "./live.js";

/*
 * Análisis de voz para comparar tu grabación con la del nativo (shadowing): volumen por tramos,
 * entonación (tono fundamental por autocorrelación) y ritmo. Son funciones puras y aproximadas:
 * sirven para ver la forma de la frase, no para medir fonemas (eso lo hace /api/pron-assess).
 */

const WORK_RATE = 8000;

/** Volumen (RMS) cada hopMs. Devuelve Float32Array. */
export function envelope(samples, rate, hopMs = 10) {
  const hop = Math.max(1, Math.round(rate * hopMs / 1000));
  const n = Math.floor(samples.length / hop);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rms(samples.subarray(i * hop, (i + 1) * hop));
  return out;
}

/** Primer y último tramo con voz (por encima de una fracción del máximo). { start, end } con end exclusivo. */
export function voicedSpan(env, frac = 0.12) {
  let max = 0;
  for (const v of env) if (v > max) max = v;
  const thr = Math.max(0.004, max * frac);
  let start = 0, end = env.length;
  while (start < end && env[start] < thr) start++;
  while (end > start && env[end - 1] < thr) end--;
  return start < end ? { start, end } : { start: 0, end: env.length };
}

/** Tono fundamental (Hz) cada hopMs; 0 donde no hay voz sonora. */
export function pitchTrack(samples, rate, { hopMs = 20, winMs = 40, fmin = 70, fmax = 400 } = {}) {
  const x = downsample(samples, rate, WORK_RATE);
  const r = Math.min(rate, WORK_RATE);
  const hop = Math.round(r * hopMs / 1000), win = Math.round(r * winMs / 1000);
  const lagMin = Math.floor(r / fmax), lagMax = Math.ceil(r / fmin);
  const out = [];
  for (let s = 0; s + win + lagMax <= x.length; s += hop) {
    let e0 = 0;
    for (let i = 0; i < win; i++) e0 += x[s + i] * x[s + i];
    if (Math.sqrt(e0 / win) < 0.01) { out.push(0); continue; }
    let best = 0, bestLag = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let num = 0, e1 = 0;
      for (let i = 0; i < win; i++) { const b = x[s + i + lag]; num += x[s + i] * b; e1 += b * b; }
      const c = num / (Math.sqrt(e0 * e1) || 1);
      // Se prefiere el primer máximo fuerte (evita saltar a la octava de abajo).
      if (c > best + 0.02) { best = c; bestLag = lag; }
    }
    out.push(best >= 0.55 && bestLag ? r / bestLag : 0);
  }
  return out;
}

/** Interpola un arreglo a n puntos. */
export function resample(arr, n) {
  const out = new Float32Array(n);
  if (!arr.length) return out;
  for (let i = 0; i < n; i++) {
    const p = n === 1 ? 0 : i * (arr.length - 1) / (n - 1);
    const a = Math.floor(p), b = Math.min(arr.length - 1, a + 1);
    out[i] = arr[a] + (arr[b] - arr[a]) * (p - a);
  }
  return out;
}

/**
 * Contorno de entonación en semitonos respecto a la mediana de quien habla (así se pueden comparar
 * una voz grave y una aguda). Los huecos sin voz se rellenan interpolando. null si casi no hay voz sonora.
 */
export function contour(track, n = 60) {
  const voiced = track.filter(f => f > 0);
  if (voiced.length < 4) return null;
  const median = [...voiced].sort((a, b) => a - b)[Math.floor(voiced.length / 2)];
  const first = track.findIndex(f => f > 0);
  let last = track.length - 1;
  while (track[last] <= 0) last--;
  const semis = [];
  let prev = 12 * Math.log2(track[first] / median);
  for (let i = first; i <= last; i++) {
    if (track[i] > 0) { prev = 12 * Math.log2(track[i] / median); semis.push(prev); continue; }
    let j = i;
    while (track[j] <= 0) j++;
    const next = 12 * Math.log2(track[j] / median);
    for (let k = i; k < j; k++) semis.push(prev + (next - prev) * (k - i + 1) / (j - i + 1));
    i = j - 1;
  }
  return resample(semis, n).map(v => Math.max(-12, Math.min(12, v)));
}

/** Correlación de Pearson entre dos arreglos del mismo largo (−1 a 1). */
export function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Todo lo que se dibuja y se compara de un audio: { env, span, shape, melody, seconds }. */
export function analyze(samples, rate) {
  const env = envelope(samples, rate, 10);
  const span = voicedSpan(env);
  const hop = Math.round(rate * 0.01);
  const voiced = samples.subarray(span.start * hop, span.end * hop);
  return {
    env, span,
    shape: resample(env.subarray(span.start, span.end), 80),
    melody: contour(pitchTrack(voiced, rate)),
    seconds: (span.end - span.start) * 0.01,
  };
}

const pct = r => Math.round(Math.max(0, Math.min(1, r)) * 100);

/**
 * Compara dos análisis. rhythm y melody van de 0 a 100 (parecido de la forma, no de los sonidos);
 * pace es tu duración entre la del nativo (1 = igual, 1.3 = 30 % más lento).
 */
export function compare(native, user) {
  return {
    rhythm: pct(correlation(native.shape, user.shape)),
    melody: native.melody && user.melody ? pct(correlation(native.melody, user.melody)) : null,
    pace: native.seconds > 0 ? Math.round(user.seconds / native.seconds * 100) / 100 : null,
  };
}

/**
 * Tiempos estimados de cada palabra (fracción 0–1 del audio) para el texto tipo karaoke: se reparte
 * el tramo con voz según el largo de cada palabra. Es una aproximación: el TTS no entrega tiempos reales.
 */
export function wordTimes(text, span, frames) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const total = words.reduce((n, w) => n + w.length + 1, 0) || 1;
  const a = frames ? span.start / frames : 0, b = frames ? span.end / frames : 1;
  let acc = 0;
  return words.map(w => {
    const start = a + (b - a) * acc / total;
    acc += w.length + 1;
    return { word: w, start, end: a + (b - a) * acc / total };
  });
}
