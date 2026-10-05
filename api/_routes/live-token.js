import { endpoint } from "../_lib/http.js";
import { createLiveToken } from "../_lib/gemini.js";
import { level, profession, scenarioById, liveSystem, IELTS_EXAMINER, FREE_TALK, TUTOR } from "../_lib/prompts.js";
import { VOICE_IDS } from "../../src/content/voices.js";

const SPECIAL = { ielts: IELTS_EXAMINER, free: FREE_TALK, tutor: TUTOR };

/*
 * Token temporal de un solo uso para Gemini Live. La configuración (personaje, tema, nivel, voz,
 * forma de corregir y transcripciones) queda fijada en el token: el navegador no puede cambiarla ni ver la clave.
 */
export default endpoint(async body => {
  const sc = SPECIAL[body.scenario] || scenarioById(body.scenario);
  const minutes = Math.max(1, Math.min(30, Number(process.env.LIVE_MAX_MINUTES || 10)));
  const prof = body.profession && body.profession !== "general" ? profession(body.profession).en : "";
  const config = {
    responseModalities: ["AUDIO"],
    systemInstruction: liveSystem(sc, level(body.level), { topic: body.topic, correction: body.correction, pace: body.pace, profession: prof }),
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_IDS.includes(body.voice) ? body.voice : "Kore" } } },
  };
  const { token, model } = await createLiveToken({ minutes, config });
  return { token, model, minutes, config };
}, { bucket: "live", limitEnv: "LIVE_SESSIONS_PER_DAY", limitDefault: 6 });
