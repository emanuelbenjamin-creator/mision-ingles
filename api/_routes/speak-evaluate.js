import { endpoint } from "../_lib/http.js";
import { generate, parseJson } from "../_lib/gemini.js";
import { COACH, str, level, goal, required, speakPrompt, normalizeSpeak } from "../_lib/prompts.js";

export default endpoint(async body => {
  const text = str(body.text, 4000);
  required(text, 15, "Tu respuesta");
  const seconds = Math.round(Number(body.seconds)) || null;
  const prompt = speakPrompt({ text, topic: str(body.topic, 200), lv: level(body.level), goalName: goal(body.goal), seconds });
  return normalizeSpeak(await generate({ system: COACH, contents: prompt, temperature: 0.3, validate: parseJson }));
});
