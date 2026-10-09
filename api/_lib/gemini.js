import { GoogleGenAI } from "@google/genai";
import { HttpError } from "./http.js";
import { enabledProviders, externalChat, externalModels, isExternal } from "./providers.js";
import { note, outcomeOf } from "./trace.js";

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

export const hasGemini = () => !!(process.env.GEMINI_API_KEY || client || testGenerator);
/** Hay IA de texto si existe Gemini o cualquier proveedor externo (Groq, Cerebras, Mistral, OpenRouter). */
export const hasAI = () => !!(testGenerator || hasGemini() || enabledProviders().length);

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
 * Resuelve { model, value, ms, tried }; tried = [{ m, r, ms }] con el resultado de cada modelo
 * (ok, lost: otro ganó antes, 429, 404, timeout, invalid, error). Al rechazar, errors.tried.
 */
export function race(models, run, validate = x => x, timeoutMs = TIMEOUT_MS) {
  if (!models.length) return Promise.reject(Object.assign([["(ninguno)", new Error("sin modelos disponibles")]], { tried: [] }));
  const ctrls = models.map(() => new AbortController());
  const t0 = Date.now();
  const res = models.map(m => ({ m, r: null, ms: 0 }));
  const close = r => res.forEach(x => { if (!x.r) { x.r = r; x.ms = Date.now() - t0; } });
  return new Promise((resolve, reject) => {
    let pending = models.length, done = false;
    const errors = [];
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      ctrls.forEach(c => c.abort());
      close("timeout");
      reject(Object.assign([...errors, ["timeout", new Error("tiempo agotado")]], { tried: res }));
    }, timeoutMs);
    models.forEach((m, i) => {
      Promise.resolve()
        .then(() => run(m, ctrls[i].signal))
        .then(raw => {
          if (done) return;
          let value;
          try { value = validate(raw); } catch (e) { throw Object.assign(e instanceof Error ? e : new Error(String(e)), { invalid: true }); }
          done = true;
          clearTimeout(timer);
          ctrls.forEach((c, j) => { if (j !== i) c.abort(); });
          res[i].r = "ok"; res[i].ms = Date.now() - t0;
          close("lost");
          resolve({ model: m, value, ms: res[i].ms, tried: res });
        })
        .catch(e => {
          if (done) return;
          errors.push([m, e]);
          noteFailure(m, e);
          res[i].r = e && e.invalid ? "invalid" : outcomeOf(e); res[i].ms = Date.now() - t0;
          if (--pending === 0) { done = true; clearTimeout(timer); reject(Object.assign(errors, { tried: res })); }
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
  if (testGenerator) {
    const t0 = Date.now();
    const v = validate(await testGenerator({ system, contents, json, hasAudio }));
    note({ kind: "text", model: "test", ms: Date.now() - t0 });
    return v;
  }
  if (!hasAI()) throw new HttpError(503, "no_ai", "El servidor no tiene configurada ninguna clave de IA (GEMINI_API_KEY, GROQ_API_KEY o CEREBRAS_API_KEY).");
  const c = hasGemini() ? getClient() : null;
  const cool = list => list.filter(m => !((cooling.get(m) || 0) > Date.now()));
  const run = (model, signal) => {
    if (isExternal(model)) return externalChat(model, { system, contents, json, temperature, signal });
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
  // Carrera principal: Gemini + Groq + Cerebras a la vez (los externos no escuchan audio).
  const primary = [...(c ? await availableModels(TEXT_MODELS(), c) : []), ...(hasAudio ? [] : cool(await externalModels("primary")))];
  const kind = hasAudio ? "audio-eval" : "text";
  const t0 = Date.now();
  const triedOf = e => (e && e.tried) || [];
  try {
    const r = await race(primary, run, validate);
    note({ kind, model: r.model, ms: r.ms, tier: "principal", tried: r.tried });
    return r.value;
  } catch (errors) {
    if (hasAudio) { note({ kind, model: null, ms: Date.now() - t0, tried: triedOf(errors) }); throw aiDown(errors); }
    // Respaldo: Gemma + Mistral + OpenRouter.
    const fb = [...(c ? await availableModels(FALLBACK_MODELS(), c) : []), ...cool(await externalModels("fallback"))];
    try {
      const r = await race(fb, run, validate);
      note({ kind, model: r.model, ms: Date.now() - t0, tier: "respaldo", tried: [...triedOf(errors), ...r.tried] });
      return r.value;
    } catch (more) {
      note({ kind, model: null, ms: Date.now() - t0, tried: [...triedOf(errors), ...triedOf(more)] });
      throw aiDown([...(Array.isArray(errors) ? errors : []), ...(Array.isArray(more) ? more : [])]);
    }
  }
}

/** Texto → audio PCM con los modelos TTS gratuitos en carrera. Devuelve { data: base64, rate }. */
export async function synthesize({ text, voice = "Kore", style = "", speakers = null }) {
  if (testGenerator) { note({ kind: "tts", model: "test" }); return testGenerator({ tts: true, text, voice, style, speakers }); }
  const c = getClient();
  // Con speakers = [{ name, voice }, { name, voice }] el texto es un guion «Nombre: frase» a dos voces.
  const speechConfig = speakers
    ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakers.map(s => ({ speaker: s.name, voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } } })) } }
    : { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } };
  const run = (model, signal) => c.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: style ? `${style}\n${text}` : text }] }],
    config: { responseModalities: ["AUDIO"], speechConfig, abortSignal: signal },
  }).then(r => {
    const parts = (r && r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
    const p = parts.find(x => x.inlineData && x.inlineData.data);
    if (!p) throw new Error("sin audio de " + model);
    const rate = Number((String(p.inlineData.mimeType).match(/rate=(\d+)/) || [])[1]) || 24000;
    return { data: p.inlineData.data, rate };
  });
  const t0 = Date.now();
  try {
    const r = await race(await availableModels(TTS_MODELS(), c), run);
    note({ kind: "tts", model: r.model, ms: r.ms, tried: r.tried });
    return r.value;
  } catch (errors) {
    note({ kind: "tts", model: null, ms: Date.now() - t0, tried: (errors && errors.tried) || [] });
    throw aiDown(errors);
  }
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
  note({ kind: "live", model: token && token.name ? model : null, ms: Date.now() - now });
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
