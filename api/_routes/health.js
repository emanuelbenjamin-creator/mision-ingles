import { send } from "../_lib/http.js";
import { hasAI } from "../_lib/gemini.js";
import { hasStore } from "../_lib/store.js";

export default function handler(req, res) {
  send(res, 200, { ok: true, ai: hasAI(), accessCodeRequired: !!process.env.APP_ACCESS_CODE, leagues: hasStore() });
}
