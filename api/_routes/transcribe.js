import { endpoint, HttpError } from "../_lib/http.js";
import { groqTranscribe } from "../_lib/providers.js";
import { str } from "../_lib/prompts.js";

/* Voz → texto con Whisper de Groq (gratis, 2,000 audios/día). Para navegadores sin reconocimiento de voz. */
export default endpoint(async body => {
  if (!process.env.GROQ_API_KEY) throw new HttpError(503, "no_stt", "La transcripción no está activada en este servidor (falta GROQ_API_KEY).");
  const audio = String(body.audio || "");
  if (audio.length < 2000 || !/^[A-Za-z0-9+/=]+$/.test(audio)) throw new HttpError(400, "bad_audio", "La grabación está vacía o dañada. Graba otra vez.");
  try {
    return { text: await groqTranscribe({ audio, language: body.language === "es" ? "es" : "en", prompt: str(body.prompt, 400) }) };
  } catch (e) {
    throw new HttpError(e && e.status === 429 ? 429 : 502, "stt_error", e && e.status === 429 ? "Se acabó la cuota gratuita de transcripción de hoy." : "No se pudo transcribir el audio. Inténtalo otra vez.");
  }
}, { bucket: "stt", limitEnv: "STT_DAILY_LIMIT_PER_IP", limitDefault: 300, maxBody: 4 * 1024 * 1024 });
