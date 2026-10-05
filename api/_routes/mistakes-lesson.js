import { endpoint, HttpError } from "../_lib/http.js";
import { generate, parseJson } from "../_lib/gemini.js";
import { COACH, str, level, lessonPrompt, normalizeLesson } from "../_lib/prompts.js";

/* Lección personalizada a partir de los errores guardados en el cuaderno. */
export default endpoint(async body => {
  const mistakes = (Array.isArray(body.mistakes) ? body.mistakes : []).slice(0, 15)
    .map(m => ({ wrong: str(m && m.wrong, 200), right: str(m && m.right, 200), rule: str(m && m.rule, 60) })).filter(m => m.wrong && m.right);
  if (mistakes.length < 3) throw new HttpError(400, "too_few", "Necesitas al menos 3 errores guardados para crear tu lección.");
  return generate({ system: COACH, contents: lessonPrompt(level(body.level), mistakes), temperature: 0.4, validate: t => normalizeLesson(parseJson(t)) });
});
