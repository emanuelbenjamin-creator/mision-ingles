import { endpoint, HttpError } from "../_lib/http.js";
import { generate } from "../_lib/gemini.js";
import { COACH, str, level, explainPrompt } from "../_lib/prompts.js";

export default endpoint(async body => {
  const options = Array.isArray(body.options) ? body.options.slice(0, 5).map(o => str(o, 80)) : [];
  const stem = str(body.stem, 300), correct = str(body.correct, 80), picked = str(body.picked, 80);
  if (!stem || options.length < 2 || !options.includes(correct) || !options.includes(picked)) throw new HttpError(400, "bad_exercise", "Ejercicio inválido.");
  const text = await generate({ system: COACH, contents: explainPrompt({ stem, options, correct, picked, lv: level(body.level) }), json: false, temperature: 0.3 });
  return { text: str(text, 1500) };
});
