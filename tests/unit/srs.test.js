import { describe, expect, it } from "vitest";
import { dueCards, schedule, ivlLabel, learnedCount, NEW_PER_DAY } from "../../src/lib/srs.js";
import { defaultState } from "../../src/lib/state.js";

const T = "2026-10-05";
const card = (o = {}) => ({ id: "x", front: "a", back: "b", tag: "t", due: null, ivl: 0, ease: 2.5, reps: 0, lapses: 0, ...o });

describe("repaso espaciado", () => {
  it("una tarjeta nueva con «Bien» vuelve mañana y luego a los 3 días", () => {
    const a = schedule(card(), 2, T);
    expect(a).toMatchObject({ ivl: 1, reps: 1, due: "2026-10-06" });
    const b = schedule(a, 2, "2026-10-06");
    expect(b).toMatchObject({ ivl: 3, due: "2026-10-09" });
    const c = schedule(b, 2, "2026-10-09");
    expect(c.ivl).toBe(Math.round(3 * 2.5));
  });
  it("«Otra vez» la deja para hoy y baja la facilidad", () => {
    const a = schedule(card({ reps: 3, ivl: 10 }), 0, T);
    expect(a).toMatchObject({ ivl: 0, due: T, lapses: 1, ease: 2.3 });
  });
  it("«Fácil» da intervalos más largos que «Bien»", () => {
    const c = card({ reps: 2, ivl: 3 });
    expect(schedule(c, 3, T).ivl).toBeGreaterThan(schedule(c, 2, T).ivl);
    expect(schedule(card(), 3, T).ivl).toBe(4);
  });
  it("la facilidad nunca baja de 1.3", () => {
    let c = card({ ease: 1.35, reps: 1, ivl: 2 });
    for (let i = 0; i < 5; i++) c = schedule(c, 1, T);
    expect(c.ease).toBe(1.3);
  });
  it("no muta la tarjeta original", () => {
    const c = card();
    schedule(c, 2, T);
    expect(c.reps).toBe(0);
  });
  it("etiquetas de intervalo", () => {
    expect(ivlLabel(card(), 0, T)).toBe("hoy");
    expect(ivlLabel(card(), 2, T)).toBe("1 día");
    expect(ivlLabel(card(), 3, T)).toBe("4 días");
  });
  it("limita las tarjetas nuevas por día y prioriza tus errores", () => {
    const s = defaultState();
    expect(dueCards(s, T)).toHaveLength(NEW_PER_DAY);
    s.cards.push(card({ id: "err", tag: "mi error" }));
    expect(dueCards(s, T)[0].id).toBe("err");
    s.newByDay[T] = NEW_PER_DAY;
    expect(dueCards(s, T)).toHaveLength(0);
    s.cards[0] = { ...s.cards[0], reps: 1, ivl: 1, due: "2026-10-04" };
    expect(dueCards(s, T).map(c => c.id)).toEqual([s.cards[0].id]);
  });
  it("cuenta como aprendidas las de intervalo ≥ 3 días", () => {
    const s = defaultState();
    s.cards[0].ivl = 3; s.cards[1].ivl = 2;
    expect(learnedCount(s)).toBe(1);
  });
});
