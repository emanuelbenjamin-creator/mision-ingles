import { describe, expect, it } from "vitest";
import { defaultState } from "../../src/lib/state.js";
import { addXP, addMistake, bumpSkill, completeMission, missionDone, streak, MISSION_XP } from "../../src/lib/game.js";
import { missionList, todaysGrammar, todaysScenario, todaysSound, todaysTopic } from "../../src/lib/missions.js";
import { levelProgress } from "../../src/lib/level.js";
import { addDays } from "../../src/lib/dates.js";

const T = "2026-10-05";

describe("XP y racha", () => {
  it("la racha cuenta días seguidos y no se rompe si hoy aún no practicas", () => {
    const s = defaultState();
    s.xpByDay = { "2026-10-02": 10, "2026-10-03": 20, "2026-10-04": 5 };
    expect(streak(s, T)).toBe(3);
    s.xpByDay[T] = 15;
    expect(streak(s, T)).toBe(4);
    delete s.xpByDay["2026-10-03"];
    expect(streak(s, T)).toBe(2);
  });
  it("cruza fin de mes", () => {
    const s = defaultState();
    s.xpByDay = { "2026-09-30": 5, "2026-10-01": 5 };
    expect(streak(s, "2026-10-01")).toBe(2);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("avisa al cumplir la meta y da gemas", () => {
    const s = defaultState();
    const msgs = addXP(s, 50, T, "test");
    expect(s.gems).toBe(10);
    expect(msgs).toContain("¡Meta diaria cumplida! Tu racha suma un día.");
    expect(msgs).toContain("Logro desbloqueado: Primera misión");
    expect(addXP(s, 10, T)).not.toContain("¡Meta diaria cumplida! Tu racha suma un día.");
  });
  it("una misión da su XP una sola vez al día; repetirla da 5", () => {
    const s = defaultState();
    completeMission(s, "speak", "Habla", T);
    expect(missionDone(s, "speak", T)).toBe(true);
    expect(s.xpByDay[T]).toBe(MISSION_XP.speak);
    completeMission(s, "speak", "Habla", T);
    expect(s.xpByDay[T]).toBe(MISSION_XP.speak + 5);
  });
});

describe("cuaderno de errores", () => {
  it("guarda el error y crea una tarjeta, sin duplicados", () => {
    const s = defaultState(), n = s.cards.length;
    expect(addMistake(s, { wrong: "I have 30 years", right: "I am 30 years old", why: "x", rule: "Edad" }, T)).toBe(true);
    expect(addMistake(s, { wrong: "i have 30 years ", right: "I am 30 years old" }, T)).toBe(false);
    expect(addMistake(s, { wrong: "same", right: "Same" }, T)).toBe(false);
    expect(s.mistakes).toHaveLength(1);
    expect(s.cards).toHaveLength(n + 1);
    expect(s.cards.at(-1)).toMatchObject({ tag: "mi error", back: "I am 30 years old", reps: 0 });
  });
});

describe("habilidades", () => {
  it("promedio móvil 70/30 y límites 0–100", () => {
    const s = defaultState();
    bumpSkill(s, "pron", 80); expect(s.skills.pron).toBe(80);
    bumpSkill(s, "pron", 40); expect(s.skills.pron).toBe(68);
    bumpSkill(s, "flu", 250); expect(s.skills.flu).toBe(100);
    bumpSkill(s, "gram", "abc"); expect(s.skills.gram).toBe(null);
  });
});

describe("misiones del día", () => {
  it("son estables durante el día y dependen del nivel", () => {
    const s = defaultState();
    expect(todaysTopic(s, T)).toBe(todaysTopic(s, T));
    expect(todaysSound(T)).toBe(todaysSound(T));
    expect(todaysScenario(T)).toBe(todaysScenario(T));
    const b = todaysTopic(s, T).t;
    s.profile.level = "A1";
    expect(todaysTopic(s, T).t).not.toBe(undefined);
    s.profile.level = "B1";
    expect(todaysTopic(s, T).t).toBe(b);
  });
  it("la gramática del día prioriza temas no dominados y no supera el nivel", () => {
    const s = defaultState();
    s.profile.level = "A2";
    for (let i = 0; i < 30; i++) expect(["A1", "A2"]).toContain(todaysGrammar(s, addDays(T, i)).lv);
    s.grammar = { pres: 100, past: 100, comp: 100 };
    expect(todaysGrammar(s, T).id).toBe("fut");
  });
  it("lista 4 misiones principales y 1 bonus", () => {
    const ms = missionList(defaultState(), T);
    expect(ms.map(m => m.id)).toEqual(["speak", "pron", "grammar", "review", "chat"]);
    expect(ms.filter(m => m.bonus)).toHaveLength(1);
  });
  it("el avance de nivel empieza en 0 y crece", () => {
    const s = defaultState();
    expect(levelProgress(s)).toBe(0);
    s.grammar = { pp: 100, for: 100 };
    s.skills = { pron: 80, flu: 80, gram: 80, vocab: 80 };
    expect(levelProgress(s)).toBeGreaterThan(40);
  });
});
