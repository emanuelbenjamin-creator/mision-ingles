import { GoogleGenAI } from "@google/genai";
import { HttpError } from "./http.js";

/*
 * Solo modelos con capa gratuita de la Gemini API. Se lanzan todos a la vez y gana la primera
 * respuesta válida; los demás se cancelan. Si un modelo se queda sin cuota (429) "se enfría" un
 * minuto, y si no existe (404) se deja de usar. Gemma queda como último respaldo.
 */

const list = (name, def) => (process.env[name] || def).split(",").map(s => s.trim()).filter(Boolean);
export const TEXT_MODELS = () => list("GEMINI_MODELS", "gemini-3-flash-preview,gemini-3.1-flash-lite,gemini-2.5-flash,gemini-2.5-flash-lite");
export const FALLBACK_MODELS = () => list("GEMINI_FALLBACK_MODELS", "gemma-3-27b-it");
export const TTS_MODELS = () => list("GEMINI_TTS_MODELS", "gemini-3.8-flash-lite-tts,gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts");
export const LIVE_MODELS = () => list("GEMINI_LIVE_MODELS", "gemini-3.8-live,gemini-2.5-flash-native-audio-preview-12-2025");

const TIMEOUT_MS = 25000;
const COOL_429_MS = 60 * 1000;
const COOL_404_MS = 60 * 60 * 1000;

let client = null;
let known = null; // Promise<Set<string> | null>: modelos que existen para esta clave
const cooling = new Map(); // modelo → hora hasta la que no se usa
let testGenerator = null;

/** Solo para pruebas: reemplaza toda la llamada a Gemini por una función que devuelve texto. */
export const _setGenerator = fn => { testGenerator = fn; };
/** Solo para pruebas: usa un cliente falso ({ models: { generateContent, list }, authTokens }). */
export const _setClient = c => { client = c; known = null; cooling.clear(); };

export const hasAI = () => !!(process.env.GEMINI_API_KEY || testGenerator || client);

export function getClient() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(503, "no_ai", "El servidor no tiene configurada la clave de Gemini (GEMINI_API_KEY).");
  client = new GoogleGenAI({ apiKey });
  return client;
}

/** Lista (una vez por instancia) los modelos que existen; si falla, no se filtra nada. */
function knownModels(c) {
  if (!known) {
    known = (async () => {
      try {
        const names = new Set();
        const pager = await c.models.list({ config: { pageSize: 200 } });
        for await (const m of pager) names.add(String(m.name || "").replace(/^models\//, ""));
        return names.size ? names : null;
      } catch { return null; }
    })();
  }
  return known;
}

export async function availableModels(models, c = getClient(), now = Date.now()) {
  const names = await knownModels(c);
  return models.filter(m => (!names || names.has(m)) && !((cooling.get(m) || 0) > now));
}

const statusOf = e => Number(e && (e.status || e.code)) || (String(e && e.message).match(/\b(429|404|403|401|503|500)\b/) || [])[1] * 1 || 0;

function noteFailure(model, e, now = Date.now()) {
  const st = statusOf(e), msg = String(e && e.message);
  if (st === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) cooling.set(model, now + COOL_429_MS);
  else if (st === 404 || /NOT_FOUND|is not found|not supported/i.test(msg)) cooling.set(model, now + COOL_404_MS);
}

/**
 * Lanza run(model, signal) para todos los modelos a la vez. Resuelve con el primer resultado que
 * pase validate; cancela el resto. Rechaza con la lista de errores si todos fallan.
 */
export function race(models, run, validate = x => x, timeoutMs = TIMEOUT_MS) {
  if (!models.length) return Promise.reject([["(ninguno)", new Error("sin modelos disponibles")]]);
  const ctrls = models.map(() => new AbortController());
  return new Promise((resolve, reject) => {
    let pending = models.length, done = false;
    const errors = [];
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      ctrls.forEach(c => c.abort());
      reject([...errors, ["timeout", new Error("tiempo agotado")]]);
    }, timeoutMs);
    models.forEach((m, i) => {
      Promise.resolve()
        .then(() => run(m, ctrls[i].signal))
        .then(raw => {
          if (done) return;
          const value = validate(raw);
          done = true;
          clearTimeout(timer);
          ctrls.forEach((c, j) => { if (j !== i) c.abort(); });
          resolve({ model: m, value });
        })
        .catch(e => {
          if (done) return;
          errors.push([m, e]);
          noteFailure(m, e);
          if (--pending === 0) { done = true; clearTimeout(timer); reject(errors); }
        });
    });
  });
}

const isGemma = m => /^gemma/i.test(m);

