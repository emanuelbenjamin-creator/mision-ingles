import { endpoint, HttpError } from "../_lib/http.js";
import { generate, hasGemini, parseJson } from "../_lib/gemini.js";
import { groqTranscribe } from "../_lib/providers.js";
import { str, ieltsPrompt, normalizeIelts } from "../_lib/prompts.js";
import { ieltsOverall } from "../../src/lib/ielts.js";

const EXAMINER = "You are a strict, fair, certified IELTS Speaking examiner. Explanations for the candidate are in Spanish.";

/* Evalúa un simulacro IELTS Speaking completo: 4 bandas de criterio + banda global oficial. */
export default endpoint(async body => {
  const qa = list => (Array.isArray(list) ? list : []).slice(0, 5).map(x => ({ q: str(x && x.q, 300), a: str(x && x.a, 2500) }));
  const set = { part1: qa(body.part1), part3: qa(body.part3), part2: { topic: str(body.part2 && body.part2.topic, 300), a: str(body.part2 && body.part2.a, 5000) } };
  const audio = typeof body.audio === "string" && body.audio.length > 2000 && /^[A-Za-z0-9+/=]+$/.test(body.audio) ? body.audio : null;
  // Sin texto de la Part 2 pero con audio: se transcribe con Whisper (Groq) para que cualquier modelo pueda evaluar.
  if (!set.part2.a && audio && process.env.GROQ_API_KEY) {
    try { set.part2.a = str(await groqTranscribe({ audio, mimeType: "audio/wav" }), 5000); } catch { /* sigue sin transcripción */ }
  }
  const words = [...set.part1, ...set.part3].map(x => x.a).join(" ") + " " + set.part2.a;
  const enoughText = (words.match(/[a-z']+/gi) || []).length >= 40;
  if (!enoughText && !audio) throw new HttpError(400, "too_short", "Responde más preguntas para poder evaluarte (mínimo unas 40 palabras).");
  const validate = t => normalizeIelts(parseJson(t));
  if (audio && hasGemini()) {
    try {
      const r = await generate({ system: EXAMINER, contents: [{ role: "user", text: ieltsPrompt(set, true), audio: { mimeType: "audio/wav", data: audio } }], temperature: 0.2, validate, hasAudio: true });
      return { ...r, overall: ieltsOverall(r.bands), pronunciationFromAudio: true };
    } catch (e) { if (!enoughText) throw e; }
  }
  // Solo texto: corre en todos los modelos (Gemini, Groq, Cerebras…); la pronunciación se estima.
  const r = await generate({ system: EXAMINER, contents: ieltsPrompt(set, false), temperature: 0.2, validate });
  return { ...r, overall: ieltsOverall(r.bands), pronunciationFromAudio: false };
}, { maxBody: 4 * 1024 * 1024 });
