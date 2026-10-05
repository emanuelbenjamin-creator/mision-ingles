import { LEVELS, GOALS } from "../../src/content/meta.js";
import { SCENARIOS } from "../../src/content/scenarios.js";
import { HttpError } from "./http.js";

/* Validación de entradas y normalización de salidas: nunca se confía en lo que manda el navegador ni en el formato del modelo. */

export const str = (x, max = 500) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export const level = x => (LEVELS.includes(x) ? x : "B1");
export const goal = x => GOALS[x] || GOALS.trabajo;
const score = x => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; };
const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);

export function required(text, minWords, label) {
  if ((text.match(/[a-z']+/gi) || []).length < minWords) throw new HttpError(400, "too_short", `${label} es demasiado corto.`);
}

export const COACH = "You are an expert, encouraging English coach for native Spanish speakers (Latin America). You give precise, practical feedback. Explanations for the learner are always in Spanish; English examples stay in English.";

/* ---------- Habla 60 s ---------- */
export function speakPrompt({ text, topic, lv, goalName, seconds }) {
  return `The learner (CEFR level ${lv}, goal: ${goalName}) answered the speaking prompt "${topic}"${seconds ? ` in about ${seconds} seconds` : ""}. The text below is a speech-to-text transcript, so IGNORE punctuation, capitalization and small transcription artifacts.

TRANSCRIPT:
"""${text}"""

Reply with ONLY a JSON object with this exact shape:
{"scores":{"fluency":0-100,"grammar":0-100,"vocabulary":0-100,"coherence":0-100},"cefr_estimate":"A1|A2|B1|B2|C1|C2","corrections":[{"original":"exact words from the transcript","corrected":"corrected version","explanation_es":"explicación breve de la regla en español","rule":"nombre corto de la regla en español"}],"better_version":"a natural, improved version of the whole answer one level above the learner's, max 90 words","vocabulary_upgrades":[{"basic":"word they used","advanced":"better word or phrase","example":"short example sentence"}],"tip_es":"un consejo concreto en español para su próxima respuesta"}
Rules: max 5 corrections, only real errors (grammar, wrong word, unnatural phrasing), most important first; max 3 vocabulary_upgrades; calibrate scores to the learner's level; judge fluency from length, connectors and flow.`;
}

export function normalizeSpeak(o) {
  const s = (o && o.scores) || {};
  return {
    scores: { fluency: score(s.fluency), grammar: score(s.grammar), vocabulary: score(s.vocabulary), coherence: score(s.coherence) },
    cefr_estimate: LEVELS.includes(o && o.cefr_estimate) ? o.cefr_estimate : null,
    corrections: arr(o && o.corrections, 5).map(c => ({ original: str(c && c.original, 300), corrected: str(c && c.corrected, 300), explanation_es: str(c && c.explanation_es, 400), rule: str(c && c.rule, 60) })).filter(c => c.original && c.corrected),
    better_version: str(o && o.better_version, 1200),
    vocabulary_upgrades: arr(o && o.vocabulary_upgrades, 3).map(v => ({ basic: str(v && v.basic, 60), advanced: str(v && v.advanced, 80), example: str(v && v.example, 200) })).filter(v => v.advanced),
    tip_es: str(o && o.tip_es, 400),
  };
}

/* ---------- Conversación ---------- */
export function scenarioById(id) {
  const sc = SCENARIOS.find(s => s.id === id);
  if (!sc) throw new HttpError(400, "bad_scenario", "Escenario desconocido.");
  return sc;
}

export function chatSystem(sc, lv) {
  return `${COACH}
ROLEPLAY: You are ${sc.role}. You are talking with an English learner, CEFR level ${lv}. Stay in character. Keep each reply to 1-3 short, natural sentences adapted to the learner's level, and usually end with a question to keep the conversation going.
For the learner's LAST message, check for real errors (grammar, wrong word, unnatural phrasing). Ignore capitalization, punctuation and small speech-to-text artifacts.
Reply with ONLY a JSON object: {"reply":"your in-character reply","correction":null} when the message is fine, or {"reply":"...","correction":{"corrected":"the learner's message, corrected and natural","explanation_es":"explicación breve en español","rule":"nombre corto de la regla en español"}} when it has an error.`;
}

/** Historial del navegador → turnos de Gemini. Empieza con un turno del usuario y termina en el último mensaje del alumno. */
export function chatContents(sc, turns) {
  const clean = arr(turns, 30).slice(-14).map(t => ({ role: t && t.role === "assistant" ? "model" : "user", text: str(t && t.content, 600) })).filter(t => t.text);
  if (!clean.length || clean[clean.length - 1].role !== "user") throw new HttpError(400, "bad_turns", "Falta tu mensaje.");
  if (clean[0].role !== "user") clean.unshift({ role: "user", text: "(The conversation starts. Please greet me.)" });
  return clean;
}

export function normalizeChat(o) {
  const c = o && o.correction;
  const correction = c && c.corrected ? { corrected: str(c.corrected, 600), explanation_es: str(c.explanation_es, 400), rule: str(c.rule, 60) } : null;
  return { reply: str(o && o.reply, 800) || "Sorry, could you say that again?", correction };
}

export function suggestPrompt(sc, lv, last) {
  return `An English learner (CEFR ${lv}) is in a roleplay where the other person is ${sc.role}. The other person just said: "${last}". Suggest 3 different natural replies the learner could say, at their level, each under 18 words. Reply with ONLY a JSON object: {"suggestions":["...","...","..."]}`;
}

/* ---------- Gramática ---------- */
export function explainPrompt({ stem, options, correct, picked, lv }) {
  const ok = picked === correct;
  return `Ejercicio de inglés: "${stem}". Opciones: ${options.map(o => `"${o}"`).join(", ")}. Respuesta correcta: "${correct}". El alumno (nivel ${lv}) eligió "${picked}" (${ok ? "correcto" : "incorrecto"}).
Explica en español, en máximo 90 palabras y sin markdown, por qué la respuesta correcta es esa${ok ? "" : " y por qué su opción no funciona"}. Termina con un ejemplo extra en inglés.`;
}

export function askPrompt(q, lv) {
  return `Pregunta de un alumno hispanohablante de nivel ${lv}: ${q}
Responde en español, en menos de 180 palabras, sin markdown (usa guiones simples si haces una lista), con 2 o 3 ejemplos en inglés con su traducción. Si la pregunta no es sobre el idioma inglés, redirígela amablemente al aprendizaje del inglés.`;
}
