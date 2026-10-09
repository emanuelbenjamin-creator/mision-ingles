import { alignWords, words } from "./align.js";

/* Lógica pura de las historias con decisiones (la pantalla está en views/Historia.jsx). */

/** Qué opción quiso decir el alumno: la que más palabras comparte con lo que dijo, o -1 si ninguna se parece. */
export function matchChoice(choices, said, min = 50) {
  const n = words(said).length;
  if (!n) return -1;
  let best = -1, bestScore = 0;
  choices.forEach((c, i) => {
    // Se mide en los dos sentidos: decir media frase o agregar palabras no debe penalizar demasiado.
    const score = Math.max(alignWords(c, said).score, Math.min(100, alignWords(said, c).score));
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return bestScore >= min ? best : -1;
}

/** Escena de una historia sin IA: { narration, lines, choices, ending, ending_es } a partir de un nodo del árbol. */
export function treeScene(adventure, node) {
  const n = adventure.tree && adventure.tree[node];
  if (!n) return null;
  const base = node === "start" ? adventure.open : n;
  const options = n.choices || [];
  return { narration: base.narration, lines: base.lines || [], choices: options.map(c => c[0]), next: options.map(c => c[1]), ending: !options.length, ending_es: n.ending_es || "" };
}

/** Texto de una escena para mandarlo como historial al servidor. */
export const sceneText = (scene, cast) => [scene.narration, ...scene.lines.map(([who, text]) => `${cast[who].name}: "${text}"`)].join(" ");

/** Líneas con voz para reproducir una escena: primero el narrador, luego cada personaje. */
export function sceneLines(scene, cast, narrator) {
  const voice = c => ({ voice: c.voice, kokoroVoice: c.kokoroVoice, accent: c.accent, tone: c.tone, g: c.g });
  return [{ text: scene.narration, ...voice(narrator) }, ...scene.lines.map(([who, text]) => ({ text, ...voice(cast[who]) }))];
}
