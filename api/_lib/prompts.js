import { LEVELS, GOALS } from "../../src/content/meta.js";
import { SCENARIOS } from "../../src/content/scenarios.js";
import { PROFESSIONS } from "../../src/content/professions.js";
import { ACCENT_IDS, TONE_IDS, accentOf, liveVoiceLine } from "../../src/content/voices.js";
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
If the learner writes in Spanish (fully or partly) or says they don't know how to say something, help them: in "correction" put the natural English version of what they meant as "corrected", with "explanation_es" starting with "Así se dice en inglés:" and "rule" "Del español al inglés"; in "reply" briefly encourage them in English to try writing it, then continue the roleplay in English. Never continue the conversation in Spanish.
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

export const FREE_TALK = { id: "free", name: "Conversación libre", role: "Alex, a friendly and curious English conversation partner" };
export const TUTOR = { id: "tutor", name: "Profesor de speaking", role: "Sam, a patient English speaking tutor" };

/**
 * Instrucciones para Gemini Live. opts: { sc, lv, topic, correction: "now"|"end", pace: "slow"|"normal", profession, accent, tone }.
 */
export function liveSystem(sc, lv, opts = {}) {
  // Acento y tono del personaje (listas cerradas); sin ellos no se agrega nada.
  const voice = ACCENT_IDS.includes(opts.accent) || TONE_IDS.includes(opts.tone) ? "\n" + liveVoiceLine(opts.accent, opts.tone) : "";
  const pace = opts.pace === "slow"
    ? "Speak slowly and very clearly, with short pauses between sentences, using simple words."
    : "Speak at a natural but clear pace.";
  if (sc.id === "ielts") {
    return `You are a friendly but neutral certified IELTS Speaking examiner. Conduct a realistic IELTS Speaking test in English with a candidate whose native language is Spanish (approximate level ${lv}).
Part 1: introduce yourself briefly, ask the candidate's name, then 4 short questions about familiar topics (home, work or studies, hobbies). Part 2: give a cue card topic with 3-4 bullet points, tell the candidate they have one minute to prepare, wait until they say they are ready, then let them speak for up to two minutes without interrupting; ask one short follow-up question. Part 3: ask 3 abstract discussion questions related to the Part 2 topic.
Speak clearly at a natural examiner pace. Do not give feedback or scores during the test. When Part 3 is finished, say "That is the end of the speaking test. Thank you."
You open the call: as soon as it starts, greet the candidate and begin Part 1 without waiting.
If the candidate answers in Spanish or says they don't know how to say something, kindly say "Try to answer in English, for example: ..." giving them a short English sentence starter, and wait for their answer in English.${voice}`;
  }
  const topic = str(opts.topic, 80).replace(/["<>{}]/g, "");
  const correct = opts.correction === "now" || sc.id === "tutor"
    ? "When the learner makes a real mistake, first give a very short correction (for example: \"Small tip: we say 'I am 30 years old'.\"), then continue the conversation naturally. Do not correct small details or pronunciation of names."
    : "Do not interrupt to correct mistakes. If an error blocks understanding, simply rephrase the idea correctly in your reply (recast) and continue.";
  const who = sc.id === "free"
    ? `You are ${sc.role}. Have a relaxed spoken conversation ${topic ? `about "${topic}"` : "about whatever the learner wants (start by asking how their day is going)"}${opts.profession ? `; the learner works in ${opts.profession}` : ""}.`
    : sc.id === "tutor"
      ? `You are ${sc.role}. Help the learner practise speaking ${topic ? `about "${topic}"` : "about everyday topics and their work"}: ask open questions, ask them to expand their answers, and teach one useful phrase from time to time.`
      : `You are ${sc.role}. Stay in character and keep the roleplay natural.`;
  return `${who}
The learner's native language is Spanish and their CEFR level is ${lv}. Adapt vocabulary and grammar to that level. ${pace}
You open the call: as soon as it starts, greet the learner warmly in English, introduce yourself in one short sentence and ask your first simple question. Do not wait for them to speak first.
Keep each of your turns short (1-3 sentences) and usually end with a question so the learner talks more than you. ${correct}
SPANISH BRIDGE (very important): the learner may answer in Spanish or say "no sé" / "¿cómo se dice...?" when they don't know how to say something. When that happens: (1) reassure them very briefly (you may use at most one short Spanish phrase, like "¡Tranquilo!"), (2) say the English version of exactly what they wanted to say, slowly and clearly, (3) ask them to repeat it ("Can you say it?"), (4) when they repeat it, praise them briefly and continue the conversation in English. Never switch the conversation to Spanish.${voice}`;
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

/** a y b son personajes ({ name, accent }) de src/content/characters.js. */
export function dialoguePrompt(lv, prof, a, b, seed) {
  const from = c => accentOf(c.accent).from;
  return `Write an original short spoken conversation for an English listening exercise, for a learner at CEFR ${lv} (native Spanish speaker). The situation is related to ${prof.en}. Speaker 0 is ${a.name} (from ${from(a)}) and speaker 1 is ${b.name} (from ${from(b)}). Variation seed: ${seed}.
Write 8 to 10 turns, strictly alternating and starting with speaker 0. Each turn is 1-2 natural spoken sentences, at most 22 words, with vocabulary and grammar appropriate for ${lv}. The conversation must have a clear situation, a small problem and a resolution. Do not write the speaker's name inside the text.
Reply with ONLY a JSON object:
{"title":"short title","setting_es":"una frase en español que explica la situación","lines":[{"s":0,"text":"..."},{"s":1,"text":"..."}],"questions":[{"q":"comprehension question","o":["option A","option B","option C"],"a":0}]}
Write exactly 3 questions with 3 options each; "a" is the index of the correct option, and vary its position.`;
}

export function normalizeDialogue(o) {
  let lines = arr(o && o.lines, 14).map(l => ({ s: Number(l && l.s) === 1 ? 1 : 0, text: str(l && l.text, 240) })).filter(l => l.text);
  // El TTS a dos voces admite un guion corto: se recorta por el final si se pasa.
  while (lines.length > 4 && lines.reduce((n, l) => n + l.text.length + 12, 0) > 1100) lines = lines.slice(0, -1);
  const questions = arr(o && o.questions, 3).map(q => {
    const opts = arr(q && q.o, 4).map(x => str(x, 160)).filter(Boolean);
    const a = Math.round(Number(q && q.a));
    return { q: str(q && q.q, 200), o: opts, a: Number.isInteger(a) && a >= 0 && a < opts.length ? a : 0 };
  }).filter(q => q.q && q.o.length >= 2);
  if (lines.length < 4 || !lines.some(l => l.s === 0) || !lines.some(l => l.s === 1) || questions.length < 2) throw new HttpError(502, "invalid_json", "El diálogo llegó incompleto. Inténtalo otra vez.");
  return { title: str(o && o.title, 120) || "Dialogue", setting_es: str(o && o.setting_es, 240), lines: lines.map(l => [l.s, l.text]), questions };
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

/* ---------- Simulacro IELTS ---------- */
export function ieltsPrompt(set, hasAudio) {
  const p1 = set.part1.map((x, i) => `Q${i + 1}: ${x.q}\nA: ${x.a || "(no answer)"}`).join("\n");
  const p3 = set.part3.map((x, i) => `Q${i + 1}: ${x.q}\nA: ${x.a || "(no answer)"}`).join("\n");
  return `You are a certified IELTS Speaking examiner. Rate this candidate (native Spanish speaker) using the official public band descriptors. The answers are speech-to-text transcripts, so ignore punctuation and capitalization.${hasAudio ? " The attached audio is the candidate's Part 2 long turn: use it to judge Pronunciation (and fluency features such as pauses and hesitation)." : " There is no audio: estimate Pronunciation conservatively from the transcripts and say so."}

PART 1
${p1}

PART 2 — Topic: ${set.part2.topic}
Answer (transcript): ${set.part2.a || "(see audio)"}

PART 3
${p3}

Reply with ONLY a JSON object:
{"bands":{"fc":0-9,"lr":0-9,"gra":0-9,"p":0-9},"criteria_es":{"fc":"justificación breve en español de Fluency and Coherence","lr":"... Lexical Resource","gra":"... Grammatical Range and Accuracy","p":"... Pronunciation"},"corrections":[{"original":"candidate's words","corrected":"better version","explanation_es":"explicación breve","rule":"nombre corto"}],"better_phrases":[{"instead":"what the candidate said","try":"a higher-band alternative"}],"next_steps_es":["paso concreto 1","paso concreto 2","paso concreto 3"]}
Bands in 0.5 steps. Max 6 corrections and 4 better_phrases. Be realistic, not generous.`;
}

export function normalizeIelts(o) {
  const b = (o && o.bands) || {};
  const band = x => { const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(9, Math.round(n * 2) / 2)) : null; };
  const bands = { fc: band(b.fc), lr: band(b.lr), gra: band(b.gra), p: band(b.p) };
  if (Object.values(bands).some(v => v == null)) throw new HttpError(502, "invalid_json", "La evaluación llegó incompleta. Inténtalo otra vez.");
  const c = (o && o.criteria_es) || {};
  return {
    bands,
    criteria_es: { fc: str(c.fc, 500), lr: str(c.lr, 500), gra: str(c.gra, 500), p: str(c.p, 500) },
    corrections: arr(o && o.corrections, 6).map(x => ({ original: str(x && x.original, 300), corrected: str(x && x.corrected, 300), explanation_es: str(x && x.explanation_es, 300), rule: str(x && x.rule, 60) })).filter(x => x.original && x.corrected),
    better_phrases: arr(o && o.better_phrases, 4).map(x => ({ instead: str(x && x.instead, 200), try: str(x && x.try, 200) })).filter(x => x.try),
    next_steps_es: arr(o && o.next_steps_es, 4).map(x => str(x, 300)).filter(Boolean),
  };
}
