import { SPEAK_TOPICS } from "../content/topics.js";
import { SOUNDS } from "../content/sounds.js";
import { SCENARIOS } from "../content/scenarios.js";
import { GRAMMAR } from "../content/grammar.js";
import { hash } from "./dates.js";
import { band, levelIdx } from "./level.js";
import { dueCards } from "./srs.js";

/* Las misiones del día dependen solo de la fecha y del nivel: son las mismas toda la jornada. */

export const todaysTopic = (s, today, offset = 0) => { const l = SPEAK_TOPICS[band(s.profile.level)]; return l[(hash(today + "speak") + offset) % l.length]; };
export const todaysSound = today => SOUNDS[hash(today + "sound") % SOUNDS.length];
export const todaysScenario = today => SCENARIOS[hash(today + "scen") % SCENARIOS.length];

export function todaysGrammar(s, today) {
  const max = levelIdx(s.profile.level);
  const pool = GRAMMAR.filter(g => levelIdx(g.lv) <= Math.max(max, 1));
  const pending = pool.filter(g => !(s.grammar[g.id] >= 75));
  const list = pending.length ? pending : pool;
  return list[hash(today + "gram") % list.length];
}

export function missionList(s, today) {
  const sound = todaysSound(today), g = todaysGrammar(s, today), sc = todaysScenario(today), tp = todaysTopic(s, today);
  const due = dueCards(s, today).length;
  return [
    { id: "speak", icon: "mic", title: "Habla 60 segundos", sub: tp.t, go: { tab: "hablar", mode: "speak" } },
    { id: "pron", icon: "ear", title: "Pronunciación: " + sound.name, sub: sound.ipa + " · 3 frases para imitar", go: { tab: "hablar", mode: "pron", sound: sound.id } },
    { id: "grammar", icon: "book", title: "Gramática: " + g.name, sub: "Explicación + 4 ejercicios · nivel " + g.lv, go: { tab: "gramatica", topic: g.id } },
    { id: "review", icon: "cards", title: "Repasa tus tarjetas", sub: due ? `${due} tarjetas listas para hoy` : "Nada pendiente: ¡al día!", go: { tab: "repaso" } },
    { id: "chat", icon: "chat", title: "Bonus · Conversación", sub: sc.name + " · 4 intercambios o 1 min de voz", go: { tab: "conversar", scen: sc.id }, bonus: true },
    { id: "dictation", icon: "headphones", title: "Bonus · Dictado", sub: "Escucha 5 frases y escríbelas", go: { tab: "leer", leerMode: "dictado" }, bonus: true },
    { id: "reading", icon: "book", title: "Bonus · Lectura", sub: "Una historia corta de tu nivel + 3 preguntas", go: { tab: "leer", leerMode: "lectura" }, bonus: true },
  ];
}
