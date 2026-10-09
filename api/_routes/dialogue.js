import { endpoint } from "../_lib/http.js";
import { generate, parseJson } from "../_lib/gemini.js";
import { COACH, level, profession, dialoguePrompt, normalizeDialogue } from "../_lib/prompts.js";
import { PAIRS } from "../../src/content/dialogues.js";
import { characterById } from "../../src/content/characters.js";
import { hash } from "../../src/lib/dates.js";

/* Diálogo nuevo a dos voces según nivel y profesión. La pareja de personajes la elige el servidor. */
export default endpoint(async body => {
  const seed = String(body.seed || "").slice(0, 40);
  const pair = PAIRS[hash(seed || "x") % PAIRS.length];
  const [a, b] = pair.map(characterById);
  const d = await generate({ system: COACH, contents: dialoguePrompt(level(body.level), profession(body.profession), a, b, seed), temperature: 0.9, validate: t => normalizeDialogue(parseJson(t)) });
  return { ...d, speakers: pair };
});
