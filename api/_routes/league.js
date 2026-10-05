import { endpoint, HttpError } from "../_lib/http.js";
import { getStore } from "../_lib/store.js";
import { join, leave, sync } from "../_lib/league.js";

/* Ligas semanales: { action: "join" | "sync" | "leave", ... } */
export default endpoint(async body => {
  const store = getStore();
  if (!store) throw new HttpError(503, "no_store", "Las ligas no están activadas en este servidor.");
  if (body.action === "join") {
    const r = await join(store, body.nickname);
    return { ...r, ...(await sync(store, { ...r, weekXP: body.weekXP })) };
  }
  if (body.action === "leave") return leave(store, body);
  return sync(store, body);
}, { bucket: "league", limitEnv: "LEAGUE_DAILY_LIMIT_PER_IP", limitDefault: 600 });
