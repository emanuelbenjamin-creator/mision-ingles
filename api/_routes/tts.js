import { endpoint, HttpError } from "../_lib/http.js";
import { synthesize } from "../_lib/gemini.js";
import { pcmToWav } from "../_lib/audio.js";
import { str } from "../_lib/prompts.js";

const VOICES = ["Kore", "Puck", "Aoede", "Charon"];
const STYLE = {
  us: "Read the following aloud in a clear, natural American English accent, at a moderate pace, for an English learner:",
  uk: "Read the following aloud in a clear, natural British English accent, at a moderate pace, for an English learner:",
};

/* Voz natural de Gemini (modelos TTS gratuitos en carrera). Devuelve un WAV. */
export default endpoint(async body => {
  const text = str(body.text, 600);
  if (!text) throw new HttpError(400, "empty", "No hay texto para leer.");
  const voice = VOICES.includes(body.voice) ? body.voice : "Kore";
  const { data, rate } = await synthesize({ text, voice, style: STYLE[body.accent] || STYLE.us });
  return { binary: pcmToWav(Buffer.from(data, "base64"), rate), contentType: "audio/wav" };
}, { bucket: "tts", limitEnv: "TTS_DAILY_LIMIT_PER_IP", limitDefault: 400 });
