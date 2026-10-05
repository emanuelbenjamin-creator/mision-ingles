import { apiBlob } from "./api.js";
import { hash } from "./dates.js";

/*
 * Reproductor único de la app. Usa la voz natural de Gemini (/api/tts) cuando está activa y hay IA;
 * si no, o si falla, la voz del navegador. Solo suena un audio a la vez y avisa su estado a los
 * botones (idle | loading | playing) para que muestren Escuchar o Detener.
 */

let prefs = { mode: "natural", voice: "Kore", accent: "us", rate: 0.9, ai: false };
let state = { id: null, status: "idle" };
const listeners = new Set();
let current = null; // { stop() }
let turn = 0; // cada reproducción nueva invalida las anteriores
const mem = new Map();
const CACHE = "tts-v1";

export const configureAudio = p => { prefs = { ...prefs, ...p }; };
export const getAudioState = () => state;
export function subscribeAudio(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setState(next) { state = next; listeners.forEach(f => f(state)); }

export function stopAudio() {
  turn++;
  if (current) { try { current.stop(); } catch { /* ya detenido */ } current = null; }
  try { if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel(); } catch { /* sin voz */ }
  if (state.status !== "idle") setState({ id: null, status: "idle" });
}

async function naturalBlob(text) {
  const key = `${prefs.voice}|${prefs.accent}|${hash(text)}|${text.length}`;
  if (mem.has(key)) return mem.get(key);
  const url = `/tts-cache/${encodeURIComponent(key)}`;
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) { const b = await hit.blob(); mem.set(key, b); return b; }
  } catch { /* sin Cache Storage */ }
  const blob = await apiBlob("tts", { text, voice: prefs.voice, accent: prefs.accent });
  mem.set(key, blob);
  try { const cache = await caches.open(CACHE); await cache.put(url, new Response(blob, { headers: { "Content-Type": "audio/wav" } })); } catch { /* sin Cache Storage */ }
  return blob;
}

function browserVoice() {
  try {
    const vs = window.speechSynthesis.getVoices();
    const lang = prefs.accent === "uk" ? /^en[-_]GB/i : /^en[-_]US/i;
    return vs.find(v => lang.test(v.lang) && /natural|google|samantha|aria|jenny|daniel|serena/i.test(v.name)) || vs.find(v => lang.test(v.lang)) || vs.find(v => /^en/i.test(v.lang));
  } catch { return null; }
}

function playBrowser(text, slow, id, my) {
  const synth = window.speechSynthesis;
  if (!synth) { setState({ id: null, status: "idle" }); return false; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = prefs.accent === "uk" ? "en-GB" : "en-US";
  u.rate = slow ? 0.65 : prefs.rate;
  const v = browserVoice();
  if (v) u.voice = v;
  const end = () => { if (my === turn) { current = null; setState({ id: null, status: "idle" }); } };
  u.onend = end;
  u.onerror = end;
  current = { stop: () => synth.cancel() };
  synth.cancel();
  synth.speak(u);
  setState({ id, status: "playing" });
  return true;
}

export async function playAudio(text, { slow = false, id = text } = {}) {
  stopAudio();
  const my = turn;
  if (prefs.mode === "natural" && prefs.ai) {
    setState({ id, status: "loading" });
    try {
      const blob = await naturalBlob(text);
      if (my !== turn) return;
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.playbackRate = slow ? 0.75 : Math.min(1.2, Math.max(0.7, prefs.rate / 0.9));
      const end = () => { URL.revokeObjectURL(url); if (my === turn) { current = null; setState({ id: null, status: "idle" }); } };
      a.onended = end;
      a.onerror = end;
      current = { stop: () => { a.pause(); URL.revokeObjectURL(url); } };
      await a.play();
      if (my === turn) setState({ id, status: "playing" });
      return;
    } catch {
      if (my !== turn) return; // se detuvo mientras cargaba
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
