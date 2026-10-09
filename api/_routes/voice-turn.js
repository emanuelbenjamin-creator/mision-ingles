import { endpoint, HttpError } from "../_lib/http.js";
import { generate } from "../_lib/gemini.js";
import { level, profession, scenarioById, liveSystem, str, IELTS_EXAMINER, FREE_TALK, TUTOR } from "../_lib/prompts.js";
import { KICKOFF } from "../../src/lib/live.js";
import { ECONOMY_CARDS_PROMPT, splitCards } from "../../src/lib/cards.js";

const SPECIAL = { ielts: IELTS_EXAMINER, free: FREE_TALK, tutor: TUTOR };
const clean = t => String(t).replace(/[*_#`>]+/g, "").replace(/\p{Extended_Pictographic}️?/gu, "").replace(/\s+/g, " ").trim();

/*
 * Modo de voz económico: un turno de la conversación por voz en texto (cualquier modelo de la
 * carrera gratuita: Gemini, Groq, Cerebras…). El navegador transcribe y lee la respuesta.
 * Devuelve { reply, cards }: las tarjetas en vivo llegan en un bloque «CARDS:» al final del texto.
 */
export default endpoint(async body => {
  const sc = SPECIAL[body.scenario] || scenarioById(body.scenario);
  const prof = body.profession && body.profession !== "general" ? profession(body.profession).en : "";
  const turns = (Array.isArray(body.turns) ? body.turns : []).slice(-20)
    .map(t => ({ role: t && t.role === "model" ? "model" : "user", text: str(t && t.text, 800) })).filter(t => t.text);
  if (turns.length && turns[turns.length - 1].role !== "user") throw new HttpError(400, "bad_turns", "Falta tu mensaje.");
  // Sin tarjetas en el examen IELTS ni en el saludo inicial (todavía no hay nada que corregir).
  const cards = body.cards !== false && sc.id !== "ielts" && turns.length > 0;
  const system = liveSystem(sc, level(body.level), { topic: body.topic, correction: body.correction, pace: body.pace, profession: prof, accent: body.accent, tone: body.tone })
    + "\nThis is a spoken conversation: reply with plain text to be read aloud (no markdown, no emojis, no stage directions), at most 3 short sentences."
    + (cards ? "\n" + ECONOMY_CARDS_PROMPT : "");
  const contents = [{ role: "user", text: KICKOFF }, ...turns];
  return generate({ system, contents, json: false, temperature: 0.7, validate: t => {
    const parts = splitCards(t);
    const reply = clean(parts.reply);
    if (!reply) throw new Error("vacío");
    return { reply: reply.slice(0, 600), cards: cards ? parts.cards : [] };
  } });
});
