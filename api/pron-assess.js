import { endpoint, HttpError } from "./_lib/http.js";
import { generate, parseJson } from "./_lib/gemini.js";
import { COACH, str, level, pronPrompt, normalizePron } from "./_lib/prompts.js";

/* Gemini escucha tu grabación (WAV en base64) y evalúa la pronunciación palabra por palabra. */
export default endpoint(async body => {
  const target = str(body.target, 300);
  const audio = String(body.audio || "");
  if (!target) throw new HttpError(400, "empty", "Falta la frase a evaluar.");
  if (audio.length < 2000 || !/^[A-Za-z0-9+/=]+$/.test(audio)) throw new HttpError(400, "bad_audio", "La grabación está vacía o dañada. Graba otra vez.");
  const contents = [{ role: "user", text: pronPrompt(target, level(body.level)), audio: { mimeType: "audio/wav", data: audio } }];
  return normalizePron(await generate({ system: COACH, contents, temperature: 0.2, validate: parseJson, hasAudio: true }), target);
}, { maxBody: 1536 * 1024 });
