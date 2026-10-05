import { send } from "../_lib/http.js";
import { hasAI } from "../_lib/gemini.js";
import { hasStore } from "../_lib/store.js";
import { hasPush } from "../_lib/push.js";

export default function handler(req, res) {
  send(res, 200, { ok: true, ai: hasAI(), accessCodeRequired: !!process.env.APP_ACCESS_CODE, leagues: hasStore(), push: hasStore() && hasPush(), vapidPublicKey: hasPush() ? process.env.VAPID_PUBLIC_KEY : null });
}
