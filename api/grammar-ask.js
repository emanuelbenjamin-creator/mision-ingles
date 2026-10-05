import { endpoint } from "./_lib/http.js";
import { generate } from "./_lib/gemini.js";
import { COACH, str, level, required, askPrompt } from "./_lib/prompts.js";

export default endpoint(async body => {
  const q = str(body.question, 1500);
  required(q, 2, "La pregunta");
  const text = await generate({ system: COACH, contents: askPrompt(q, level(body.level)), json: false, temperature: 0.4 });
  return { text: String(text).trim().slice(0, 3000) };
});
