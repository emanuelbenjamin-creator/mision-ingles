import { HttpError } from "./http.js";
import { str } from "./prompts.js";
import { MAX_SCENES } from "../../src/content/adventures.js";

/* Historias con decisiones: prompt y normalización de cada escena. */

const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);

/** history: [{ scene: "narración + líneas", say }] con la escena actual al final; say: lo que el alumno responde ahora. */
export function storyPrompt({ adventure, cast, lv, history, say, scene }) {
  const last = scene >= MAX_SCENES;
  const past = history.map((h, i) => `SCENE ${i + 1}: ${h.scene}` + (i < history.length - 1 ? `\nLEARNER SAID: ${h.say}` : "")).join("\n\n");
  return `You are the game master of an interactive spoken story for an English learner (native Spanish speaker, CEFR ${lv}).
STORY: ${adventure.premise}
Character 0 is ${cast[0].name} and character 1 is ${cast[1].name}. The learner is the main character and decides what happens by speaking.

SO FAR:
${past || "(the story has just started)"}

THE LEARNER NOW SAYS: "${say}"

Write scene ${scene} of ${MAX_SCENES}. React to what the learner said: their words must change what happens. Use vocabulary and grammar for CEFR ${lv}.${last ? " This is the FINAL scene: bring the story to a satisfying end that depends on the learner's choices." : ""}
Reply with ONLY a JSON object:
{"narration":"1-2 sentences in the second person and present tense (You ...), max 35 words","lines":[{"who":0,"text":"what that character says, max 25 words"}],"choices":["something the learner could SAY next, max 12 words","...","..."],"correction":null,"ending":${last ? "true" : "false"},"ending_es":"${last ? "2 frases en español: cómo terminó la historia y qué hizo bien el alumno" : ""}"}
Rules: 1 or 2 lines, "who" is 0 or 1. ${last ? 'Use "choices":[] in the final scene.' : "Exactly 3 choices that lead to different outcomes; write them as natural spoken sentences."} If the learner's sentence has a real mistake (grammar, wrong word), set "correction" to {"corrected":"their sentence, corrected and natural","explanation_es":"explicación breve en español"}; otherwise null. If they spoke Spanish, put the English version of what they meant in "corrected". Never write the character's name inside "text".`;
}

export function normalizeStory(o, scene) {
  const narration = str(o && o.narration, 320);
  const lines = arr(o && o.lines, 2).map(l => [Number(l && l.who) === 1 ? 1 : 0, str(l && l.text, 240)]).filter(l => l[1]);
  const ending = scene >= MAX_SCENES || !!(o && o.ending === true);
  const choices = ending ? [] : arr(o && o.choices, 3).map(c => str(c, 120)).filter(Boolean);
  if (!narration || (!ending && choices.length < 2)) throw new HttpError(502, "invalid_json", "La escena llegó incompleta. Inténtalo otra vez.");
  const c = o && o.correction;
  return {
    narration, lines, choices, ending,
    ending_es: ending ? str(o && o.ending_es, 400) || "Fin de la historia." : "",
    correction: c && c.corrected ? { corrected: str(c.corrected, 300), explanation_es: str(c.explanation_es, 300) } : null,
  };
}
