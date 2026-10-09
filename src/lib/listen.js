import { api } from "./api.js";
import { canRecognize, canServerTranscribe } from "./speech.js";
import { canRecord, startRecording } from "./recorder.js";
import { rms } from "./live.js";

/*
 * Escuchar una sola frase y devolver su texto, sin tocar la pantalla (para manos libres):
 * reconocimiento del navegador si existe; si no, graba hasta que hay silencio y transcribe con Whisper.
 */

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canListen = () => canRecognize() || (canRecord() && canServerTranscribe());

const SPEECH_RMS = 0.025, SILENCE_MS = 1300;

/** Devuelve { done: Promise<string>, stop() }. done resuelve "" si no se oyó nada. Nunca rechaza. */
export function listenOnce({ maxMs = 9000, waitMs = 7000 } = {}) {
  let stop = () => {};
  const done = SR ? new Promise(resolve => {
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    let text = "", ended = false;
    const end = () => { if (ended) return; ended = true; clearTimeout(timer); resolve(text.trim()); };
    r.onresult = ev => { for (const x of ev.results) if (x.isFinal) text += " " + x[0].transcript; };
    r.onerror = end;
    r.onend = end;
    const timer = setTimeout(() => { try { r.stop(); } catch { end(); } }, maxMs);
    stop = () => { try { r.abort(); } catch { /* ya detenido */ } end(); };
    try { r.start(); } catch { end(); }
  }) : (async () => {
    let stream, ctx, halted = false;
    stop = () => { halted = true; };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      const level = () => { an.getFloatTimeDomainData(buf); return rms(buf); };
      const t0 = Date.now();
      while (!halted && level() < SPEECH_RMS) {
        if (Date.now() - t0 > waitMs) return "";
        await new Promise(r => setTimeout(r, 80));
      }
      if (halted) return "";
      const rec = await startRecording({ maxMs, stream });
      let quiet = 0;
      const timer = setInterval(() => {
        if (halted) { clearInterval(timer); rec.stop(); return; }
        if (level() >= SPEECH_RMS) quiet = 0;
        else if (!quiet) quiet = Date.now();
        else if (Date.now() - quiet > SILENCE_MS) { clearInterval(timer); rec.stop(); }
      }, 100);
      const clip = await rec.done;
      clearInterval(timer);
      if (halted) return "";
      const { text } = await api("transcribe", { audio: clip.wavBase64 });
      return String(text || "").trim();
    } catch { return ""; }
    finally {
      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch { /* nada */ }
      try { if (ctx) ctx.close(); } catch { /* nada */ }
    }
  })();
  return { done, stop: () => stop() };
}
