import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import storyTurn from "../../api/_routes/story-turn.js";
import { normalizeStory } from "../../api/_lib/story.js";
import { _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";
import { ADVENTURES, MAX_SCENES, adventureById } from "../../src/content/adventures.js";
import { CHARACTERS, characterById } from "../../src/content/characters.js";
import { CLOCK_QUESTIONS, ECHO, RIDDLES, TWISTERS } from "../../src/content/games.js";
import { matchChoice, sceneLines, sceneText, treeScene } from "../../src/lib/story.js";
import { clockScore, echoScore, riddleRight, twisterScore } from "../../src/lib/voicegames.js";
import { buildPlaylist, parseCommand, runHandsFree } from "../../src/lib/handsfree.js";
import { PLAY_XP_CAP, addPlayXP, setRecord } from "../../src/lib/game.js";
import { defaultState, migrate } from "../../src/lib/state.js";

const T = "2026-10-09";
function call(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "7.7.7.7" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}

describe("historias con decisiones", () => {
  beforeEach(() => _resetRateLimit());
  afterEach(() => _setGenerator(null));

  it("4 aventuras con dos personajes reales y una primera escena con 3 opciones", () => {
    expect(ADVENTURES).toHaveLength(4);
    for (const a of ADVENTURES) {
      a.cast.forEach(id => expect(CHARACTERS[id], id).toBeTruthy());
      expect(a.open.choices).toHaveLength(3);
      expect(a.open.narration.length).toBeGreaterThan(20);
    }
  });
  it("la historia sin IA no tiene callejones: todo camino llega a un final en pocas escenas", () => {
    const a = adventureById("airport");
    const walk = (node, depth) => {
      expect(depth).toBeLessThanOrEqual(MAX_SCENES);
      const sc = treeScene(a, node);
      expect(sc, node).toBeTruthy();
      if (sc.ending) { expect(sc.ending_es.length).toBeGreaterThan(20); return; }
      expect(sc.choices.length).toBeGreaterThanOrEqual(2);
      sc.next.forEach(n => walk(n, depth + 1));
    };
    walk("start", 1);
    expect(treeScene(a, "start").narration).toBe(a.open.narration);
    expect(treeScene(adventureById("mystery"), "start")).toBeNull();
  });
  it("reconoce la opción que dijo el alumno aunque no sea exacta", () => {
    const choices = ["No, my suitcase is missing too.", "Excuse me, where is the airline desk?", "I don't have time, I have to run to my gate."];
    expect(matchChoice(choices, "excuse me where is the airline desk")).toBe(1);
    expect(matchChoice(choices, "my suitcase is missing")).toBe(0);
    expect(matchChoice(choices, "I have to run to my gate")).toBe(2);
    expect(matchChoice(choices, "I like pizza")).toBe(-1);
    expect(matchChoice(choices, "")).toBe(-1);
  });
  it("arma el texto y las voces de una escena: narrador primero, luego cada personaje", () => {
    const a = adventureById("airport"), cast = a.cast.map(characterById), narrator = characterById("narrator");
    const sc = treeScene(a, "calm");
    const lines = sceneLines(sc, cast, narrator);
    expect(lines.map(l => l.voice)).toEqual([narrator.voice, cast[0].voice, cast[1].voice]);
    expect(sceneText(sc, cast)).toContain('Hannah: "I completely understand.');
  });
  it("story-turn escribe la escena siguiente con el historial y corrige al alumno", async () => {
    let prompt;
    _setGenerator(({ contents }) => { prompt = contents; return JSON.stringify({ narration: "You walk to the desk.", lines: [{ who: 1, text: "Good luck!" }, { who: 5, text: "Next, please." }, { who: 0, text: "extra" }], choices: ["A", "B", "C", "D"], correction: { corrected: "My suitcase is lost.", explanation_es: "Se dice «is lost»." }, ending: false }); });
    const r = await call(storyTurn, { story: "airport", level: "A2", say: "My suitcase lost", history: [{ scene: "You are at the belt.", say: "" }] });
    expect(r.status).toBe(200);
    expect(r.body.lines).toEqual([[1, "Good luck!"], [0, "Next, please."]]);
    expect(r.body.choices).toEqual(["A", "B", "C"]);
    expect(r.body.correction.corrected).toBe("My suitcase is lost.");
    expect(r.body.ending).toBe(false);
    expect(prompt).toContain("scene 2 of " + MAX_SCENES);
    expect(prompt).toContain('THE LEARNER NOW SAYS: "My suitcase lost"');
    expect(prompt).toContain("Hannah");
  });
  it("la última escena siempre cierra la historia, y valida lo que llega", async () => {
    _setGenerator(() => JSON.stringify({ narration: "You board the plane.", lines: [], choices: ["x", "y", "z"], ending: false, ending_es: "Lo lograste." }));
    const history = Array.from({ length: MAX_SCENES - 1 }, (_, i) => ({ scene: "Scene " + i, say: "ok" }));
    const r = await call(storyTurn, { story: "pitch", say: "Deal!", history });
    expect(r.body).toMatchObject({ ending: true, choices: [], ending_es: "Lo lograste." });
    expect((await call(storyTurn, { story: "nope", say: "hi", history })).status).toBe(400);
    expect((await call(storyTurn, { story: "pitch", say: "", history })).status).toBe(400);
    expect((await call(storyTurn, { story: "pitch", say: "hi", history: [] })).status).toBe(400);
    expect(() => normalizeStory({ narration: "x", choices: ["only one"] }, 2)).toThrow();
    expect(() => normalizeStory({ choices: ["a", "b"] }, 2)).toThrow();
  });
});

describe("juegos de voz", () => {
  it("el contenido está completo en las tres bandas", () => {
    expect(TWISTERS.length).toBeGreaterThanOrEqual(8);
    for (const b of ["A", "B", "C"]) {
      expect(CLOCK_QUESTIONS[b].length).toBeGreaterThanOrEqual(5);
      expect(RIDDLES[b].length).toBeGreaterThanOrEqual(5);
      expect(ECHO[b].length).toBeGreaterThanOrEqual(3);
      // Ninguna pista dice su propia respuesta.
      for (const r of RIDDLES[b]) expect(riddleRight(r, r.clue), r.answer).toBe(false);
    }
  });
  it("trabalenguas: la velocidad solo suma si se entendió", () => {
    const t = "She sells seashells by the seashore.";
    expect(twisterScore(t, "she sells seashells by the seashore", 3, 3)).toEqual({ accuracy: 100, bonus: 50, points: 150 });
    expect(twisterScore(t, "she sells seashells by the seashore", 6, 3).bonus).toBe(25);
    expect(twisterScore(t, "she shells", 1, 3)).toMatchObject({ bonus: 0 });
    expect(twisterScore(t, "", 0, 3).points).toBe(0);
  });
  it("contra reloj cuenta palabras y variedad", () => {
    expect(clockScore("I like like like pizza")).toEqual({ words: 5, unique: 3, points: 13 });
    expect(clockScore("").points).toBe(0);
  });
  it("adivinanza acepta la respuesta dentro de una frase y sus alternativas", () => {
    const r = { clue: "x", answer: "check in", alt: ["checking in"] };
    expect(riddleRight(r, "You check in")).toBe(true);
    expect(riddleRight(r, "I think it's checking in!")).toBe(true);
    expect(riddleRight(r, "check out")).toBe(false);
    expect(riddleRight({ answer: "cat" }, "category")).toBe(false);
  });
  it("eco veloz: pasa con 80 % y da más puntos a mayor velocidad", () => {
    const t = "I should have called you earlier.";
    expect(echoScore(t, "I should have called you earlier", 1.2)).toEqual({ accuracy: 100, pass: true, points: 120 });
    expect(echoScore(t, "I should called", 1)).toMatchObject({ pass: false, points: 0 });
  });
  it("el XP de juegos tiene tope diario y los récords solo suben", () => {
    const s = defaultState();
    addPlayXP(s, 30, T, "Juego");
    addPlayXP(s, 30, T, "Juego");
    expect(s.xpByDay[T]).toBe(PLAY_XP_CAP);
    expect(addPlayXP(s, 5, T, "Juego")[0]).toMatch(/tope/);
    expect(s.xpByDay[T]).toBe(PLAY_XP_CAP);
    addPlayXP(s, 5, "2026-10-10", "Juego");
    expect(s.xpByDay["2026-10-10"]).toBe(5);
    expect(setRecord(s, "echo", 120)).toBe(true);
    expect(setRecord(s, "echo", 90)).toBe(false);
    expect(s.games.echo).toBe(120);
  });
});

describe("manos libres", () => {
  it("un comando es la frase entera, en inglés o español", () => {
    expect(parseCommand("Next")).toBe("next");
    expect(parseCommand("slower, please")).toBe("slower");
    expect(parseCommand("Más lento")).toBe("slower");
    expect(parseCommand("repite")).toBe("repeat");
    expect(parseCommand("say it again")).toBe("repeat");
    expect(parseCommand("¿Qué significa?")).toBe("translate");
    expect(parseCommand("STOP.")).toBe("stop");
    expect(parseCommand("next week I will travel")).toBeNull();
    expect(parseCommand("please stop the car")).toBeNull();
    expect(parseCommand("")).toBeNull();
  });
  it("la lista mezcla tarjetas con ejemplo en inglés y frases del nivel", () => {
    const s = defaultState();
    const list = buildPlaylist(s, T, 10);
    expect(list).toHaveLength(10);
    expect(list.filter(x => x.card).length).toBeLessThanOrEqual(5);
    expect(new Set(list.map(x => x.target)).size).toBe(10);
    for (const x of list) expect(x.target).not.toMatch(/[áéíóúñ¿¡]/i);
  });

  const items = [{ target: "I usually get up at seven.", intro: "The word is: usually.", es: "normalmente" }, { target: "The bus stop is next to the bank." }];
  function session(heard) {
    const said = [], states = [], scores = [];
    const queue = [...heard];
    const run = runHandsFree({ items, speak: async (text, o) => { said.push([text, o.speed]); }, listen: async () => (queue.length ? queue.shift() : ""), onState: x => states.push(x), onScore: (i, v) => scores.push([i, v]) });
    return run.then(r => ({ r, said, states, scores }));
  }
  it("repite cada frase, la califica y termina", async () => {
    const { r, said, scores } = await session(["I usually get up at seven", "the bus stop is next to the bank"]);
    expect(r).toMatchObject({ done: 2, reason: "end", scores: [100, 100] });
    expect(scores).toEqual([[0, 100], [1, 100]]);
    expect(said[1][0]).toBe("The word is: usually. I usually get up at seven.");
    expect(said.map(x => x[0])).toContain("Perfect.");
    expect(said.at(-1)[0]).toMatch(/Great work/);
  });
  it("obedece los comandos: más lento, repetir, traducir, siguiente y parar", async () => {
    const { r, said } = await session(["slower", "translate", "repeat", "next", "stop"]);
    expect(r).toMatchObject({ done: 0, reason: "stop" });
    const texts = said.map(x => x[0]);
    expect(texts).toContain("In Spanish: normalmente.");
    // Tras «slower» la misma frase vuelve más lenta y ya sin la introducción.
    expect(said[2]).toEqual(["I usually get up at seven.", 0.85]);
    expect(texts).toContain("The bus stop is next to the bank.");
    expect(texts.at(-1)).toMatch(/Well done/);
  });
  it("da un segundo intento y sigue; con tres silencios se detiene", async () => {
    const two = await session(["I get seven", "I usually get up", "the bus stop is next to the bank"]);
    expect(two.said.map(x => x[0])).toContain("Almost. Listen again.");
    expect(two.r.done).toBe(2);
    expect(two.r.scores[0]).toBeLessThan(70);
    const quiet = await session([]);
    expect(quiet.r).toMatchObject({ done: 0, reason: "silence" });
  });
  it("se puede detener desde fuera", async () => {
    let stop = false;
    const r = await runHandsFree({ items, speak: async () => {}, listen: async () => { stop = true; return "anything"; }, isStopped: () => stop });
    expect(r.reason).toBe("stop");
  });
});

describe("estado v3", () => {
  it("un progreso guardado antes de la v3 recibe los campos nuevos sin perder nada", () => {
    const old = { profile: { name: "Ana", level: "B2", accent: "uk", voice: "Leda" }, totalXP: 320, games: "roto", stories: null };
    const s = migrate(old);
    expect(s.profile).toMatchObject({ name: "Ana", level: "B2", accent: "uk", voice: "Leda", tone: "friendly", liveVoiceMode: "character", liveCards: true });
    expect(s.totalXP).toBe(320);
    expect(s.games).toEqual({});
    expect(s.playXP).toEqual({});
    expect(s.stories).toEqual([]);
  });
});
