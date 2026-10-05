/*
 * Azure Pronunciation Assessment (capa gratuita F0: 5 h de audio al mes).
 * Puntaje por fonema, palabra, precisión, fluidez y completitud. Se activa con
 * AZURE_SPEECH_KEY y AZURE_SPEECH_REGION.
 */
let fetchImpl = (...a) => fetch(...a);
/** Solo para pruebas: reemplaza fetch. */
export const _setAzureFetch = f => { fetchImpl = f || ((...a) => fetch(...a)); };
export const hasAzure = () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);

const clean = w => String(w).toLowerCase().replace(/[^a-z']/g, "");

/** Evalúa un WAV 16 kHz (base64) contra la frase objetivo. Devuelve el formato de /api/pron-assess. */
export async function azurePronunciation({ audio, target }) {
  const region = process.env.AZURE_SPEECH_REGION, key = process.env.AZURE_SPEECH_KEY;
  const cfg = { ReferenceText: target, GradingSystem: "HundredMark", Granularity: "Phoneme", Dimension: "Comprehensive", EnableMiscue: true, PhonemeAlphabet: "IPA" };
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      "Pronunciation-Assessment": Buffer.from(JSON.stringify(cfg)).toString("base64"),
      Accept: "application/json",
    },
    body: Buffer.from(audio, "base64"),
  });
  if (!res.ok) throw Object.assign(new Error(`azure ${res.status}`), { status: res.status });
  const d = await res.json();
  const tokens = String(target).split(/\s+/).filter(Boolean);
  if (!d || d.RecognitionStatus !== "Success" || !d.NBest || !d.NBest[0]) {
    return { score: 0, transcript: "", words: tokens.map(t => ({ word: t, ok: false, issue_es: "No se escuchó." })), sounds_to_practice: [], tip_es: "No se escuchó tu voz. Acércate al micrófono y vuelve a grabar.", method: "azure" };
  }
  const nb = d.NBest[0];
  const pa = nb.PronunciationAssessment || nb;
  const aw = (nb.Words || []).map(w => {
    const wa = w.PronunciationAssessment || w;
    return {
      word: clean(w.Word), acc: Number(wa.AccuracyScore) || 0, err: wa.ErrorType || "None",
      phonemes: (w.Phonemes || []).map(p => ({ p: p.Phoneme, s: Number((p.PronunciationAssessment || p).AccuracyScore) || 0 })),
    };
  }).filter(w => w.err !== "Insertion");
  const weak = new Set();
  let j = 0;
  const words = tokens.map(t => {
    const ct = clean(t);
    let k = j;
    while (k < aw.length && aw[k].word !== ct) k++;
    const w = k < aw.length ? aw[k] : null;
    if (w) j = k + 1;
    if (!w || w.err === "Omission") return { word: t, ok: false, issue_es: "No se escuchó esta palabra." };
    const low = w.phonemes.filter(p => p.s < 60).map(p => p.p);
    low.forEach(p => weak.add("/" + p + "/"));
    const ok = w.err === "None" && w.acc >= 70;
    return { word: t, ok, issue_es: ok ? "" : low.length ? `Revisa ${low.map(p => "/" + p + "/").join(" ")} · precisión ${Math.round(w.acc)}/100` : `Precisión ${Math.round(w.acc)}/100: pronúnciala más clara.` };
  });
  const flu = Math.round(Number(pa.FluencyScore) || 0), comp = Math.round(Number(pa.CompletenessScore) || 0), acc = Math.round(Number(pa.AccuracyScore) || 0);
  const tip = comp < 80 ? "Te faltaron palabras: lee la frase completa, sin saltarte ninguna."
    : flu < 70 ? "Habla de corrido, uniendo las palabras, sin pausas entre cada una."
      : acc < 75 ? "Concéntrate en los sonidos marcados en rojo y repite despacio."
        : "¡Muy bien! Repite a velocidad normal para ganar naturalidad.";
  return {
    score: Math.round(Number(pa.PronScore ?? pa.AccuracyScore) || 0),
    transcript: nb.Display || d.DisplayText || "",
    words, sounds_to_practice: [...weak].slice(0, 5), tip_es: tip,
    scores: { accuracy: acc, fluency: flu, completeness: comp }, method: "azure",
  };
}
