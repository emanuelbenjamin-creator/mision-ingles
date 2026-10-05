import { endpoint } from "../_lib/http.js";
import { createLiveToken } from "../_lib/gemini.js";
import { level, scenarioById, liveSystem, IELTS_EXAMINER } from "../_lib/prompts.js";

const VOICES = ["Kore", "Puck", "Aoede", "Charon"];

/*
 * Token temporal de un solo uso para Gemini Live. La configuración (personaje, nivel, voz,
 * transcripciones) queda fijada en el token: el navegador no puede cambiarla ni ver la clave.
 */
export default endpoint(async body => {
  const sc = body.scenario === "ielts" ? IELTS_EXAMINER : scenarioById(body.scenario);
  const minutes = Math.max(1, Math.min(30, Number(process.env.LIVE_MAX_MINUTES || 10)));
  const config = {
    responseModalities: ["AUDIO"],
    systemInstruction: liveSystem(sc, level(body.level)),
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES.includes(body.voice) ? body.voice : "Kore" } } },
  };
  const { token, model } = await createLiveToken({ minutes, config });
  return { token, model, minutes, config };
}, { bucket: "live", limitEnv: "LIVE_SESSIONS_PER_DAY", limitDefault: 6 });
