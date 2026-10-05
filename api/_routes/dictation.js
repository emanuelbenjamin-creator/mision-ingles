import { endpoint } from "../_lib/http.js";
import { generate, parseJson } from "../_lib/gemini.js";
import { COACH, str, level, profession, dictationPrompt } from "../_lib/prompts.js";

export default endpoint(async body => {
  const o = await generate({ system: COACH, contents: dictationPrompt(level(body.level), profession(body.profession)), temperature: 0.9, validate: parseJson });
  const sentences = (Array.isArray(o && o.sentences) ? o.sentences : []).map(x => str(x, 200)).filter(x => x.split(" ").length >= 3).slice(0, 5);
  return { sentences };
});
