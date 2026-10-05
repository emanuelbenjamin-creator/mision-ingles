import { endpoint, HttpError } from "./_lib/http.js";
import { generate, parseJson } from "./_lib/gemini.js";
import { COACH, str, level, scenarioById, reviewPrompt, normalizeReview, IELTS_EXAMINER } from "./_lib/prompts.js";

/* Revisión de una conversación por voz: correcciones y puntajes a partir de la transcripción. */
export default endpoint(async body => {
  const sc = body.scenario === "ielts" ? IELTS_EXAMINER : scenarioById(body.scenario);
  const turns = (Array.isArray(body.turns) ? body.turns : []).slice(-60).map(t => ({ role: t && t.role === "user" ? "user" : "model", text: str(t && t.text, 1500) })).filter(t => t.text);
  if (!turns.some(t => t.role === "user")) throw new HttpError(400, "empty", "No hay nada tuyo que revisar todavía.");
  return normalizeReview(await generate({ system: COACH, contents: reviewPrompt(sc, level(body.level), turns), temperature: 0.3, validate: parseJson }));
});
