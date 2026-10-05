/*
 * Voz natural Kokoro dentro del navegador: gratis, ilimitada y sin internet después de
 * descargarla una vez (~90 MB, queda en la caché del navegador).
 */

export const KOKORO_VOICES = [
  { id: "af_heart", label: "Heart · EE. UU. (mujer)", accent: "us" },
  { id: "af_bella", label: "Bella · EE. UU. (mujer)", accent: "us" },
  { id: "am_michael", label: "Michael · EE. UU. (hombre)", accent: "us" },
  { id: "am_fenrir", label: "Fenrir · EE. UU. (hombre)", accent: "us" },
  { id: "bf_emma", label: "Emma · Reino Unido (mujer)", accent: "uk" },
  { id: "bf_isabella", label: "Isabella · Reino Unido (mujer)", accent: "uk" },
  { id: "bm_george", label: "George · Reino Unido (hombre)", accent: "uk" },
  { id: "bm_fable", label: "Fable · Reino Unido (hombre)", accent: "uk" },
];

let worker = null;
let state = { status: "idle", progress: 0, error: "" }; // idle | downloading | ready | error
const listeners = new Set();
const pending = new Map();
let seq = 0;

export const kokoroSupported = () => typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
export const getKokoroState = () => state;
export function subscribeKokoro(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const setState = patch => { state = { ...state, ...patch }; listeners.forEach(f => f(state)); };
export const kokoroReady = () => state.status === "ready";

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("../workers/kokoro.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.type === "progress") setState({ status: "downloading", progress: data.total ? data.loaded / data.total : 0 });
    else if (data.type === "ready") setState({ status: "ready", progress: 1, error: "" });
    else if (data.type === "audio") { const p = pending.get(data.id); if (p) { pending.delete(data.id); p.resolve(new Blob([data.buf], { type: "audio/wav" })); } }
    else if (data.type === "error") {
      const p = pending.get(data.id);
      if (p) { pending.delete(data.id); p.reject(new Error(data.message)); }
      else setState({ status: "error", error: data.message });
    }
  };
  worker.onerror = e => setState({ status: "error", error: (e && e.message) || "No se pudo iniciar la voz Kokoro." });
  return worker;
}

/** Descarga (o carga desde la caché) el modelo. */
export function loadKokoro() {
  if (!kokoroSupported() || state.status === "ready" || state.status === "downloading") return;
  setState({ status: "downloading", progress: 0, error: "" });
  ensureWorker().postMessage({ type: "load" });
}

/** Genera el audio (WAV) de un texto con una voz Kokoro. */
export function kokoroSpeak(text, { voice = "af_heart", speed = 1 } = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ensureWorker().postMessage({ type: "speak", id, text, voice, speed });
  });
}
