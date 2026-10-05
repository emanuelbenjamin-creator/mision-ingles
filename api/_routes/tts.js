import { endpoint, HttpError } from "../_lib/http.js";
import { synthesize } from "../_lib/gemini.js";
import { pcmToWav } from "../_lib/audio.js";
import { str } from "../_lib/prompts.js";
import { VOICE_IDS } from "../../src/content/voices.js";

const STYLE = {
  us: "Say this like a friendly native speaker from the United States: warm, expressive and natural, with real conversational intonation, clear but not robotic, at a relaxed pace:",
  uk: "Say this like a friendly native speaker from London: warm, expressive and natural, with real conversational British intonation, clear but not robotic, at a relaxed pace:",
};

/* Voz natural de Gemini (modelos TTS gratuitos en carrera). Devuelve un WAV. */
export default endpoint(async body => {
  const text = str(body.text, 600);
  if (!text) throw new HttpError(400, "empty", "No hay texto para leer.");
  const voice = VOICE_IDS.includes(body.voice) ? body.voice : "Kore";
  const { data, rate } = await synthesize({ text, voice, style: STYLE[body.accent] || STYLE.us });
  return { binary: pcmToWav(Buffer.from(data, "base64"), rate), contentType: "audio/wav" };
}, { bucket: "tts", limitEnv: "TTS_DAILY_LIMIT_PER_IP", limitDefault: 400 });
