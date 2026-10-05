import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { ensureWeekSnap, weekStart, weeklyReport } from "../../src/lib/report.js";
import { addProfessionCards, defaultState, migrate } from "../../src/lib/state.js";
import { scenariosFor, todaysScenario, topicsFor } from "../../src/lib/missions.js";
import { PROFESSIONS } from "../../src/content/professions.js";
import lesson from "../../api/mistakes-lesson.js";
import chatTurn from "../../api/chat-turn.js";
import { _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";

function call(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "5.5.5.5" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}

describe("reporte semanal", () => {
  it("la semana empieza el lunes", () => {
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // lunes
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // domingo
    expect(weekStart("2026-10-01")).toBe("2026-09-28"); // jueves
  });
  it("compara con la semana anterior y resume la actividad", () => {
    const s = defaultState();
    s.xpByDay = { "2026-09-29": 50, "2026-09-30": 50, "2026-10-05": 60, "2026-10-07": 90 };
    s.missions = { "2026-10-05": ["speak", "pron"], "2026-10-07": ["grammar"] };
    s.sessions = [{ d: "2026-10-05", type: "speak" }, { d: "2026-10-07", type: "live", scores: { secs: 240 } }, { d: "2026-09-30", type: "speak" }];
    s.mistakes = [{ d: "2026-10-06", rule: "Edad" }, { d: "2026-10-07", rule: "Edad" }, { d: "2026-10-07", rule: "For vs since" }, { d: "2026-09-29", rule: "Otro" }];
    s.skills.gram = 70;
    s.skillSnap = { "2026-10-05": { gram: 60 } };
    const r = weeklyReport(s, "2026-10-08");
    expect(r).toMatchObject({ weekStart: "2026-10-05", xp: 150, xpPrev: 100, change: 50, daysPracticed: 2, missions: 3, speakMin: 5 });
    expect(r.bestDay).toEqual({ day: "2026-10-07", xp: 90 });
    expect(r.topErrors).toEqual([["Edad", 2], ["For vs since", 1]]);
    expect(r.deltas.find(d => d.key === "gram")).toMatchObject({ now: 70, delta: 10 });
    const prev = weeklyReport(s, "2026-10-08", -1);
    expect(prev).toMatchObject({ weekStart: "2026-09-28", xp: 100, daysPracticed: 2 });
  });
  it("ensureWeekSnap guarda una sola foto por semana", () => {
    const s = defaultState();
    s.skills.pron = 50;
    ensureWeekSnap(s, "2026-10-06");
    s.skills.pron = 90;
    ensureWeekSnap(s, "2026-10-08");
    expect(s.skillSnap["2026-10-05"].pron).toBe(50);
  });
});

describe("inglés por profesión", () => {
  it("agrega tarjetas, temas y escenarios de la profesión", () => {
    const s = defaultState();
    s.profile.profession = "contabilidad";
    const n = s.cards.length;
    expect(addProfessionCards(s)).toBe(PROFESSIONS.contabilidad.cards.length);
    expect(addProfessionCards(s)).toBe(0);
    expect(s.cards.length).toBe(n + PROFESSIONS.contabilidad.cards.length);
    expect(topicsFor(s).map(t => t.t)).toContain("Explain a recent tax change to a foreign client");
    expect(scenariosFor(s).map(x => x.id)).toContain("acc_client");
    expect(scenariosFor(s)).toContain(todaysScenario("2026-10-05", s));
  });
  it("migrate agrega la profesión por defecto", () => {
    expect(migrate({ profile: { name: "x" } }).profile.profession).toBe("general");
  });
  it("la API acepta los escenarios de profesión", async () => {
    _resetRateLimit();
    let sys;
    _setGenerator(({ system }) => { sys = system; return '{"reply":"Okay.","correction":null}'; });
    const r = await call(chatTurn, { scenario: "acc_cfo", turns: [{ role: "user", content: "Expenses went up because of the audit." }] });
    expect(r.status).toBe(200);
    expect(sys).toContain("CFO");
    _setGenerator(null);
  });
});

describe("lección con tus errores", () => {
  beforeEach(() => _resetRateLimit());
  afterEach(() => _setGenerator(null));
  const M = [1, 2, 3, 4].map(i => ({ wrong: "I have " + i + " years", right: "I am " + i + " years old", rule: "Edad" }));
  it("arma la lección y descarta ejercicios inválidos", async () => {
    _setGenerator(() => JSON.stringify({ summary_es: "Edad", patterns: [{ rule: "Edad", explanation_es: "to be", examples: ["I am 30."] }], exercises: [
      { s: "She ___ 25 years old.", o: ["is", "has"], a: 0, why: "to be" }, { s: "no gap", o: ["a", "b"], a: 0 }, { s: "He ___ 40.", o: ["is", "has"], a: 7 },
      { s: "I ___ 30.", o: ["am", "have"], a: 0 }, { s: "They ___ 20.", o: ["are", "have"], a: 0 }] }));
    const r = await call(lesson, { level: "B1", mistakes: M });
    expect(r.status).toBe(200);
    expect(r.body.exercises).toHaveLength(3);
    expect(r.body.patterns[0].rule).toBe("Edad");
  });
  it("pide al menos 3 errores", async () => {
    expect((await call(lesson, { mistakes: M.slice(0, 2) })).status).toBe(400);
  });
});
