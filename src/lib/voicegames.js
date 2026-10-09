import { alignWords, words } from "./align.js";

/* Puntajes de los juegos de voz. Funciones puras: reciben lo que se dijo (texto) y devuelven puntos. */

/** Trabalenguas: precisión (0–100) y un bono de hasta 50 por decirlo tan rápido como un nativo. */
export function twisterScore(target, said, seconds, nativeSecs) {
  const accuracy = alignWords(target, said).score;
  const speed = seconds > 0 ? Math.max(0, Math.min(1, nativeSecs / seconds)) : 0;
  // El bono de velocidad solo cuenta si se entendió casi todo: rápido y mal no gana.
  const bonus = accuracy >= 80 ? Math.round(speed * 50) : 0;
  return { accuracy, bonus, points: accuracy + bonus };
}

/** Contra reloj: cuenta palabras y variedad (palabras distintas). 2 puntos por palabra + 1 por palabra distinta. */
export function clockScore(said) {
  const w = words(said);
  const unique = new Set(w).size;
  return { words: w.length, unique, points: w.length * 2 + unique };
}

/** Adivinanza: ¿dijo la respuesta (o una alternativa)? Admite frases como «it's a cat». */
export function riddleRight(riddle, said) {
  const heard = " " + words(said).join(" ") + " ";
  return [riddle.answer, ...(riddle.alt || [])].some(a => heard.includes(" " + words(a).join(" ") + " "));
}

/** Eco veloz: pasa la ronda si repite al menos el 80 % de las palabras. Más puntos a mayor velocidad. */
export function echoScore(target, said, speed) {
  const accuracy = alignWords(target, said).score;
  const pass = accuracy >= 80;
  return { accuracy, pass, points: pass ? Math.round(accuracy * speed) : 0 };
}
