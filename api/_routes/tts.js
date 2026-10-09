import { endpoint, HttpError } from "../_lib/http.js";
import { synthesize } from "../_lib/gemini.js";
import { pcmToWav } from "../_lib/audio.js";
import { str } from "../_lib/prompts.js";
import { ACCENT_IDS, TONE_IDS, VOICE_IDS, ttsStyle } from "../../src/content/voices.js";

/* El acento y el tono salen de listas cerradas: el navegador nunca escribe la instrucción de estilo. */
export const styleFor = body => ttsStyle(ACCENT_IDS.includes(body.accent) ? body.accent : "us", TONE_IDS.includes(body.tone) ? body.tone : "friendly");

const MAX_DIALOGUE = 1200;
const speakerName = x => str(x, 24).replace(/[^\p{L}. ]/gu, "").trim();

/**
 * Guion a dos voces: { speakers: [{ name, voice }, { name, voice }], lines: [{ s: 0|1, text }] }.
 * Devuelve { text, speakers } listo para el TTS multi-hablante, o lanza 400 si no es válido.
 */
export function dialogueScript(body) {
  const speakers = (Array.isArray(body.speakers) ? body.speakers : []).slice(0, 2)
    .map(s => ({ name: speakerName(s && s.name), voice: VOICE_IDS.includes(s && s.voice) ? s.voice : "" }));
  if (speakers.length !== 2 || speakers.some(s => !s.name || !s.voice) || speakers[0].name === speakers[1].name) throw new HttpError(400, "bad_speakers", "El diálogo necesita dos voces distintas.");
  const lines = (Array.isArray(body.lines) ? body.lines : []).slice(0, 24)
    .map(l => ({ s: l && l.s === 1 ? 1 : 0, text: str(l && l.text, 300) })).filter(l => l.text);
  if (lines.length < 2) throw new HttpError(400, "empty", "No hay texto para leer.");
  const text = lines.map(l => `${speakers[l.s].name}: ${l.text}`).join("\n");
  if (text.length > MAX_DIALOGUE) throw new HttpError(413, "too_large", "El diálogo es demasiado largo para leerlo de una vez.");
  return { text, speakers };
}

/* Voz natural de Gemini (modelos TTS gratuitos en carrera). Devuelve un WAV. */
export default endpoint(async body => {
  if (body.lines) {
    const { text, speakers } = dialogueScript(body);
    const style = `TTS the following conversation between ${speakers[0].name} and ${speakers[1].name}. Make it sound like a real, natural conversation, clear enough for an English learner:`;
    const { data, rate } = await synthesize({ text, speakers, style });
    return { binary: pcmToWav(Buffer.from(data, "base64"), rate), contentType: "audio/wav" };
  }
  const text = str(body.text, 600);
  if (!text) throw new HttpError(400, "empty", "No hay texto para leer.");
  const voice = VOICE_IDS.includes(body.voice) ? body.voice : "Kore";
  const { data, rate } = await synthesize({ text, voice, style: styleFor(body) });
  return { binary: pcmToWav(Buffer.from(data, "base64"), rate), contentType: "audio/wav" };
}, { bucket: "tts", limitEnv: "TTS_DAILY_LIMIT_PER_IP", limitDefault: 400 });
