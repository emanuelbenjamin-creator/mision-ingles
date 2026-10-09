/*
 * Tarjetas en vivo: durante la llamada el coach muestra en pantalla correcciones, palabras nuevas y
 * retos. Con Gemini Live llegan como llamadas a funciones; en el modo económico, como un bloque
 * «CARDS:» al final de la respuesta. En ambos casos pasan por normalizeCard (nunca se confía en el formato).
 */

const S = description => ({ type: "STRING", description });

/** Funciones que se declaran a Gemini Live (quedan fijadas en el token). */
export const LIVE_TOOLS = [
  { name: "show_correction", description: "Show a correction card on the learner's screen when they make a real mistake (grammar, wrong word or unnatural phrasing).",
    parameters: { type: "OBJECT", properties: { original: S("The learner's exact words with the mistake"), corrected: S("The natural, corrected version"), explanation_es: S("Explicación muy breve en español de la regla") }, required: ["original", "corrected"] } },
  { name: "show_word", description: "Show a vocabulary card when you teach or use a useful word or phrase the learner probably does not know.",
    parameters: { type: "OBJECT", properties: { word: S("The English word or short phrase"), meaning_es: S("Traducción al español en este contexto"), example: S("A short example sentence in English") }, required: ["word", "meaning_es"] } },
  { name: "give_challenge", description: "Show a small speaking challenge for the learner's next answer (for example: use a specific word, tense or connector).",
    parameters: { type: "OBJECT", properties: { challenge_es: S("El reto, en español y en una frase corta"), target: S("The English word or structure they must use") }, required: ["challenge_es"] } },
];

/** Instrucción para el modelo de voz en vivo sobre cuándo usar las funciones. */
export const LIVE_TOOLS_PROMPT = `SCREEN CARDS: you can put cards on the learner's screen with tools. Use them silently while the conversation continues, and never mention the tools or say that you are showing a card. Call show_correction for each real mistake the learner makes (at most one per turn). Call show_word when you use or teach a useful word they may not know. Call give_challenge about once every four turns to push them a little. Do not use cards for small details.`;

/** Lo mismo para el modo económico, donde las tarjetas van como texto al final de la respuesta. */
export const ECONOMY_CARDS_PROMPT = `After your spoken reply, add a new line that starts with "CARDS:" followed by a JSON array (possibly empty) of cards for the learner's screen. Card shapes: {"type":"correction","original":"learner's exact words","corrected":"natural version","explanation_es":"explicación breve"} for a real mistake in the learner's last message (at most one); {"type":"word","word":"useful English word you used","meaning_es":"traducción","example":"short example"}; {"type":"challenge","challenge_es":"reto corto en español","target":"English word or structure"} about once every four turns. Never read the cards aloud. Example last line: CARDS: []`;

const str = (x, max) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const TYPE_OF = { show_correction: "correction", show_word: "word", give_challenge: "challenge" };

/** Valida una tarjeta (viene del modelo). Devuelve la tarjeta limpia o null. */
export function normalizeCard(nameOrType, args) {
  const type = TYPE_OF[nameOrType] || nameOrType;
  const a = args && typeof args === "object" ? args : {};
  if (type === "correction") {
    const original = str(a.original, 200), corrected = str(a.corrected, 200);
    if (!original || !corrected || original.toLowerCase() === corrected.toLowerCase()) return null;
    return { type, original, corrected, explanation_es: str(a.explanation_es, 240) };
  }
  if (type === "word") {
    const word = str(a.word, 60), meaning_es = str(a.meaning_es, 120);
    if (!word || !meaning_es) return null;
    return { type, word, meaning_es, example: str(a.example, 200) };
  }
  if (type === "challenge") {
    const challenge_es = str(a.challenge_es, 200);
    if (!challenge_es) return null;
    return { type, challenge_es, target: str(a.target, 60) };
  }
  return null;
}

/** Identidad de una tarjeta, para no repetirla en la misma llamada. */
export const cardKey = c => `${c.type}|${(c.original || c.word || c.challenge_es).toLowerCase()}`;

/** Separa «respuesta hablada» y «CARDS: [...]» en la salida del modo económico. */
export function splitCards(text) {
  const t = String(text || "");
  const i = t.search(/\n?\s*CARDS\s*:/i);
  if (i < 0) return { reply: t, cards: [] };
  const tail = t.slice(i).replace(/^\s*CARDS\s*:/i, "");
  let cards = [];
  try {
    const a = tail.indexOf("["), b = tail.lastIndexOf("]");
    const raw = a >= 0 && b > a ? JSON.parse(tail.slice(a, b + 1)) : [];
    cards = (Array.isArray(raw) ? raw : []).slice(0, 3).map(c => normalizeCard(c && c.type, c)).filter(Boolean);
  } catch { /* tarjetas mal formadas: se ignoran y la respuesta sigue valiendo */ }
  return { reply: t.slice(0, i), cards };
}

/** Respuestas que hay que devolverle a Gemini Live por cada función que llamó. */
export const toolResponses = calls => (Array.isArray(calls) ? calls : []).map(fc => ({ id: fc.id, name: fc.name, response: { result: "shown" } }));
