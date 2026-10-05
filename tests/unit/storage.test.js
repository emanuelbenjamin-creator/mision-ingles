import { describe, expect, it } from "vitest";
import { defaultState, migrate } from "../../src/lib/state.js";
import { exportState, importState, loadState, saveState } from "../../src/lib/storage.js";
import { DECK } from "../../src/content/deck.js";

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe("guardado y copias de seguridad", () => {
  it("guarda y carga del almacenamiento local", () => {
    const st = memory(), s = defaultState();
    s.totalXP = 42;
    expect(saveState(s, st)).toBe(true);
    expect(loadState(st).totalXP).toBe(42);
  });
  it("sin almacenamiento o con datos corruptos usa el estado inicial", () => {
    expect(loadState(null).totalXP).toBe(0);
    const st = memory(); st.setItem("mision-ingles-v1", "{oops");
    expect(loadState(st).cards).toHaveLength(DECK.length);
  });
  it("exportar → importar conserva el progreso", () => {
    const s = defaultState();
    s.profile.name = "Ana"; s.xpByDay["2026-10-05"] = 30;
    const back = importState(exportState(s));
    expect(back.profile.name).toBe("Ana");
    expect(back.xpByDay["2026-10-05"]).toBe(30);
  });
  it("rechaza archivos que no son copias", () => {
    expect(() => importState("no json")).toThrow("JSON válido");
    expect(() => importState(JSON.stringify({ hello: 1 }))).toThrow("Misión Inglés");
  });
  it("migrate completa campos faltantes y agrega tarjetas nuevas del contenido", () => {
    const m = migrate({ profile: { name: "Leo" }, cards: [], xpByDay: [] });
    expect(m.profile).toMatchObject({ name: "Leo", level: "B1", dailyGoal: 50 });
    expect(m.xpByDay).toEqual({});
    expect(m.cards).toHaveLength(DECK.length);
  });
});
