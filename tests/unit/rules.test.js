import { describe, expect, it } from "vitest";
import { RULES, findMistakes } from "../../src/lib/rules.js";

// [frase con error, corrección esperada, frase correcta que no debe marcarse]
const CASES = [
  ["I have 30 years", "I am 30 years old", "I have 30 years of experience"],
  ["I am agree with you", "I agree", "I agree with you"],
  ["The people is friendly", "people are", "The people are friendly"],
  ["She don't like it", "She doesn't", "They don't like it"],
  ["Can you explain me this?", "explain to me", "Can you explain this to me?"],
  ["It depends of the price", "depends on", "It depends on the price"],
  ["Well, it depend", "it depends", "Well, it depends"],
  ["Can I make a question?", "ask a question", "Can I ask a question?"],
  ["I live here since 3 years", "for 3 years", "I have lived here since 2019"],
  ["This is more better", "better", "This is much better"],
  ["Spanish is more easy", "easier", "Spanish is more expensive"],
  ["The life is beautiful", "life is", "Life is beautiful"],
  ["See you in the monday", "on monday", "See you on Monday"],
  ["I can to swim", "can swim", "I want to swim"],
  ["I didn't went to work", "didn't go", "I didn't go to work"],
  ["I have hungry", "I am hungry", "I am hungry"],
  ["I assist to the meeting", "attend", "I attend the meeting"],
  ["I buyed a car", "bought", "I bought a car"],
  ["I need more informations", "information", "I need more information"],
  ["Please say me the truth", "tell me", "Please tell me the truth"],
];

describe("errores típicos de hispanohablantes", () => {
  it("hay un caso de prueba por cada regla", () => {
    expect(CASES.length).toBe(RULES.length);
  });
  it.each(CASES)("«%s» → «%s»", (wrong, fixed, ok) => {
    const found = findMistakes(wrong);
    expect(found.length).toBeGreaterThan(0);
    expect(found.map(f => f.corrected.toLowerCase()).join(" | ")).toContain(fixed.toLowerCase());
    expect(found[0].explanation_es).toBeTruthy();
    expect(findMistakes(ok)).toEqual([]);
  });
  it("tolera texto vacío", () => {
    expect(findMistakes("")).toEqual([]);
    expect(findMistakes(undefined)).toEqual([]);
  });
});
