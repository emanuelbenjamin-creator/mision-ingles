import { apiBlob } from "./api.js";
import { hash } from "./dates.js";
import { kokoroReady, kokoroSpeak } from "./kokoro.js";
import { recordLocal } from "./trace.js";

/*
 * Reproductor único de la app. Usa la voz natural de Gemini (/api/tts) cuando está activa y hay IA;
 * si falla, la voz del navegador (y avisa por qué). Solo suena un audio a la vez.
 * - Estado (idle | loading | playing) para que los botones cambien a Detener y se pongan verdes.
 * - Avance (0–1) por un canal aparte, para pintar la barra sin re-renderizar toda la app.
 */

let prefs = { mode: "natural", voice: "Kore", accent: "us", rate: 0.9, ai: false, kokoroVoice: "af_heart" };
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

export function stopAudio() {
  turn++;
  if (current) { try { current.stop(); } catch { /* ya detenido */ } current = null; }
  try { if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel(); } catch { /* sin voz */ }
  setProgress(0);
  if (state.status !== "idle") setState({ id: null, status: "idle", engine: null });
}

/** Devuelve { blob, model }: model es el modelo TTS de Gemini que generó el audio (se guarda con la caché). */
async function naturalBlob(text, voice = prefs.voice) {
  const key = `${voice}|${prefs.accent}|v2|${hash(text)}|${text.length}`;
  const cachedHit = hit => { recordLocal({ route: "tts", kind: "tts", model: `${hit.model} · ${voice}`, cached: true }); return hit; };
  if (mem.has(key)) return cachedHit(mem.get(key));
  const url = `/tts-cache/${encodeURIComponent(key)}`;
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) { const v = { blob: await hit.blob(), model: hit.headers.get("X-AI-Model") || "gemini-tts" }; mem.set(key, v); return cachedHit(v); }
  } catch { /* sin Cache Storage */ }
  const blob = await apiBlob("tts", { text, voice, accent: prefs.accent });
  if (!blob || blob.size < 200 || (blob.type && !/audio|octet/.test(blob.type))) throw new Error("La voz natural devolvió un audio vacío.");
  const ev = blob._ai;
  const v = { blob, model: (ev && ev.calls[0] && ev.calls[0].model) || "gemini-tts" };
  mem.set(key, v);
  try { const cache = await caches.open(CACHE); await cache.put(url, new Response(blob, { headers: { "Content-Type": "audio/wav", "X-AI-Model": v.model } })); } catch { /* sin Cache Storage */ }
  return v;
}

function browserVoice() {
  try {
    const vs = window.speechSynthesis.getVoices();
    const lang = prefs.accent === "uk" ? /^en[-_]GB/i : /^en[-_]US/i;
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

function playBrowser(text, slow, id, my) {
  const synth = window.speechSynthesis;
  if (!synth) { setState({ id: null, status: "idle", engine: null }); return false; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = prefs.accent === "uk" ? "en-GB" : "en-US";
  u.rate = slow ? 0.65 : prefs.rate;
  const v = browserVoice();
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

async function playKokoro(text, slow, id, my, voice) {
  setState({ id, status: "loading", engine: "kokoro" });
  const { blob, model } = await kokoroBlob(text, voice);
  if (my !== turn) return true;
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  a.playbackRate = slow ? 0.8 : Math.min(1.2, Math.max(0.7, prefs.rate / 0.9));
  a.addEventListener("ended", () => URL.revokeObjectURL(url));
  await playElement(a, id, my, "kokoro", model);
  return true;
}

function reportFallback(reason) {
  const changed = !lastFallback || lastFallback.reason !== reason;
  lastFallback = { reason, at: Date.now() };
  if (changed && onFallback) onFallback(reason);
}

export async function playAudio(text, { slow = false, id = text, voice, kokoroVoice } = {}) {
  stopAudio();
  const my = turn;
  if (prefs.mode === "kokoro" || kokoroVoice) {
    if (kokoroReady()) {
      try { if (await playKokoro(text, slow, id, my, kokoroVoice)) return; }
      catch (e) { if (my !== turn) return; reportFallback("La voz Kokoro falló: " + ((e && e.message) || "error")); }
    } else reportFallback("La voz Kokoro aún no está descargada en este dispositivo (Ajustes → Voz).");
  }
  if (prefs.mode === "natural" && prefs.ai) {
    setState({ id, status: "loading", engine: "natural" });
    try {
      const { blob, model } = await naturalBlob(text, voice || prefs.voice);
      if (my !== turn) return;
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.playbackRate = slow ? 0.75 : Math.min(1.2, Math.max(0.7, prefs.rate / 0.9));
      a.addEventListener("ended", () => URL.revokeObjectURL(url));
      await playElement(a, id, my, "natural", model);
      lastFallback = null;
      return;
    } catch (e) {
      if (my !== turn) return; // se detuvo mientras cargaba
      reportFallback((e && e.message) || "La voz natural no respondió.");
      // Respaldo de calidad: Kokoro, si ya está descargada en este dispositivo.
      if (kokoroReady()) {
        try { if (await playKokoro(text, slow, id, my)) return; } catch { /* sigue con la del navegador */ }
        if (my !== turn) return;
      }
    }
  }
  playBrowser(text, slow, id, my);
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

/** Reproduce y resuelve cuando termina (para el modo de voz económico). */
export function speakAndWait(text) {
  return new Promise(resolve => {
    const id = "eco:" + Date.now() + Math.random();
    let started = false, done = false;
    const finish = () => { if (done) return; done = true; un(); clearTimeout(safety); resolve(); };
    const un = subscribeAudio(st => { if (st.id === id) started = true; else if (started) finish(); });
    const safety = setTimeout(finish, 4000 + text.split(/\s+/).length * 700);
    playAudio(text, { id });
  });
}
