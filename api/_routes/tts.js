import { endpoint, HttpError } from "../_lib/http.js";
import { synthesize } from "../_lib/gemini.js";
import { pcmToWav } from "../_lib/audio.js";
import { str } from "../_lib/prompts.js";
import { ACCENT_IDS, TONE_IDS, VOICE_IDS, ttsStyle } from "../../src/content/voices.js";

/* El acento y el tono salen de listas cerradas: el navegador nunca escribe la instrucción de estilo. */
export const styleFor = body => ttsStyle(ACCENT_IDS.includes(body.accent) ? body.accent : "us", TONE_IDS.includes(body.tone) ? body.tone : "friendly");

/* Voz natural de Gemini (modelos TTS gratuitos en carrera). Devuelve un WAV. */
export default endpoint(async body => {
  const text = str(body.text, 600);
  if (!text) throw new HttpError(400, "empty", "No hay texto para leer.");
  const voice = VOICE_IDS.includes(body.voice) ? body.voice : "Kore";
  const { data, rate } = await synthesize({ text, voice, style: styleFor(body) });
  return { binary: pcmToWav(Buffer.from(data, "base64"), rate), contentType: "audio/wav" };
}, { bucket: "tts", limitEnv: "TTS_DAILY_LIMIT_PER_IP", limitDefault: 400 });
