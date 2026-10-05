/*
 * Proveedores fuera de Gemini con API compatible con OpenAI y capa gratuita:
 * - Groq y Cerebras corren junto a Gemini en la carrera principal (muy rápidos).
 * - Mistral (2 consultas/min) y OpenRouter (modelos «:free») quedan como respaldo.
 * Cada uno se activa solo si su clave está configurada. Los modelos que no existan para
 * esa clave se descartan con el listado /models.
 */

const list = (name, def) => (process.env[name] || def).split(",").map(s => s.trim()).filter(Boolean);

export const PROVIDERS = {
  groq: { base: "https://api.groq.com/openai/v1", key: "GROQ_API_KEY", models: "GROQ_MODELS", def: "openai/gpt-oss-120b,llama-3.3-70b-versatile,openai/gpt-oss-20b,llama-3.1-8b-instant", tier: "primary", jsonMode: true },
  cerebras: { base: "https://api.cerebras.ai/v1", key: "CEREBRAS_API_KEY", models: "CEREBRAS_MODELS", def: "gpt-oss-120b,llama-3.3-70b,qwen-3-32b,llama3.1-8b", tier: "primary", jsonMode: true },
  mistral: { base: "https://api.mistral.ai/v1", key: "MISTRAL_API_KEY", models: "MISTRAL_MODELS", def: "mistral-small-latest", tier: "fallback", jsonMode: true },
  openrouter: { base: "https://openrouter.ai/api/v1", key: "OPENROUTER_API_KEY", models: "OPENROUTER_MODELS", def: "openai/gpt-oss-20b:free,meta-llama/llama-3.3-70b-instruct:free,deepseek/deepseek-chat-v3-0324:free", tier: "fallback", jsonMode: false },
};

let fetchImpl = (...a) => fetch(...a);
const known = new Map(); // proveedor → Promise<Set<string> | null>
/** Solo para pruebas: reemplaza fetch. */
export const _setFetch = f => { fetchImpl = f || ((...a) => fetch(...a)); known.clear(); };

export const enabledProviders = () => Object.keys(PROVIDERS).filter(id => !!process.env[PROVIDERS[id].key]);

function knownModels(id) {
  if (!known.has(id)) {
    const p = PROVIDERS[id];
    known.set(id, (async () => {
      try {
        const r = await fetchImpl(p.base + "/models", { headers: { Authorization: `Bearer ${process.env[p.key]}` } });
        if (!r.ok) return null;
        const d = await r.json();
        const names = new Set((d.data || []).map(m => String(m.id)));
        return names.size ? names : null;
      } catch { return null; }
    })());
  }
  return known.get(id);
}

/** Nombres «proveedor:modelo» disponibles para un nivel (primary | fallback). */
export async function externalModels(tier) {
  const out = [];
  for (const id of enabledProviders()) {
    const p = PROVIDERS[id];
    if (p.tier !== tier) continue;
    const names = await knownModels(id);
    for (const m of list(p.models, p.def)) if (!names || names.has(m)) out.push(`${id}:${m}`);
  }
  return out;
}

export const isExternal = name => /^(groq|cerebras|mistral|openrouter):/.test(name);

/** Llamada de chat compatible con OpenAI. contents: string o [{ role: "user"|"model", text }]. */
export async function externalChat(name, { system, contents, json, temperature = 0.5, signal }) {
  const i = name.indexOf(":");
  const id = name.slice(0, i), model = name.slice(i + 1);
  const p = PROVIDERS[id];
  const items = typeof contents === "string" ? [{ role: "user", text: contents }] : contents;
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  for (const c of items) if (c.text) messages.push({ role: c.role === "model" ? "assistant" : "user", content: c.text });
  const body = {
    model, messages, temperature,
    ...(json && p.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(id === "groq" && /gpt-oss/.test(model) ? { reasoning_effort: "low" } : {}),
  };
  const res = await fetchImpl(p.base + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env[p.key]}`,
      "Content-Type": "application/json",
      ...(id === "openrouter" ? { "X-Title": "Mision Ingles" } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.text()).slice(0, 200); } catch { /* sin cuerpo */ }
    throw Object.assign(new Error(`${name} ${res.status} ${detail}`), { status: res.status });
  }
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text || !String(text).trim()) throw new Error("respuesta vacía de " + name);
  return String(text);
}

/** Transcribe audio WAV (base64) con Whisper de Groq (2,000 audios/día gratis). */
export async function groqTranscribe({ audio, mimeType = "audio/wav", language = "en", prompt = "" }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(audio, "base64")], { type: mimeType }), "audio.wav");
  form.append("model", process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo");
  if (language) form.append("language", language);
  if (prompt) form.append("prompt", prompt.slice(0, 400));
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = await fetchImpl("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw Object.assign(new Error(`groq whisper ${res.status}`), { status: res.status });
  const d = await res.json();
  return String((d && d.text) || "").trim();
}
