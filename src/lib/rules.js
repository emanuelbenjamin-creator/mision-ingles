/* Errores típicos de hispanohablantes: detector local que funciona sin IA. */
export const RULES = [
  { re: /\bI have (\d+|\w+) years\b(?! old| of)/i, fix: m => `I am ${m[1]} years old`, rule: "Edad con to be", why: "La edad se dice con «to be»: I am 30 years old (no «I have 30 years»)." },
  { re: /\bI(?: am|'m) agree\b/i, fix: () => "I agree", rule: "Agree es verbo", why: "«Agree» ya es un verbo: I agree (no «I am agree»)." },
  { re: /\b(people|police) is\b/i, fix: m => `${m[1]} are`, rule: "People es plural", why: "«People» es plural: people are." },
  { re: /\b(he|she|it) don't\b/i, fix: m => `${m[1]} doesn't`, rule: "3.ª persona", why: "Con he / she / it se usa doesn't." },
  { re: /\bexplain me\b/i, fix: () => "explain to me", rule: "Explain to", why: "«Explain» necesita «to» antes de la persona: explain to me." },
  { re: /\b(depends?|depending) of\b/i, fix: m => `${m[1]} on`, rule: "Depend on", why: "En inglés es «depend on», no «of»." },
  { re: /\bit depend\b/i, fix: () => "it depends", rule: "3.ª persona", why: "Con «it» el verbo lleva -s: it depends." },
  { re: /\bmake (a|one) question\b/i, fix: m => `ask ${m[1]} question`, rule: "Ask a question", why: "Las preguntas se «ask», no se «make»." },
  { re: /\bsince (\d+|two|three|four|five|six|ten|many|several) (years|months|weeks|days|hours)\b/i, fix: m => `for ${m[1]} ${m[2]}`, rule: "For vs since", why: "Para una duración se usa «for»; «since» marca el punto de inicio." },
  { re: /\bmore better\b/i, fix: () => "better", rule: "Comparativos", why: "«Better» ya es comparativo: no lleva «more»." },
  { re: /\bmore (easy|cheap|fast|big|small|happy|hard)\b/i, fix: m => ({ easy: "easier", cheap: "cheaper", fast: "faster", big: "bigger", small: "smaller", happy: "happier", hard: "harder" })[m[1].toLowerCase()], rule: "Comparativos", why: "Los adjetivos cortos forman el comparativo con -er (easier, cheaper)." },
  { re: /\bthe life is\b/i, fix: () => "life is", rule: "Artículo «the»", why: "Para hablar en general no se usa «the»: Life is beautiful." },
  { re: /\bin the (monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/i, fix: m => `on ${m[1]}`, rule: "On + día", why: "Con los días se usa «on», sin artículo: on Monday." },
  { re: /\b(can|must|should|could|will|would) to (\w+)/i, fix: m => `${m[1]} ${m[2]}`, rule: "Modales sin to", why: "Después de can, must, should, will… va el verbo sin «to»." },
  { re: /\b(did|didn't|didnt) (went|wanted|worked|saw|had|made|got)\b/i, fix: m => `${m[1]} ${({ went: "go", wanted: "want", worked: "work", saw: "see", had: "have", made: "make", got: "get" })[m[2].toLowerCase()]}`, rule: "Did + verbo base", why: "Después de did / didn't el verbo va en forma base: didn't go." },
  { re: /\bI have (hungry|thirsty|cold|hot|fear|reason)\b/i, fix: m => ({ hungry: "I am hungry", thirsty: "I am thirsty", cold: "I am cold", hot: "I am hot", fear: "I am afraid", reason: "I am right" })[m[1].toLowerCase()], rule: "Estados con to be", why: "Hambre, sed, frío, miedo y tener razón se dicen con «to be»: I am hungry, I am right." },
  { re: /\bassist(ed)? to\b/i, fix: m => `attend${m[1] || ""}`, rule: "Falso amigo", why: "«Asistir a» un evento es «attend»; «assist» significa ayudar." },
  { re: /\b(goed|buyed|thinked|teached|winned|catched|speaked|writed)\b/i, fix: m => ({ goed: "went", buyed: "bought", thinked: "thought", teached: "taught", winned: "won", catched: "caught", speaked: "spoke", writed: "wrote" })[m[1].toLowerCase()], rule: "Verbos irregulares", why: "Es un verbo irregular: su pasado no termina en -ed." },
  { re: /\b(informations|advices|furnitures|homeworks)\b/i, fix: m => m[1].toLowerCase().replace(/s$/, ""), rule: "Incontables", why: "Information, advice, furniture y homework son incontables: no llevan -s." },
  { re: /\bsay me\b/i, fix: () => "tell me", rule: "Say vs tell", why: "Con la persona como objeto se usa «tell»: tell me." },
];

/** Devuelve las correcciones locales encontradas en un texto. */
export function findMistakes(text) {
  const out = [];
  for (const r of RULES) {
    const m = String(text || "").match(r.re);
    if (!m) continue;
    const corrected = r.fix(m);
    if (corrected) out.push({ original: m[0], corrected, explanation_es: r.why, rule: r.rule });
  }
  return out;
}
