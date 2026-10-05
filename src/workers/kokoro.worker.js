/* Voz Kokoro (82M, licencia Apache) corriendo dentro del navegador, en un hilo aparte. */
import { KokoroTTS } from "kokoro-js";

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
let tts = null, loading = null;

function load() {
  if (tts) return Promise.resolve(tts);
  if (!loading) {
    const files = new Map();
    loading = KokoroTTS.from_pretrained(MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: p => {
        if (p.status !== "progress" || !p.total) return;
        files.set(p.file, [p.loaded, p.total]);
        let loaded = 0, total = 0;
        for (const [l, t] of files.values()) { loaded += l; total += t; }
        postMessage({ type: "progress", loaded, total });
      },
    }).then(t => { tts = t; return t; }).catch(e => { loading = null; throw e; });
  }
  return loading;
}

function toWav(chunks, rate) {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) { const s = Math.max(-1, Math.min(1, c[i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return buf;
}

onmessage = async ({ data }) => {
  try {
    if (data.type === "load") { await load(); postMessage({ type: "ready" }); return; }
    if (data.type === "speak") {
      const t = await load();
      const chunks = [];
      let rate = 24000;
      for await (const part of t.stream(data.text, { voice: data.voice, speed: data.speed || 1 })) {
        chunks.push(part.audio.audio);
        rate = part.audio.sampling_rate || rate;
      }
      const buf = toWav(chunks, rate);
      postMessage({ type: "audio", id: data.id, buf }, [buf]);
    }
  } catch (e) {
    postMessage({ type: "error", id: data.id, message: String((e && e.message) || e) });
  }
};
