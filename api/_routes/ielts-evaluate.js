import { endpoint, HttpError } from "../_lib/http.js";
import { generate, parseJson } from "../_lib/gemini.js";
import { str, ieltsPrompt, normalizeIelts } from "../_lib/prompts.js";
import { ieltsOverall } from "../../src/lib/ielts.js";

const EXAMINER = "You are a strict, fair, certified IELTS Speaking examiner. Explanations for the candidate are in Spanish.";

/* Evalúa un simulacro IELTS Speaking completo: 4 bandas de criterio + banda global oficial. */
export default endpoint(async body => {
  const qa = list => (Array.isArray(list) ? list : []).slice(0, 5).map(x => ({ q: str(x && x.q, 300), a: str(x && x.a, 2500) }));
  const set = { part1: qa(body.part1), part3: qa(body.part3), part2: { topic: str(body.part2 && body.part2.topic, 300), a: str(body.part2 && body.part2.a, 5000) } };
  const audio = typeof body.audio === "string" && body.audio.length > 2000 && /^[A-Za-z0-9+/=]+$/.test(body.audio) ? body.audio : null;
  const words = [...set.part1, ...set.part3].map(x => x.a).join(" ") + " " + set.part2.a;
  if ((words.match(/[a-z']+/gi) || []).length < 40 && !audio) throw new HttpError(400, "too_short", "Responde más preguntas para poder evaluarte (mínimo unas 40 palabras).");
  const contents = [{ role: "user", text: ieltsPrompt(set, !!audio), ...(audio ? { audio: { mimeType: "audio/wav", data: audio } } : {}) }];
  const r = await generate({ system: EXAMINER, contents, temperature: 0.2, validate: t => normalizeIelts(parseJson(t)), hasAudio: !!audio });
  return { ...r, overall: ieltsOverall(r.bands), pronunciationFromAudio: !!audio };
}, { maxBody: 4 * 1024 * 1024 });
