import { endpoint } from "../_lib/http.js";
import { generate, parseJson } from "../_lib/gemini.js";
import { level, scenarioById, chatSystem, chatContents, normalizeChat } from "../_lib/prompts.js";

export default endpoint(async body => {
  const sc = scenarioById(body.scenario);
  const contents = chatContents(sc, body.turns);
  return normalizeChat(await generate({ system: chatSystem(sc, level(body.level)), contents, temperature: 0.7, validate: parseJson }));
});
