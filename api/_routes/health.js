import { send } from "../_lib/http.js";
import { availableModels, getClient, hasAI, hasGemini, LIVE_MODELS, TEXT_MODELS, TTS_MODELS } from "../_lib/gemini.js";
import { enabledProviders, externalModels } from "../_lib/providers.js";
import { hasStore } from "../_lib/store.js";
import { hasPush } from "../_lib/push.js";

const num = (k, d) => Number(process.env[k] || d);
const LIMITS = () => ({ ai: num("DAILY_LIMIT_PER_IP", 80), tts: num("TTS_DAILY_LIMIT_PER_IP", 400), live: num("LIVE_SESSIONS_PER_DAY", 6), liveMinutes: num("LIVE_MAX_MINUTES", 10) });

/* Estado del servidor. Con IA, también lista qué modelos gratuitos existen para tu clave (diagnóstico). */
export default async function handler(req, res) {
  let models = null;
  if (hasAI()) {
    try {
      const c = hasGemini() ? getClient() : null;
      const [text, tts, live, ext, extFb] = await Promise.all([
        c ? availableModels(TEXT_MODELS(), c) : [], c ? availableModels(TTS_MODELS(), c) : [], c ? availableModels(LIVE_MODELS(), c) : [],
        externalModels("primary"), externalModels("fallback"),
      ]);
      models = { text: [...text, ...ext], fallback: extFb, tts, live };
    } catch { models = null; }
  }
  send(res, 200, { ok: true, ai: hasAI(), gemini: hasGemini(), providers: enabledProviders(), stt: !!process.env.GROQ_API_KEY, pronunciation: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION), accessCodeRequired: !!process.env.APP_ACCESS_CODE, leagues: hasStore(), push: hasStore() && hasPush(), vapidPublicKey: hasPush() ? process.env.VAPID_PUBLIC_KEY : null, models, limits: LIMITS() });
}
