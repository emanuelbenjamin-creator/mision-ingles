/* Las 30 voces prediseñadas de Gemini (sirven para la voz natural y para Gemini Live). */
export const VOICES = [
  { id: "Kore", es: "Firme", g: "f" },
  { id: "Aoede", es: "Fresca", g: "f" },
  { id: "Leda", es: "Juvenil", g: "f" },
  { id: "Sulafat", es: "Cálida", g: "f" },
  { id: "Achernar", es: "Suave", g: "f" },
  { id: "Despina", es: "Serena", g: "f" },
  { id: "Vindemiatrix", es: "Gentil", g: "f" },
  { id: "Autonoe", es: "Brillante", g: "f" },
  { id: "Callirrhoe", es: "Tranquila", g: "f" },
  { id: "Erinome", es: "Clara", g: "f" },
  { id: "Laomedeia", es: "Alegre", g: "f" },
  { id: "Pulcherrima", es: "Directa", g: "f" },
  { id: "Gacrux", es: "Madura", g: "f" },
  { id: "Zephyr", es: "Luminosa", g: "f" },
  { id: "Puck", es: "Animado", g: "m" },
  { id: "Charon", es: "Informativo", g: "m" },
  { id: "Fenrir", es: "Entusiasta", g: "m" },
  { id: "Orus", es: "Firme", g: "m" },
  { id: "Achird", es: "Amigable", g: "m" },
  { id: "Iapetus", es: "Claro", g: "m" },
  { id: "Umbriel", es: "Relajado", g: "m" },
  { id: "Algieba", es: "Suave", g: "m" },
  { id: "Enceladus", es: "Susurrante", g: "m" },
  { id: "Algenib", es: "Grave", g: "m" },
  { id: "Rasalgethi", es: "Explicativo", g: "m" },
  { id: "Alnilam", es: "Seguro", g: "m" },
  { id: "Schedar", es: "Equilibrado", g: "m" },
  { id: "Zubenelgenubi", es: "Casual", g: "m" },
  { id: "Sadachbia", es: "Vivaz", g: "m" },
  { id: "Sadaltager", es: "Experto", g: "m" },
];
export const VOICE_IDS = VOICES.map(v => v.id);
export const voiceLabel = id => { const v = VOICES.find(x => x.id === id); return v ? `${v.id} · ${v.es}` : id; };

/*
 * Acentos y tonos. Son listas cerradas: el servidor arma con ellas la instrucción de estilo para
 * Gemini TTS y Gemini Live (nunca se acepta texto libre del navegador). `lang` es el idioma de la
 * voz del navegador que se usa de respaldo; Kokoro solo tiene voces de EE. UU. y Reino Unido.
 */
export const ACCENTS = [
  { id: "us", es: "Estadounidense", lang: "en-US", from: "the United States", en: "a General American accent" },
  { id: "uk", es: "Británico", lang: "en-GB", from: "London", en: "a modern southern British accent" },
  { id: "au", es: "Australiano", lang: "en-AU", from: "Sydney, Australia", en: "a natural Australian accent" },
  { id: "ie", es: "Irlandés", lang: "en-IE", from: "Dublin, Ireland", en: "a soft Irish accent" },
  { id: "sco", es: "Escocés", lang: "en-GB", from: "Edinburgh, Scotland", en: "a clear, gentle Scottish accent" },
  { id: "in", es: "Indio", lang: "en-IN", from: "Mumbai, India", en: "a clear, educated Indian English accent" },
  { id: "ca", es: "Canadiense", lang: "en-CA", from: "Toronto, Canada", en: "a Canadian accent" },
];
export const TONES = [
  { id: "friendly", es: "Amigable", en: "warm, expressive and natural, with real conversational intonation, clear but not robotic, at a relaxed pace" },
  { id: "formal", es: "Formal", en: "polite, professional and composed, like in a business meeting, clear and measured" },
  { id: "cheerful", es: "Alegre", en: "upbeat, smiling and energetic, with lively intonation" },
  { id: "calm", es: "Calmado", en: "calm, gentle and reassuring, unhurried, with soft intonation" },
  { id: "whisper", es: "Susurro", en: "in a soft, close whisper, as if sharing a secret, still easy to understand" },
  { id: "news", es: "Locutor rápido", en: "like a confident news presenter, crisp and fairly fast, with clear emphasis on key words" },
];
export const ACCENT_IDS = ACCENTS.map(a => a.id);
export const TONE_IDS = TONES.map(t => t.id);
export const accentOf = id => ACCENTS.find(a => a.id === id) || ACCENTS[0];
export const toneOf = id => TONES.find(t => t.id === id) || TONES[0];
export const accentLabel = id => accentOf(id).es;

/** Instrucción de estilo para Gemini TTS (va antes del texto a leer). */
export const ttsStyle = (accent, tone) => `Say this like a native speaker from ${accentOf(accent).from}, with ${accentOf(accent).en}: ${toneOf(tone).en}:`;
/** Frase para el personaje de Gemini Live y del modo económico. */
export const liveVoiceLine = (accent, tone) => `Speak with ${accentOf(accent).en} and sound ${toneOf(tone).en.split(",")[0]}.`;
