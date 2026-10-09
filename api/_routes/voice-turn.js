import { endpoint, HttpError } from "../_lib/http.js";
import { generate } from "../_lib/gemini.js";
import { level, profession, scenarioById, liveSystem, str, IELTS_EXAMINER, FREE_TALK, TUTOR } from "../_lib/prompts.js";
import { KICKOFF } from "../../src/lib/live.js";

const SPECIAL = { ielts: IELTS_EXAMINER, free: FREE_TALK, tutor: TUTOR };
const clean = t => String(t).replace(/[*_#`>]+/g, "").replace(/\p{Extended_Pictographic}\uFE0F?/gu, "").replace(/\s+/g, " ").trim();

/*
 * Modo de voz económico: un turno de la conversación por voz en texto (cualquier modelo de la
 * carrera gratuita: Gemini, Groq, Cerebras…). El navegador transcribe y lee la respuesta.
 */
export default endpoint(async body => {
  const sc = SPECIAL[body.scenario] || scenarioById(body.scenario);
  const prof = body.profession && body.profession !== "general" ? profession(body.profession).en : "";
  const system = liveSystem(sc, level(body.level), { topic: body.topic, correction: body.correction, pace: body.pace, profession: prof, accent: body.accent, tone: body.tone })
    + "\nThis is a spoken conversation: reply with plain text to be read aloud (no markdown, no emojis, no stage directions), at most 3 short sentences.";
  const turns = (Array.isArray(body.turns) ? body.turns : []).slice(-20)
    .map(t => ({ role: t && t.role === "model" ? "model" : "user", text: str(t && t.text, 800) })).filter(t => t.text);
  if (turns.length && turns[turns.length - 1].role !== "user") throw new HttpError(400, "bad_turns", "Falta tu mensaje.");
  const contents = [{ role: "user", text: KICKOFF }, ...turns];
  const reply = await generate({ system, contents, json: false, temperature: 0.7, validate: t => { const c = clean(t); if (!c) throw new Error("vacío"); return c.slice(0, 600); } });
  return { reply };
});