/** contents: string o [{ role: "user"|"model", text?, audio?: { mimeType, data } }]. */
function toContents(contents, system, gemma) {
  const items = typeof contents === "string" ? [{ role: "user", text: contents }] : contents;
  return items.map((c, i) => {
    const parts = [];
    let text = c.text;
    // Gemma no admite instrucción de sistema: se antepone al primer mensaje.
    if (gemma && system && i === 0) text = `${system}\n\n${text || ""}`;
    if (text) parts.push({ text });
    if (c.audio) parts.push({ inlineData: { mimeType: c.audio.mimeType, data: c.audio.data } });
    return { role: c.role || "user", parts };
  });
}

function aiDown(errors) {
  console.error("[gemini] todos los modelos fallaron:", (Array.isArray(errors) ? errors : [["?", errors]]).map(([m, e]) => `${m}: ${e && e.message}`).join(" | "));
  const all429 = Array.isArray(errors) && errors.length && errors.every(([, e]) => statusOf(e) === 429);
  return new HttpError(all429 ? 429 : 502, all429 ? "quota" : "ai_error",
    all429 ? "Se acabó la cuota gratuita de hoy del coach IA. Sigue en modo básico y vuelve mañana."
      : "El coach IA está ocupado en este momento. Inténtalo en un minuto.");
}

/**
 * Genera texto (o JSON con validate = parseJson) con todos los modelos gratuitos en carrera.
 * Devuelve lo que devuelva validate (por defecto, el texto).
 */
export async function generate({ system, contents, json = true, temperature = 0.5, validate = x => x, hasAudio = false }) {
  if (testGenerator) return validate(await testGenerator({ system, contents, json, hasAudio }));
  const c = getClient();
  const run = (model, signal) => {
    const gemma = isGemma(model);
    return c.models.generateContent({
      model,
      contents: toContents(contents, system, gemma),
      config: {
        ...(gemma ? {} : { systemInstruction: system }),
        temperature,
        ...(json && !gemma ? { responseMimeType: "application/json" } : {}),
        abortSignal: signal,
      },
    }).then(r => {
      const text = r && r.text;
      if (!text || !text.trim()) throw new Error("respuesta vacía de " + model);
      return text;
    });
  };
  const primary = await availableModels(TEXT_MODELS(), c);
  try {
    return (await race(primary, run, validate)).value;
  } catch (errors) {
    if (hasAudio) throw aiDown(errors); // Gemma no escucha audio
    const fb = await availableModels(FALLBACK_MODELS(), c);
    try { return (await race(fb, run, validate)).value; }
    catch (more) { throw aiDown([...(Array.isArray(errors) ? errors : []), ...(Array.isArray(more) ? more : [])]); }
  }
}

/** Texto → audio PCM con los modelos TTS gratuitos en carrera. Devuelve { data: base64, rate }. */
export async function synthesize({ text, voice = "Kore", style = "" }) {
  if (testGenerator) return testGenerator({ tts: true, text, voice, style });
  const c = getClient();
  const run = (model, signal) => c.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: style ? `${style}\n${text}` : text }] }],
    config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }, abortSignal: signal },
  }).then(r => {
    const parts = (r && r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
    const p = parts.find(x => x.inlineData && x.inlineData.data);
    if (!p) throw new Error("sin audio de " + model);
    const rate = Number((String(p.inlineData.mimeType).match(/rate=(\d+)/) || [])[1]) || 24000;
    return { data: p.inlineData.data, rate };
  });
  try { return (await race(await availableModels(TTS_MODELS(), c), run)).value; }
  catch (errors) { throw aiDown(errors); }
}

/** Token temporal para Gemini Live: el navegador conecta sin conocer la clave. */
export async function createLiveToken({ minutes, config }) {
  const c = getClient();
  const models = await availableModels(LIVE_MODELS(), c);
  const model = models[0] || LIVE_MODELS()[0];
  const now = Date.now();
  const token = await c.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + minutes * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: { model, config },
      httpOptions: { apiVersion: "v1alpha" },
    },
  });
  if (!token || !token.name) throw new HttpError(502, "ai_error", "No se pudo iniciar la voz en vivo. Inténtalo otra vez.");
  return { token: token.name, model };
}

/** Lee JSON de forma tolerante (texto plano, bloque ```json o el primer objeto/arreglo). */
export function parseJson(text) {
  const t = String(text || "").trim();
  const tries = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) tries.push(fence[1]);
  const o1 = t.indexOf("{"), o2 = t.lastIndexOf("}");
  if (o1 >= 0 && o2 > o1) tries.push(t.slice(o1, o2 + 1));
  const a1 = t.indexOf("["), a2 = t.lastIndexOf("]");
  if (a1 >= 0 && a2 > a1) tries.push(t.slice(a1, a2 + 1));
  for (const c of tries) { try { return JSON.parse(c); } catch { /* siguiente intento */ } }
  throw new HttpError(502, "invalid_json", "La respuesta del coach llegó incompleta. Inténtalo otra vez.");
}
