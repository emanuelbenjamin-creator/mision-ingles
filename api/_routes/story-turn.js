import { endpoint, HttpError } from "../_lib/http.js";
import { generate, parseJson } from "../_lib/gemini.js";
import { level, str } from "../_lib/prompts.js";
import { normalizeStory, storyPrompt } from "../_lib/story.js";
import { MAX_SCENES, adventureById } from "../../src/content/adventures.js";
import { characterById } from "../../src/content/characters.js";

/*
 * Historias con decisiones: la siguiente escena según lo que dijo el alumno.
 * Cuerpo: { story, level, say, history: [{ scene, say }] }. history trae las escenas ya jugadas y, al
 * final, la escena actual. La escena 1 es fija (está en el contenido): la primera llamada escribe la 2.
 */
export default endpoint(async body => {
  const adventure = adventureById(body.story);
  if (!adventure) throw new HttpError(400, "bad_story", "Historia desconocida.");
  const say = str(body.say, 300);
  if (!say) throw new HttpError(400, "empty", "Falta lo que dijiste.");
  const history = (Array.isArray(body.history) ? body.history : []).slice(-MAX_SCENES)
    .map(h => ({ scene: str(h && h.scene, 600), say: str(h && h.say, 300) })).filter(h => h.scene);
  if (!history.length) throw new HttpError(400, "bad_history", "Falta la escena actual.");
  const scene = Math.min(MAX_SCENES, history.length + 1);
  const cast = adventure.cast.map(characterById);
  const sys = "You write short, vivid interactive fiction for English learners. You always reply with valid JSON only.";
  return generate({ system: sys, contents: storyPrompt({ adventure, cast, lv: level(body.level), history, say, scene }), temperature: 0.9, validate: t => normalizeStory(parseJson(t), scene) });
});
