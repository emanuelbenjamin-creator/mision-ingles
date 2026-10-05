import { LEVELS, GOALS } from "../../src/content/meta.js";
import { SCENARIOS } from "../../src/content/scenarios.js";
import { PROFESSIONS } from "../../src/content/professions.js";
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
export const ALL_SCENARIOS = [...SCENARIOS, ...Object.values(PROFESSIONS).flatMap(p => p.scenarios)];
export const profession = x => (PROFESSIONS[x] || PROFESSIONS.general);

export function scenarioById(id) {
  const sc = ALL_SCENARIOS.find(s => s.id === id);
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

/* ---------- Voz en vivo (Gemini Live) ---------- */
export const IELTS_EXAMINER = { id: "ielts", name: "Examinador IELTS", role: "a certified IELTS Speaking examiner" };

export function liveSystem(sc, lv) {
  if (sc.id === "ielts") {
    return `You are a friendly but neutral certified IELTS Speaking examiner. Conduct a realistic IELTS Speaking test in English with a candidate whose native language is Spanish (approximate level ${lv}).
Part 1: introduce yourself briefly, ask the candidate's name, then 4 short questions about familiar topics (home, work or studies, hobbies). Part 2: give a cue card topic with 3-4 bullet points, tell the candidate they have one minute to prepare, wait until they say they are ready, then let them speak for up to two minutes without interrupting; ask one short follow-up question. Part 3: ask 3 abstract discussion questions related to the Part 2 topic.
Speak clearly at a natural examiner pace. Do not give feedback or scores during the test. When Part 3 is finished, say "That is the end of the speaking test. Thank you."`;
  }
  return `You are ${sc.role}. You are having a spoken conversation with an English learner whose native language is Spanish, CEFR level ${lv}. Stay in character and keep it natural.
Speak clearly, at a pace and with vocabulary adapted to level ${lv}. Keep each turn short (1-3 sentences) and usually end with a question so the learner talks more than you.
Do not correct every mistake during the conversation. If the learner makes an error that blocks understanding, rephrase their idea correctly in a natural way (recast) and continue. If the learner speaks Spanish, answer in simple English and encourage them to try in English.`;
}

export function reviewPrompt(sc, lv, turns) {
  const transcript = turns.map(t => `${t.role === "user" ? "LEARNER" : "PARTNER"}: ${t.text}`).join("\n");
  return `This is the transcript (speech-to-text, ignore punctuation and small artifacts) of a spoken ${sc.id === "ielts" ? "IELTS speaking test" : "roleplay: " + sc.role} with an English learner, CEFR ${lv}, native Spanish speaker.

${transcript}

Review ONLY the learner's lines. Reply with ONLY a JSON object:
{"summary_es":"2-3 frases en español sobre cómo le fue","strengths_es":["fortaleza 1","fortaleza 2"],"corrections":[{"original":"exact learner words","corrected":"natural corrected version","explanation_es":"explicación breve","rule":"nombre corto de la regla"}],"fluency":0-100,"grammar":0-100,"vocabulary":0-100,"next_step_es":"un consejo concreto"}
Max 6 corrections, most important first; only real errors.`;
}

export function normalizeReview(o) {
  const n = x => { const v = Math.round(Number(x)); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null; };
  return {
    summary_es: str(o && o.summary_es, 600),
    strengths_es: arr(o && o.strengths_es, 3).map(x => str(x, 200)).filter(Boolean),
    corrections: arr(o && o.corrections, 6).map(c => ({ original: str(c && c.original, 300), corrected: str(c && c.corrected, 300), explanation_es: str(c && c.explanation_es, 400), rule: str(c && c.rule, 60) })).filter(c => c.original && c.corrected),
    fluency: n(o && o.fluency), grammar: n(o && o.grammar), vocabulary: n(o && o.vocabulary),
    next_step_es: str(o && o.next_step_es, 400),
  };
}

/* ---------- Pronunciación con audio ---------- */
export function pronPrompt(target, lv) {
  return `The attached audio is an English learner (native Spanish speaker, CEFR ${lv}) reading this sentence aloud:
"${target}"
Listen carefully and evaluate ONLY pronunciation (sounds, stress, linking, intonation), not grammar. Be strict but fair: typical Spanish-speaker issues include /θ/ vs /t/, /ɪ/ vs /iː/, /v/ vs /b/, an extra "e" before s+consonant, -ed endings, /ʃ/ vs /tʃ/, /h/ vs /x/, /æ/ vs /ʌ/, and word stress.
Reply with ONLY a JSON object:
{"score":0-100,"transcript":"what you actually heard","words":[{"word":"each word of the target sentence, in order","ok":true|false,"issue_es":"si ok es false: qué sonido falló y cómo corregirlo, en español"}],"sounds_to_practice":["/θ/"],"tip_es":"un consejo concreto en español"}
If the audio is silent or unintelligible, return score 0 and explain it in tip_es.`;
}

export function normalizePron(o, target) {
  const tokens = String(target).split(/\s+/).filter(Boolean);
  const ws = arr(o && o.words, 60);
  const words = tokens.map((t, i) => {
    const w = ws[i] || {};
    return { word: t, ok: w.ok !== false, issue_es: w.ok === false ? str(w.issue_es, 200) : "" };
  });
  const sc = Math.round(Number(o && o.score));
  return {
    score: Number.isFinite(sc) ? Math.max(0, Math.min(100, sc)) : 0,
    transcript: str(o && o.transcript, 400),
    words,
    sounds_to_practice: arr(o && o.sounds_to_practice, 5).map(x => str(x, 20)).filter(Boolean),
    tip_es: str(o && o.tip_es, 400),
  };
}

/* ---------- Escuchar y leer ---------- */
const LENGTH = { A1: "80-110", A2: "110-150", B1: "150-200", B2: "200-250", C1: "250-300", C2: "250-300" };

export function dictationPrompt(lv, prof) {
  return `Write 5 different sentences for an English dictation exercise for a learner at CEFR ${lv} whose field is ${prof.en}. Use natural, useful sentences (6-${lv.startsWith("A") ? 10 : 16} words), varied grammar for that level, and avoid rare names. Reply with ONLY a JSON object: {"sentences":["...","...","...","...","..."]}`;
}

export function readingPrompt(lv, prof, seed) {
  return `Write an original short graded reading for an English learner at CEFR ${lv} (native Spanish speaker), related to ${prof.en}. Length: ${LENGTH[lv] || "150-200"} words, 2-3 paragraphs separated by a blank line, vocabulary and grammar appropriate for ${lv}, a small story with a clear point. Variation seed: ${seed}.
Reply with ONLY a JSON object:
{"title":"...","text":"paragraph 1\\n\\nparagraph 2","glossary":[{"word":"word or phrase exactly as it appears in the text","es":"traducción al español en contexto"}],"questions":[{"q":"comprehension question","o":["option A","option B","option C"],"a":0}]}
Include 8-10 glossary items (the most useful or difficult words) and exactly 3 questions with 3 options each; "a" is the index of the correct option.`;
}

export function normalizeReading(o) {
  const text = String((o && o.text) || "").replace(/\r/g, "").trim().slice(0, 3000);
  const questions = arr(o && o.questions, 3).map(q => {
    const opts = arr(q && q.o, 4).map(x => str(x, 160)).filter(Boolean);
    const a = Math.round(Number(q && q.a));
    return { q: str(q && q.q, 200), o: opts, a: Number.isInteger(a) && a >= 0 && a < opts.length ? a : 0 };
  }).filter(q => q.q && q.o.length >= 2);
  if (!text || text.split(/\s+/).length < 40 || questions.length < 2) throw new HttpError(502, "invalid_json", "La lectura llegó incompleta. Inténtalo otra vez.");
  return {
    title: str(o && o.title, 120) || "Reading",
    text,
    glossary: arr(o && o.glossary, 12).map(g => [str(g && g.word, 60), str(g && g.es, 120)]).filter(g => g[0] && g[1]),
    questions,
  };
}

export function wordPrompt(word, sentence) {
  return `An English learner (native Spanish speaker) tapped the word "${word}" in this sentence: "${sentence}". Reply with ONLY a JSON object: {"es":"traducción al español en este contexto (máx. 6 palabras)","ipa":"IPA pronunciation","example":"another short natural English example sentence using it"}`;
}

/* ---------- Lección con tus errores ---------- */
export function lessonPrompt(lv, mistakes) {
  const list = mistakes.map((m, i) => `${i + 1}. "${m.wrong}" → "${m.right}" (${m.rule})`).join("\n");
  return `These are recent mistakes of an English learner (CEFR ${lv}, native Spanish speaker):
${list}

Create a short personalized lesson that groups them into 2-3 underlying patterns. Reply with ONLY a JSON object:
{"summary_es":"1-2 frases en español sobre qué está fallando","patterns":[{"rule":"nombre corto en español","explanation_es":"explicación clara y breve en español","examples":["correct English example 1","correct English example 2"]}],"exercises":[{"s":"English sentence with ___ for the gap","o":["option","option","option"],"a":0,"why":"explicación breve en español"}]}
Write exactly 5 exercises targeting those patterns (new sentences, not copies of the mistakes); "a" is the index of the correct option.`;
}

export function normalizeLesson(o) {
  const exercises = arr(o && o.exercises, 6).map(x => {
    const opts = arr(x && x.o, 4).map(v => str(v, 80)).filter(Boolean);
    const a = Math.round(Number(x && x.a));
    return { s: str(x && x.s, 200), o: opts, a: Number.isInteger(a) && a >= 0 && a < opts.length ? a : -1, why: str(x && x.why, 300) };
  }).filter(x => x.s.includes("___") && x.o.length >= 2 && x.a >= 0);
  if (exercises.length < 3) throw new HttpError(502, "invalid_json", "La lección llegó incompleta. Inténtalo otra vez.");
  return {
    summary_es: str(o && o.summary_es, 400),
    patterns: arr(o && o.patterns, 3).map(p => ({ rule: str(p && p.rule, 60), explanation_es: str(p && p.explanation_es, 500), examples: arr(p && p.examples, 3).map(e => str(e, 160)).filter(Boolean) })).filter(p => p.rule),
    exercises,
  };
}
