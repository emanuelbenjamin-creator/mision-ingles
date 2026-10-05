import { GoogleGenAI } from "@google/genai";
import { HttpError } from "./http.js";

/* Misma estrategia que backend/api.py: se prueba una cadena de modelos y se pasa al siguiente si uno falla. */
const MODELS = () => (process.env.GEMINI_MODELS || "gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite").split(",").map(s => s.trim()).filter(Boolean);

let client = null;
let testGenerator = null;
/** Solo para pruebas: reemplaza la llamada a Gemini. */
export const _setGenerator = fn => { testGenerator = fn; };

export const hasAI = () => !!(process.env.GEMINI_API_KEY || testGenerator);

/**
 * contents: string o [{role: "user"|"model", text}]. Devuelve el texto de la respuesta.
 */
export async function generate({ system, contents, json = true, temperature = 0.5 }) {
  if (testGenerator) return testGenerator({ system, contents, json });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(503, "no_ai", "El servidor no tiene configurada la clave de Gemini (GEMINI_API_KEY).");
  client = client || new GoogleGenAI({ apiKey });
  const body = typeof contents === "string" ? contents : contents.map(c => ({ role: c.role, parts: [{ text: c.text }] }));
  let last;
  for (const model of MODELS()) {
    try {
      const r = await client.models.generateContent({
        model,
        contents: body,
        config: { systemInstruction: system, temperature, ...(json ? { responseMimeType: "application/json" } : {}) },
      });
      const text = r.text;
      if (text && text.trim()) return text;
      last = new Error("respuesta vacía de " + model);
    } catch (e) {
      last = e;
      if (/API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(String(e && e.message))) break;
    }
  }
  console.error("[gemini] todos los modelos fallaron:", last && last.message);
  throw new HttpError(502, "ai_error", "El coach IA no está disponible en este momento. Inténtalo en un minuto.");
}

/** Lee JSON de forma tolerante (texto plano, bloque ```json o el primer objeto/arreglo). */
export function parseJson(text) {
  const t = String(text || "").trim();
  const tries = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) tries.push(fence[1]);
  const o1 = t.indexOf("{"), o2 = t.lastIndexOf("}");
  if (o1 >= 0 && o2 > o1) tries.push(t.slice(o1, o2 + 1));
  const a1 = t.indexOf("["), a2 = t.lastIndexOf("]");
  if (a1 >= 0 && a2 > a1) tries.push(t.slice(a1, a2 + 1));
  for (const c of tries) { try { return JSON.parse(c); } catch { /* siguiente intento */ } }
  throw new HttpError(502, "invalid_json", "La respuesta del coach llegó incompleta. Inténtalo otra vez.");
}
