import { GRAMMAR } from "../content/grammar.js";

/* Prueba de nivel rápida: 8 preguntas de dificultad creciente tomadas de la biblioteca de gramática. */
const PICKS = [["pres", 0], ["past", 0], ["comp", 2], ["fut", 1], ["pp", 1], ["cond", 1], ["pass", 0], ["cond3", 1]];

export const PLACEMENT = PICKS.map(([id, i]) => {
  const g = GRAMMAR.find(x => x.id === id);
  return { ...g.qs[i], lv: g.lv, topic: g.name };
});

/** Nivel sugerido según respuestas correctas (0–8). C1 se alcanza con el uso, no con esta prueba. */
export function levelFromScore(correct) {
  if (correct <= 2) return "A1";
  if (correct <= 4) return "A2";
  if (correct <= 6) return "B1";
  return "B2";
}
