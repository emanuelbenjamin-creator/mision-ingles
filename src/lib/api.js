/* Cliente de las funciones serverless (/api/*). La clave de Gemini nunca llega al navegador. */

export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

let accessCode = "";
export const setAccessCode = c => { accessCode = c || ""; };

export async function api(path, body, { signal } = {}) {
  let res;
  try {
    res = await fetch("/api/" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(accessCode ? { "x-access-code": accessCode } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw new ApiError("cancelled", "");
    throw new ApiError("offline", "Sin conexión con el servidor. Revisa tu internet.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* respuesta vacía */ }
  if (!res.ok) throw new ApiError((data && data.code) || "server", (data && data.error) || "El coach no respondió. Inténtalo otra vez.");
  return data;
}

/** Estado del servidor: { ai: hay clave de Gemini, accessCodeRequired }. Nunca lanza. */
export async function health() {
  try { return await api("health"); } catch { return { ai: false, accessCodeRequired: false }; }
}

/** Igual que api() pero devuelve el cuerpo como Blob (audio). */
export async function apiBlob(path, body, { signal } = {}) {
  let res;
  try {
    res = await fetch("/api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessCode ? { "x-access-code": accessCode } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw new ApiError("cancelled", "");
    throw new ApiError("offline", "Sin conexión con el servidor.");
  }
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    throw new ApiError((data && data.code) || "server", (data && data.error) || "No se pudo generar el audio.");
  }
  return res.blob();
}
