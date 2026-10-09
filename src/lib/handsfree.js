import { alignWords, words } from "./align.js";
import { dueCards } from "./srs.js";
import { band } from "./level.js";
import { hash } from "./dates.js";
import { DICTATION } from "../content/dictation.js";

/*
 * Manos libres: una sesión solo por voz (para caminar o manejar). El coach dice una frase, tú la
 * repites y sigue. Se controla con comandos hablados. El bucle recibe `speak` y `listen` como
 * funciones, así se puede probar sin micrófono ni audio.
 */

const COMMANDS = {
  repeat: ["repeat", "again", "say it again", "one more time", "repite", "otra vez", "de nuevo"],
  slower: ["slower", "slow down", "more slowly", "mas lento", "más lento", "despacio", "mas despacio", "más despacio"],
  faster: ["faster", "speed up", "mas rapido", "más rápido"],
  next: ["next", "skip", "next one", "siguiente", "pasa", "saltar"],
  translate: ["translate", "translation", "what does it mean", "in spanish", "traduce", "traducir", "que significa", "qué significa"],
  stop: ["stop", "pause", "finish", "the end", "para", "parar", "terminar", "alto", "basta"],
};
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
const TABLE = Object.entries(COMMANDS).flatMap(([cmd, list]) => list.map(p => [norm(p), cmd]));

/**
 * ¿Lo que se oyó es un comando? Solo cuenta si la frase entera es el comando (con «please» opcional):
 * así «next week I will travel» se toma como práctica y no como «next».
 */
export function parseCommand(text) {
  const t = norm(text).replace(/^(please|por favor) | (please|por favor)$/g, "").trim();
  if (!t) return null;
  const hit = TABLE.find(([p]) => p === t);
  return hit ? hit[1] : null;
}

/**
 * Lista de práctica: primero las tarjetas que tocan hoy (con su ejemplo) y luego frases del nivel.
 * Cada elemento: { target (lo que hay que repetir), intro? (lo que el coach dice antes), es? (traducción) }.
 */
export function buildPlaylist(s, today, max = 10) {
  const items = [];
  for (const c of dueCards(s, today)) {
    if (items.length >= Math.ceil(max / 2)) break;
    const example = String(c.ex || "").trim();
    // Solo sirven las tarjetas con un ejemplo en inglés para repetir (las de errores traen una explicación en español).
    if (words(example).length < 3 || /[áéíóúñ¿¡]/i.test(example)) continue;
    items.push({ target: example, intro: `The word is: ${c.front}.`, es: c.back, card: c.id });
  }
  const list = DICTATION[band(s.profile.level)];
  const start = hash(today + "hf") % list.length;
  for (let i = 0; items.length < max && i < list.length; i++) items.push({ target: list[(start + i) % list.length] });
  return items;
}

/**
 * Corre la sesión. opts: { items, speak(text, { speed }), listen() → texto, onItem(i, item), onState(estado),
 * onScore(i, score), isStopped() }. Devuelve { done, scores, reason: "end" | "stop" | "silence" }.
 */
export async function runHandsFree({ items, speak, listen, onItem = () => {}, onState = () => {}, onScore = () => {}, isStopped = () => false }) {
  let speed = 1, silent = 0;
  const scores = [];
  const out = reason => ({ done: scores.length, scores, reason });
  await speak("Hands-free practice. Repeat each sentence after me. You can say: repeat, slower, next, translate, or stop.", { speed });
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onItem(i, item);
    let tries = 0, first = true;
    while (true) {
      if (isStopped()) return out("stop");
      onState("speaking");
      await speak((first && item.intro ? item.intro + " " : "") + item.target, { speed });
      first = false;
      if (isStopped()) return out("stop");
      onState("listening");
      const heard = await listen();
      if (isStopped()) return out("stop");
      const cmd = parseCommand(heard);
      if (cmd === "stop") { await speak("Okay. Well done today.", { speed }); return out("stop"); }
      if (cmd === "next") break;
      if (cmd === "repeat") continue;
      if (cmd === "slower") { speed = Math.max(0.7, speed - 0.15); continue; }
      if (cmd === "faster") { speed = Math.min(1.3, speed + 0.15); continue; }
      if (cmd === "translate") { await speak(item.es ? `In Spanish: ${item.es}.` : "Sorry, I don't have a translation for this one.", { speed }); continue; }
      if (!words(heard).length) {
        // Tres silencios seguidos: se asume que ya no está practicando y se corta para no gastar batería.
        if (++silent >= 3) { await speak("I can't hear you, so I'll stop here.", { speed }); return out("silence"); }
        if (++tries >= 2) break;
        continue;
      }
      silent = 0;
      const score = alignWords(item.target, heard).score;
      if (score >= 70 || ++tries >= 2) {
        scores.push(score);
        onScore(i, score);
        onState("speaking");
        await speak(score >= 90 ? "Perfect." : score >= 70 ? "Good." : "Let's move on.", { speed });
        break;
      }
      onState("speaking");
      await speak("Almost. Listen again.", { speed });
    }
  }
  if (!isStopped()) await speak("That's all for now. Great work!", { speed });
  return out("end");
}
