import { endpoint } from "../_lib/http.js";
import { generate, parseJson } from "../_lib/gemini.js";
import { COACH, level, profession, readingPrompt, normalizeReading } from "../_lib/prompts.js";

/* Lectura graduada nueva según nivel y profesión. */
export default endpoint(async body => {
  const seed = String(body.seed || "").slice(0, 40);
  return generate({ system: COACH, contents: readingPrompt(level(body.level), profession(body.profession), seed), temperature: 0.9, validate: t => normalizeReading(parseJson(t)) });
});
