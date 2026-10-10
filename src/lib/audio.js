import { apiBlob } from "./api.js";
import { hash } from "./dates.js";
import { kokoroReady, kokoroSpeak, whenKokoroReady } from "./kokoro.js";
import { recordLocal } from "./trace.js";
import { accentOf } from "../content/voices.js";

/*
 * Reproductor único de la app. Usa la voz natural de Gemini (/api/tts) cuando está activa y hay IA;
 * si falla, la voz del navegador (y avisa por qué). Solo suena un audio a la vez.
 * - Estado (idle | loading | playing) para que los botones cambien a Detener y se pongan verdes.
 * - Avance (0–1) por un canal aparte, para pintar la barra sin re-renderizar toda la app.
 */

let prefs = { mode: "natural", voice: "Kore", accent: "us", tone: "friendly", rate: 0.9, ai: false, kokoroVoice: "af_heart" };
let state = { id: null, status: "idle", engine: null, model: null };
const listeners = new Set();
const progressListeners = new Set();
let current = null; // { stop() }
let turn = 0; // cada reproducción nueva invalida las anteriores
const mem = new Map();
const CACHE = "tts-v1";
let onFallback = null;
let lastFallback = null; // { reason, at }
export let lastEngine = null; // "natural" | "kokoro" | "browser"

export const configureAudio = p => { prefs = { ...prefs, ...p }; };
/** Se llama (una vez por motivo) cuando la voz natural falla y se usa la del navegador. */
export const setFallbackHandler = fn => { onFallback = fn; };
export const getAudioState = () => state;
export const getLastFallback = () => lastFallback;
export function subscribeAudio(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function subscribeProgress(fn) { progressListeners.add(fn); return () => progressListeners.delete(fn); }
function setState(next) { state = next; listeners.forEach(f => f(state)); }
function setProgress(p) { const v = Math.max(0, Math.min(1, p || 0)); progressListeners.forEach(f => f(v)); }

/** Detiene lo que suena (y la secuencia en curso, si la hay). */
export function stopAudio() {
  if (seq.id) { seqToken++; setSeq({ id: null, index: -1, total: 0 }); }
  halt();
}

function halt() {
  turn++;
  if (current) { try { current.stop(); } catch { /* ya detenido */ } current = null; }
  try { if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel(); } catch { /* sin voz */ }
  setProgress(0);
  if (state.status !== "idle") setState({ id: null, status: "idle", engine: null });
}

/** Devuelve { blob, model }: model es el modelo TTS de Gemini que generó el audio (se guarda con la caché). */
async function naturalBlob(text, voice = prefs.voice, accent = prefs.accent, tone = prefs.tone) {
  const key = `${voice}|${accent}|${tone}|v3|${hash(text)}|${text.length}`;
  const cachedHit = hit => { recordLocal({ route: "tts", kind: "tts", model: `${hit.model} · ${voice}`, cached: true }); return hit; };
  if (mem.has(key)) return cachedHit(mem.get(key));
  const url = `/tts-cache/${encodeURIComponent(key)}`;
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) { const v = { blob: await hit.blob(), model: hit.headers.get("X-AI-Model") || "gemini-tts" }; mem.set(key, v); return cachedHit(v); }
  } catch { /* sin Cache Storage */ }
  const blob = await apiBlob("tts", { text, voice, accent, tone });
  if (!blob || blob.size < 200 || (blob.type && !/audio|octet/.test(blob.type))) throw new Error("La voz natural devolvió un audio vacío.");
  const ev = blob._ai;
  const v = { blob, model: (ev && ev.calls[0] && ev.calls[0].model) || "gemini-tts" };
  mem.set(key, v);
  try { const cache = await caches.open(CACHE); await cache.put(url, new Response(blob, { headers: { "Content-Type": "audio/wav", "X-AI-Model": v.model } })); } catch { /* sin Cache Storage */ }
  return v;
}

function browserVoice(accent = prefs.accent) {
  try {
    const vs = window.speechSynthesis.getVoices();
    const lang = new RegExp("^" + accentOf(accent).lang.replace("-", "[-_]"), "i");
    return vs.find(v => lang.test(v.lang) && /natural|neural|online|google|samantha|aria|jenny|guy|daniel|serena|libby|ryan/i.test(v.name))
      || vs.find(v => lang.test(v.lang)) || vs.find(v => /^en/i.test(v.lang));
  } catch { return null; }
}

