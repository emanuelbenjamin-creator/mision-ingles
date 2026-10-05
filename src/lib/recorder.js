import { bytesToBase64, downsample, floatToPcm16 } from "./live.js";

/* Grabación corta del micrófono → WAV 16 kHz mono (formato que Gemini entiende en todos los navegadores). */

export const canRecord = () => typeof window !== "undefined" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

/** WAV PCM16 mono a partir de muestras Int16. */
export function encodeWav(pcm16, rate = 16000) {
  const data = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  const buf = new ArrayBuffer(44 + data.length);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + data.length, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, data.length, true);
  new Uint8Array(buf, 44).set(data);
  return new Uint8Array(buf);
}

/**
 * Empieza a grabar. Devuelve { stop(), done } donde done resuelve con
 * { url, wavBase64, seconds } (url sirve para escucharte).
 */
export async function startRecording({ maxMs = 8000, rate = 16000, stream: given = null } = {}) {
  const stream = given || await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(t => window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve, reject) => {
    rec.onstop = async () => {
      if (!given) stream.getTracks().forEach(t => t.stop());
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
        const ctx = new AudioContext();
        const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
        ctx.close();
        const pcm = floatToPcm16(downsample(audio.getChannelData(0), audio.sampleRate, rate));
        const wav = encodeWav(pcm, rate);
        resolve({ url: URL.createObjectURL(new Blob([wav], { type: "audio/wav" })), wavBase64: bytesToBase64(wav), seconds: audio.duration });
      } catch (e) { reject(e); }
    };
  });
  rec.start();
  const timer = setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, maxMs);
  return { stop: () => { clearTimeout(timer); if (rec.state !== "inactive") rec.stop(); }, done };
}
