import { endpoint, HttpError } from "../_lib/http.js";
import { generate, hasGemini, parseJson } from "../_lib/gemini.js";
import { COACH, str, level, pronPrompt, normalizePron } from "../_lib/prompts.js";
import { azurePronunciation, hasAzure } from "../_lib/azure.js";
import { groqTranscribe } from "../_lib/providers.js";
import { alignWords } from "../../src/lib/align.js";

/*
 * Evalúa tu grabación (WAV en base64) palabra por palabra, con el mejor motor disponible:
 * 1) Azure Pronunciation Assessment (puntaje por fonema), 2) Gemini escuchando el audio,
 * 3) Whisper de Groq: transcribe y compara con la frase (las palabras no reconocidas se marcan).
 */
export default endpoint(async body => {
  const target = str(body.target, 300);
  const audio = String(body.audio || "");
  if (!target) throw new HttpError(400, "empty", "Falta la frase a evaluar.");
  if (audio.length < 2000 || !/^[A-Za-z0-9+/=]+$/.test(audio)) throw new HttpError(400, "bad_audio", "La grabación está vacía o dañada. Graba otra vez.");
  let lastErr = null;
  if (hasAzure()) {
    try { return await azurePronunciation({ audio, target }); } catch (e) { lastErr = e; }
  }
  if (hasGemini()) {
    try {
      const contents = [{ role: "user", text: pronPrompt(target, level(body.level)), audio: { mimeType: "audio/wav", data: audio } }];
      return { ...normalizePron(await generate({ system: COACH, contents, temperature: 0.2, validate: parseJson, hasAudio: true }), target), method: "gemini" };
    } catch (e) { lastErr = e; }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      const said = await groqTranscribe({ audio, prompt: target });
      const a = alignWords(target, said);
      return {
        score: a.score, transcript: said,
        words: a.tokens.filter(t => t.status !== "plain").map(t => ({ word: t.text, ok: t.status === "ok", issue_es: t.status === "ok" ? "" : "No se reconoció esta palabra: pronúnciala más clara." })),
        sounds_to_practice: [], tip_es: "Evaluación por transcripción: las palabras en rojo no se entendieron. Repite despacio y articulando.", method: "whisper",
      };
    } catch (e) { lastErr = e; }
  }
  if (lastErr instanceof HttpError) throw lastErr;
  throw new HttpError(lastErr ? 502 : 503, lastErr ? "ai_error" : "no_ai", lastErr ? "No se pudo evaluar la pronunciación ahora. Inténtalo en un minuto." : "La evaluación por audio no está activada en este servidor.");
}, { maxBody: 1536 * 1024 });
