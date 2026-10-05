import { endpoint, HttpError } from "./_lib/http.js";
import { generate, parseJson } from "./_lib/gemini.js";
import { COACH, str, wordPrompt } from "./_lib/prompts.js";

/* Traducción en contexto de una palabra tocada en la lectura. */
export default endpoint(async body => {
  const word = str(body.word, 40);
  if (!/^[A-Za-z][A-Za-z'’-]*$/.test(word)) throw new HttpError(400, "bad_word", "Palabra inválida.");
  const o = await generate({ system: COACH, contents: wordPrompt(word, str(body.sentence, 300)), temperature: 0.2, validate: parseJson });
  return { es: str(o && o.es, 80), ipa: str(o && o.ipa, 40), example: str(o && o.example, 200) };
}, { bucket: "word", limitEnv: "WORD_DAILY_LIMIT_PER_IP", limitDefault: 300 });
