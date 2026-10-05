import { endpoint } from "./_lib/http.js";
import { generate, parseJson } from "./_lib/gemini.js";
import { COACH, str, level, scenarioById, suggestPrompt } from "./_lib/prompts.js";

export default endpoint(async body => {
  const sc = scenarioById(body.scenario);
  const o = await generate({ system: COACH, contents: suggestPrompt(sc, level(body.level), str(body.last, 600)), temperature: 0.8, validate: parseJson });
  const list = Array.isArray(o) ? o : (o && o.suggestions) || [];
  return { suggestions: list.slice(0, 3).map(s => str(s, 200)).filter(Boolean) };
});
