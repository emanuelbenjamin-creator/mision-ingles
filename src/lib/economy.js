import { aiOf, api } from "./api.js";
import { recordLocal } from "./trace.js";
import { speakAndWait, stopAudio } from "./audio.js";
import { canRecognize, canServerTranscribe } from "./speech.js";
import { canRecord, startRecording } from "./recorder.js";
import { rms } from "./live.js";

/*
 * Modo de voz económico (respaldo de Gemini Live), casi gratis:
 * escuchar (reconocimiento del navegador o grabación + Whisper de Groq) → responder
 * (cualquier modelo de texto gratuito) → hablar (voz Gemini, Kokoro o del navegador).
 * No se puede interrumpir al coach como en Gemini Live: se habla por turnos.
 */

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const economySupported = () => canRecognize() || (canRecord() && canServerTranscribe());

const SPEECH_RMS = 0.025, SILENCE_MS = 1200, MAX_TURN_MS = 30000;

export async function startEconomy({ opts, level, profession, onTranscript, onState, onError, onClose, onCard }) {
  let closed = false, muted = false, rec = null, stream = null, ctx = null, analyser = null, buf = null, speaking = false;
  const turns = [];

  // Micrófono abierto durante toda la sesión: sirve para medir el volumen y, sin Web Speech, para grabar.
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    buf = new Float32Array(analyser.fftSize);
  } catch {
    throw new Error("No se pudo usar el micrófono. Revisa el permiso del navegador.");
  }
  const level0 = () => { if (!analyser) return 0; analyser.getFloatTimeDomainData(buf); return rms(buf); };

  const finish = () => {
    if (closed) return;
    closed = true;
    try { if (rec) rec.stop(); } catch { /* nada */ }
    stopAudio();
    try { stream.getTracks().forEach(t => t.stop()); } catch { /* nada */ }
    try { ctx.close(); } catch { /* nada */ }
    onClose();
  };

  async function reply() {
    if (closed) return;
    onState("thinking");
    try {
      const r = await api("voice-turn", { ...opts, level, profession, turns });
      if (closed) return;
      turns.push({ role: "model", text: r.reply });
      onTranscript("model", r.reply, aiOf(r));
      if (onCard) (r.cards || []).forEach(onCard);
      onState("speaking");
      speaking = true;
      await speakAndWait(r.reply, { voice: opts.voice, accent: opts.accent, tone: opts.tone, kokoroFallback: opts.kokoroVoice });
      speaking = false;
      if (!closed) listen();
    } catch (e) {
      onError(e.message || "El coach no respondió.");
      if (!closed) setTimeout(listen, 800);
    }
  }

  function heard(text) {
    const t = String(text || "").trim();
    if (closed) return;
    if (!t) { setTimeout(listen, 300); return; }
    turns.push({ role: "user", text: t });
    onTranscript("user", t);
    reply();
  }

  function listenWeb() {
    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    let text = "";
    r.onresult = ev => { for (const x of ev.results) if (x.isFinal) text += " " + x[0].transcript; };
    r.onerror = ev => { if (ev.error === "not-allowed") onError("El navegador bloqueó el micrófono."); };
    const t0 = Date.now();
    r.onend = () => { rec = null; if (text.trim()) recordLocal({ route: "web-speech", kind: "stt", model: "navegador (Web Speech)", ms: Date.now() - t0 }); heard(text); };
    rec = { stop: () => { try { r.abort(); } catch { /* nada */ } } };
    try { r.start(); } catch { setTimeout(listen, 500); }
  }

  async function listenServer() {
    // Espera a que hables, graba y corta tras 1.2 s de silencio.
    const started = Date.now();
    while (!closed && (muted || level0() < SPEECH_RMS)) {
      await new Promise(r => setTimeout(r, 80));
      if (Date.now() - started > 60000) { setTimeout(listen, 0); return; }
    }
    if (closed) return;
    const r = await startRecording({ maxMs: MAX_TURN_MS, stream });
    rec = r;
    let quietSince = 0;
    const timer = setInterval(() => {
      const v = level0();
      if (v >= SPEECH_RMS) quietSince = 0;
      else if (!quietSince) quietSince = Date.now();
      else if (Date.now() - quietSince > SILENCE_MS) { clearInterval(timer); r.stop(); }
    }, 100);
    try {
      const clip = await r.done;
      clearInterval(timer);
      rec = null;
      if (closed) return;
      onState("thinking");
      const { text } = await api("transcribe", { audio: clip.wavBase64 });
      heard(text);
    } catch (e) {
      clearInterval(timer);
      if (!closed) { onError(e.message || "No se pudo transcribir."); setTimeout(listen, 800); }
    }
  }

  function listen() {
    if (closed) return;
    onState("listening");
    if (muted) { setTimeout(listen, 400); return; }
    if (SR) listenWeb(); else listenServer();
  }

  reply(); // el coach empieza la conversación

  return {
    stop: finish,
    setMuted(v) { muted = v; if (v && rec) { try { rec.stop(); } catch { /* nada */ } } },
    levels() { return { user: speaking || muted ? 0 : Math.min(1, level0() * 5), model: speaking ? 0.35 + Math.random() * 0.3 : 0 }; },
  };
}
