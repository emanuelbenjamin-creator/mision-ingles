/*
 * Conversación por voz en vivo con Gemini Live, directo desde el navegador con un token temporal.
 * Micrófono → PCM 16 kHz → Gemini; Gemini → PCM 24 kHz → parlantes. Las funciones puras de
 * conversión están exportadas para probarlas.
 */

/** Promedia muestras para bajar de inRate a outRate (ej. 48000 → 16000). */
export function downsample(input, inRate, outRate = 16000) {
  if (outRate >= inRate) return input;
  const ratio = inRate / outRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += input[j];
    out[i] = sum / Math.max(1, b - a);
  }
  return out;
}

export function floatToPcm16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const v = Math.max(-1, Math.min(1, f32[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

export function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToFloat32(b64) {
  const bin = atob(b64);
  const n = Math.floor(bin.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

export const liveSupported = () => typeof window !== "undefined" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioContext && window.AudioWorkletNode);

const WORKLET = `class PcmCapture extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor("pcm-capture", PcmCapture);`;

/**
 * Inicia la sesión. Callbacks: onTranscript(role, text), onState("connecting"|"listening"|"speaking"),
 * onError(mensaje), onClose(). Devuelve { stop(), setMuted(bool) }.
 */
export async function startLive({ token, model, config, onTranscript, onState, onError, onClose }) {
  onState("connecting");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });

  const outCtx = new AudioContext({ sampleRate: 24000 });
  const sources = new Set();
  let playHead = 0, closed = false, muted = false;
  const flush = () => { sources.forEach(s => { try { s.stop(); } catch { /* ya terminó */ } }); sources.clear(); playHead = 0; onState("listening"); };
  const playChunk = b64 => {
    const f = base64ToFloat32(b64);
    if (!f.length) return;
    const buf = outCtx.createBuffer(1, f.length, 24000);
    buf.copyToChannel(f, 0);
    const src = outCtx.createBufferSource();
    src.buffer = buf;
    src.connect(outCtx.destination);
    const t = Math.max(outCtx.currentTime + 0.02, playHead);
    src.start(t);
    playHead = t + buf.duration;
    sources.add(src);
    src.onended = () => { sources.delete(src); if (!sources.size && !closed) onState("listening"); };
    onState("speaking");
  };

  const session = await ai.live.connect({
    model,
    config,
    callbacks: {
      onopen: () => onState("listening"),
      onmessage: m => {
        const sc = m && m.serverContent;
        if (!sc) return;
        if (sc.interrupted) flush();
        const parts = (sc.modelTurn && sc.modelTurn.parts) || [];
        for (const p of parts) if (p.inlineData && p.inlineData.data && /audio/.test(p.inlineData.mimeType || "audio")) playChunk(p.inlineData.data);
        if (sc.inputTranscription && sc.inputTranscription.text) onTranscript("user", sc.inputTranscription.text);
        if (sc.outputTranscription && sc.outputTranscription.text) onTranscript("model", sc.outputTranscription.text);
      },
      onerror: e => onError((e && e.message) || "Se perdió la conexión con la voz en vivo."),
      onclose: () => { if (!closed) { closed = true; cleanup(); onClose(); } },
    },
  });

  let stream, inCtx, node, srcNode, workletUrl;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    closed = true;
    try { session.close(); } catch { /* cerrado */ }
    outCtx.close();
    throw new Error("No se pudo usar el micrófono. Revisa el permiso del navegador.");
  }
  inCtx = new AudioContext();
  workletUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await inCtx.audioWorklet.addModule(workletUrl);
  srcNode = inCtx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(inCtx, "pcm-capture");
  const silent = inCtx.createGain();
  silent.gain.value = 0;
  srcNode.connect(node);
  node.connect(silent).connect(inCtx.destination); // mantiene vivo el procesador sin hacer eco
  let pending = [], pendingLen = 0;
  const chunk = Math.round(inCtx.sampleRate * 0.1); // envía cada 100 ms
  node.port.onmessage = ev => {
    if (closed || muted) return;
    pending.push(ev.data);
    pendingLen += ev.data.length;
    if (pendingLen < chunk) return;
    const merged = new Float32Array(pendingLen);
    let o = 0;
    for (const p of pending) { merged.set(p, o); o += p.length; }
    pending = []; pendingLen = 0;
    const pcm = floatToPcm16(downsample(merged, inCtx.sampleRate, 16000));
    try { session.sendRealtimeInput({ audio: { data: bytesToBase64(new Uint8Array(pcm.buffer)), mimeType: "audio/pcm;rate=16000" } }); } catch { /* sesión cerrada */ }
  };

  function cleanup() {
    if (node) node.port.onmessage = null;
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch { /* nada */ }
    try { if (inCtx) inCtx.close(); } catch { /* nada */ }
    try { sources.forEach(s => s.stop()); outCtx.close(); } catch { /* nada */ }
    if (workletUrl) URL.revokeObjectURL(workletUrl);
  }

  return {
    stop() { if (closed) return; closed = true; try { session.close(); } catch { /* cerrado */ } cleanup(); },
    setMuted(v) { muted = v; },
  };
}