/** Reproduce un elemento <audio> con avance continuo. */
function playElement(a, id, my, engine, model = null) {
  let raf = 0;
  const tick = () => {
    if (my !== turn) return;
    if (a.duration > 0) setProgress(a.currentTime / a.duration);
    raf = requestAnimationFrame(tick);
  };
  const end = () => { cancelAnimationFrame(raf); if (my === turn) { current = null; setProgress(0); setState({ id: null, status: "idle", engine: null, model: null }); } };
  a.onended = end;
  a.onerror = end;
  current = { stop: () => { cancelAnimationFrame(raf); a.pause(); } };
  return a.play().then(() => {
    if (my !== turn) { a.pause(); return; }
    lastEngine = engine;
    setState({ id, status: "playing", engine, model });
    raf = requestAnimationFrame(tick);
  });
}

function playBrowser(text, slow, id, my, accent = prefs.accent, pitch = 1, speed = 0) {
  const synth = window.speechSynthesis;
  if (!synth) { setState({ id: null, status: "idle", engine: null }); return false; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = accentOf(accent).lang;
  u.rate = speed ? Math.min(1.5, Math.max(0.6, speed)) * 0.95 : slow ? 0.65 : prefs.rate;
  u.pitch = pitch;
  const v = browserVoice(accent);
  if (v) u.voice = v;
  const model = "navegador · " + (v ? v.name : "voz por defecto");
  recordLocal({ route: "tts", kind: "tts", model });
  // Avance: por palabras dichas (onboundary) o, si el navegador no lo informa, estimado por tiempo.
  const started = Date.now();
  const estimate = Math.max(1.2, text.split(/\s+/).length / (2.6 * u.rate)) * 1000;
  let spoken = 0, timer = 0;
  u.onboundary = e => { if (typeof e.charIndex === "number") spoken = e.charIndex / Math.max(1, text.length); };
  const tick = () => { if (my !== turn) return; setProgress(Math.max(spoken, Math.min(0.95, (Date.now() - started) / estimate))); timer = setTimeout(tick, 80); };
  const end = () => { clearTimeout(timer); if (my === turn) { current = null; setProgress(0); setState({ id: null, status: "idle", engine: null, model: null }); } };
  u.onend = end;
  u.onerror = end;
  current = { stop: () => { clearTimeout(timer); synth.cancel(); } };
  synth.cancel();
  synth.speak(u);
  lastEngine = "browser";
  setState({ id, status: "playing", engine: "browser", model });
  tick();
  return true;
}

async function kokoroBlob(text, voice) {
  const v = voice || prefs.kokoroVoice || (prefs.accent === "uk" ? "bf_emma" : "af_heart");
  const key = `k|${v}|${hash(text)}|${text.length}`;
  const model = `kokoro-82M · ${v}`;
  if (mem.has(key)) { recordLocal({ route: "tts", kind: "tts", model, cached: true }); return { blob: mem.get(key), model }; }
  const t0 = Date.now();
  const blob = await kokoroSpeak(text, { voice: v });
  recordLocal({ route: "tts", kind: "tts", model, ms: Date.now() - t0 });
  mem.set(key, blob);
  return { blob, model };
}

async function playKokoro(text, slow, id, my, voice, speed) {
  setState({ id, status: "loading", engine: "kokoro" });
  const { blob, model } = await kokoroBlob(text, voice);
  if (my !== turn) return true;
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  a.playbackRate = rateOf(speed, slow, 0.8);
  a.addEventListener("ended", () => URL.revokeObjectURL(url));
  await playElement(a, id, my, "kokoro", model);
  return true;
}

function reportFallback(reason) {
  const changed = !lastFallback || lastFallback.reason !== reason;
  lastFallback = { reason, at: Date.now() };
  if (changed && onFallback) onFallback(reason);
}

/** Reproduce un texto. opts: { slow, speed, id, voice, kokoroVoice, kokoroFallback, accent, tone, pitch } (voz y acento, para personajes). */
export function playAudio(text, opts = {}) {
  if (seq.id) { seqToken++; setSeq({ id: null, index: -1, total: 0 }); }
  return start(text, opts);
}

/** Velocidad del <audio>: `speed` (0.6–1.5) manda sobre lento/normal. */
const rateOf = (speed, slow, slowRate) => (speed ? Math.min(1.5, Math.max(0.6, speed)) : slow ? slowRate : Math.min(1.2, Math.max(0.7, prefs.rate / 0.9)));

async function start(text, { slow = false, id = text, voice, kokoroVoice, kokoroFallback, accent, tone, pitch, speed } = {}) {
  halt();
  const my = turn;
  if (prefs.mode === "kokoro" || kokoroVoice) {
    // Al abrir la app el modelo tarda unos segundos en cargar desde la caché: se espera en vez de usar otra voz.
    if (!kokoroReady()) {
      setState({ id, status: "loading", engine: "kokoro" });
      await whenKokoroReady();
      if (my !== turn) return;
    }
    if (kokoroReady()) {
      try { if (await playKokoro(text, slow, id, my, kokoroVoice, speed)) return; }
      catch (e) { if (my !== turn) return; reportFallback("La voz Kokoro falló: " + ((e && e.message) || "error")); }
    } else reportFallback("La voz Kokoro aún no está descargada en este dispositivo (Ajustes → Voz).");
  }
  if (prefs.mode === "natural" && prefs.ai) {
    setState({ id, status: "loading", engine: "natural" });
    try {
      const { blob, model } = await naturalBlob(text, voice || prefs.voice, accent || prefs.accent, tone || prefs.tone);
      if (my !== turn) return;
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.playbackRate = rateOf(speed, slow, 0.75);
      a.addEventListener("ended", () => URL.revokeObjectURL(url));
      await playElement(a, id, my, "natural", model);
      lastFallback = null;
      return;
    } catch (e) {
      if (my !== turn) return; // se detuvo mientras cargaba
      reportFallback((e && e.message) || "La voz natural no respondió.");
      // Respaldo de calidad: Kokoro, si ya está descargada en este dispositivo.
      if (kokoroReady()) {
        try { if (await playKokoro(text, slow, id, my, kokoroFallback, speed)) return; } catch { /* sigue con la del navegador */ }
        if (my !== turn) return;
      }
    }
  }
  playBrowser(text, slow, id, my, accent || prefs.accent, pitch, speed);
}

/** Si ese mismo audio está sonando o cargando, lo detiene; si no, lo reproduce. */
export function toggleAudio(text, opts = {}) {
  const id = opts.id || text;
  if (state.id === id && state.status !== "idle") stopAudio();
  else playAudio(text, { ...opts, id });
}

/** Escuchar una voz de Gemini antes de elegirla. */
export function previewVoice(voice) {
  const id = "voice:" + voice;
  const text = `Hi! I'm ${voice}. Let's practise your English together. How was your day?`;
  if (state.id === id && state.status !== "idle") { stopAudio(); return; }
  playAudio(text, { id, voice });
}

/** Escuchar una voz Kokoro antes de elegirla. */
export function previewKokoro(voiceId) {
  const id = "kvoice:" + voiceId;
  if (state.id === id && state.status !== "idle") { stopAudio(); return; }
  playAudio("Hi! This voice runs right here on your device. Let's practise your English together.", { id, kokoroVoice: voiceId });
}

/** Reproduce una grabación (URL de Blob) con el mismo estado compartido que los demás audios. */
export async function toggleClip(url, id) {
  if (state.id === id && state.status !== "idle") { stopAudio(); return; }
  stopAudio();
  const my = turn;
  try { await playElement(new Audio(url), id, my, "clip"); }
  catch { if (my === turn) { current = null; setState({ id: null, status: "idle", engine: null }); } }
}

/** Resuelve cuando el audio con ese id empezó y terminó (o tras un tiempo de seguridad). */
function waitEnd(id, text) {
  return new Promise(resolve => {
    let started = false, done = false;
    const finish = () => { if (done) return; done = true; un(); clearTimeout(safety); resolve(); };
    const un = subscribeAudio(st => { if (st.id === id) started = true; else if (started) finish(); });
    const safety = setTimeout(finish, 6000 + text.split(/\s+/).length * 700);
  });
}

/** Reproduce y resuelve cuando termina (para el modo de voz económico y manos libres). */
export function speakAndWait(text, opts = {}) {
  const id = "eco:" + Date.now() + Math.random();
  const done = waitEnd(id, text);
  playAudio(text, { ...opts, id });
  return done;
}

/* ---------- Secuencias: varias líneas seguidas, cada una con su voz (diálogos e historias) ---------- */
let seq = { id: null, index: -1, total: 0 };
let seqToken = 0;
const seqListeners = new Set();
export const getSeqState = () => seq;
export function subscribeSeq(fn) { seqListeners.add(fn); return () => seqListeners.delete(fn); }
function setSeq(next) { seq = next; seqListeners.forEach(f => f(seq)); }

/** Descarga por adelantado la voz natural de una línea, para que no haya silencio entre turnos. */
function prefetch(line) {
  if (!line || prefs.mode !== "natural" || !prefs.ai) return;
  naturalBlob(line.text, line.voice || prefs.voice, line.accent || prefs.accent, line.tone || prefs.tone).catch(() => { /* se reintenta al reproducir */ });
}

/**
 * Reproduce lines = [{ text, voice?, kokoroVoice?, accent?, tone?, g? }] en orden. Resuelve true si llegó
 * al final y false si se detuvo. El estado { id, index, total } se publica con subscribeSeq.
 */
export async function playSequence(lines, { id = "seq", from = 0, slow = false } = {}) {
  stopAudio();
  const my = ++seqToken;
  for (let i = from; i < lines.length; i++) {
    if (my !== seqToken) return false;
    setSeq({ id, index: i, total: lines.length });
    prefetch(lines[i + 1]);
    const line = lines[i], lineId = `${id}#${i}`;
    const done = waitEnd(lineId, line.text);
    // En modo Kokoro cada personaje usa su voz Kokoro; en modo natural, su voz de Gemini.
    start(line.text, { slow, id: lineId, voice: line.voice, accent: line.accent, tone: line.tone, kokoroVoice: prefs.mode === "kokoro" ? line.kokoroVoice : undefined, kokoroFallback: line.kokoroVoice, pitch: line.g === "m" ? 0.8 : line.g === "f" ? 1.15 : 1 });
    await done;
  }
  if (my !== seqToken) return false;
  setSeq({ id: null, index: -1, total: 0 });
  return true;
}

/** Si esa secuencia está sonando, la detiene; si no, la reproduce. */
export function toggleSequence(lines, opts = {}) {
  if (seq.id && seq.id === (opts.id || "seq")) { stopAudio(); return Promise.resolve(false); }
  return playSequence(lines, opts);
}

/* ---------- Diálogos a dos voces ---------- */
/** Líneas de un diálogo con la voz de cada personaje: cast = [personaje0, personaje1]. */
export const dialogueLines = (d, cast) => d.lines.map(([s, text]) => {
  const c = cast[s] || {};
  return { text, voice: c.voice, kokoroVoice: c.kokoroVoice, accent: c.accent, tone: c.tone, g: c.g };
});

async function dialogueBlob(d, cast) {
  const text = d.lines.map(([s, t]) => s + t).join("|");
  const key = `dlg|${cast.map(c => c.voice).join("+")}|${hash(text)}|${text.length}`;
  if (mem.has(key)) return mem.get(key);
  const blob = await apiBlob("tts", { speakers: cast.map(c => ({ name: c.name, voice: c.voice })), lines: d.lines.map(([s, t]) => ({ s, text: t })) });
  if (!blob || blob.size < 200) throw new Error("La voz natural devolvió un audio vacío.");
  const ev = blob._ai;
  const v = { blob, model: (ev && ev.calls[0] && ev.calls[0].model) || "gemini-tts" };
  mem.set(key, v);
  return v;
}

/**
 * Reproduce (o detiene) un diálogo. Con la voz de Gemini se pide un solo audio a dos voces, que suena
 * como una conversación real; si falla o se usa Kokoro o el navegador, se lee línea por línea.
 */
export async function toggleDialogue(d, cast, { id = "dlg" } = {}) {
  if ((state.id === id && state.status !== "idle") || seq.id === id) { stopAudio(); return; }
  if (prefs.mode === "natural" && prefs.ai) {
    stopAudio();
    const my = turn;
    setState({ id, status: "loading", engine: "natural" });
    try {
      const { blob, model } = await dialogueBlob(d, cast);
      if (my !== turn) return;
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.playbackRate = Math.min(1.2, Math.max(0.7, prefs.rate / 0.9));
      a.addEventListener("ended", () => URL.revokeObjectURL(url));
      await playElement(a, id, my, "natural", model);
      return;
    } catch (e) {
      if (my !== turn) return;
      reportFallback((e && e.message) || "La voz natural no respondió.");
    }
  }
  await playSequence(dialogueLines(d, cast), { id });
}

/**
 * Audio (Blob WAV) de un texto con la voz activa, sin reproducirlo: para dibujar su onda y su
 * entonación. Devuelve { blob, engine } o null si solo hay voz del navegador (no se puede capturar).
 */
export async function audioBlobFor(text, { voice, kokoroVoice, accent, tone } = {}) {
  if ((prefs.mode === "kokoro" || kokoroVoice) && kokoroReady()) {
    try { return { blob: (await kokoroBlob(text, kokoroVoice)).blob, engine: "kokoro" }; } catch { /* prueba la natural */ }
  }
  if (prefs.ai && prefs.mode !== "browser") {
    try { return { blob: (await naturalBlob(text, voice || prefs.voice, accent || prefs.accent, tone || prefs.tone)).blob, engine: "natural" }; } catch { /* prueba Kokoro */ }
  }
  if (kokoroReady()) {
    try { return { blob: (await kokoroBlob(text, kokoroVoice)).blob, engine: "kokoro" }; } catch { /* sin audio capturable */ }
  }
  return null;
}
