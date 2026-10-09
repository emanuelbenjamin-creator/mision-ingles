import { send } from "./_lib/http.js";
import chatReview from "./_routes/chat-review.js";
import chatSuggest from "./_routes/chat-suggest.js";
import chatTurn from "./_routes/chat-turn.js";
import cronRemind from "./_routes/cron-remind.js";
import dialogue from "./_routes/dialogue.js";
import dictation from "./_routes/dictation.js";
import grammarAsk from "./_routes/grammar-ask.js";
import grammarExplain from "./_routes/grammar-explain.js";
import health from "./_routes/health.js";
import ieltsEvaluate from "./_routes/ielts-evaluate.js";
import league from "./_routes/league.js";
import liveToken from "./_routes/live-token.js";
import mistakesLesson from "./_routes/mistakes-lesson.js";
import pronAssess from "./_routes/pron-assess.js";
import pushSubscribe from "./_routes/push-subscribe.js";
import reading from "./_routes/reading.js";
import speakEvaluate from "./_routes/speak-evaluate.js";
import storyTurn from "./_routes/story-turn.js";
import transcribe from "./_routes/transcribe.js";
import tts from "./_routes/tts.js";
import voiceTurn from "./_routes/voice-turn.js";
import word from "./_routes/word.js";

/*
 * Una sola función serverless para toda la API: el plan gratuito de Vercel permite máximo
 * 12 funciones por despliegue. Cada ruta vive en api/_routes/<nombre>.js.
 */
export const ROUTES = {
  "chat-review": chatReview,
  "chat-suggest": chatSuggest,
  "chat-turn": chatTurn,
  "cron-remind": cronRemind,
  dialogue,
  "dictation": dictation,
  "grammar-ask": grammarAsk,
  "grammar-explain": grammarExplain,
  "health": health,
  "ielts-evaluate": ieltsEvaluate,
  league,
  "live-token": liveToken,
  "mistakes-lesson": mistakesLesson,
  "pron-assess": pronAssess,
  "push-subscribe": pushSubscribe,
  "reading": reading,
  "speak-evaluate": speakEvaluate,
  "story-turn": storyTurn,
  "transcribe": transcribe,
  "tts": tts,
  "voice-turn": voiceTurn,
  "word": word,
};

export default async function handler(req, res) {
  const q = req.query && req.query.route;
  const name = (Array.isArray(q) ? q[0] : q) || (String(req.url || "").match(/^\/api\/([a-z-]+)/) || [])[1];
  const route = ROUTES[name];
  if (!route) return send(res, 404, { code: "not_found", error: "Ruta no encontrada." });
  return route(req, res);
}
