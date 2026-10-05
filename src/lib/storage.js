import { migrate } from "./state.js";

export const STORE_KEY = "mision-ingles-v1";

export function loadState(storage = globalThis.localStorage) {
  try { const raw = storage ? storage.getItem(STORE_KEY) : null; return migrate(raw ? JSON.parse(raw) : null); }
  catch { return migrate(null); }
}

export function saveState(state, storage = globalThis.localStorage) {
  try { if (!storage) return false; storage.setItem(STORE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

export function exportState(state) {
  return JSON.stringify({ app: "mision-ingles", exportedAt: new Date().toISOString(), state }, null, 2);
}

/** Lee una copia de seguridad. Lanza un Error con mensaje en español si el archivo no sirve. */
export function importState(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("El archivo no es un JSON válido."); }
  const s = data && data.app === "mision-ingles" ? data.state : null;
  if (!s || typeof s !== "object" || !s.profile || !Array.isArray(s.cards)) throw new Error("El archivo no es una copia de seguridad de Misión Inglés.");
  return migrate(s);
}
