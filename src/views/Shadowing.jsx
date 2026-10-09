import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Icon from "../components/Icon.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import { DICTATION } from "../content/dictation.js";
import { band } from "../lib/level.js";
import { hash } from "../lib/dates.js";
import { api } from "../lib/api.js";
import { audioBlobFor, getAudioState, stopAudio, subscribeAudio, subscribeProgress, toggleClip } from "../lib/audio.js";
import { canRecord, startRecording } from "../lib/recorder.js";
import { analyze, compare, wordTimes } from "../lib/pitch.js";
import { addXP, bumpSkill, logSession } from "../lib/game.js";

const NATIVE = "shadow:native", MINE = "shadow:mine";

async function decode(source) {
  const buf = await (source instanceof Blob ? source.arrayBuffer() : fetch(source).then(r => r.arrayBuffer()));
  const ctx = new AudioContext();
  try { const a = await ctx.decodeAudioData(buf); return analyze(a.getChannelData(0), a.sampleRate); }
  finally { ctx.close(); }
}

/** Dibuja la forma (volumen) y la entonación de las dos voces, una sobre otra, alineadas de inicio a fin. */
function Waves({ native, mine }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const css = name => getComputedStyle(c).getPropertyValue(name).trim() || "#888";
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const half = h / 2;
    const area = (a, top, color) => {
      if (!a) return;
      let max = 0;
      for (const v of a.shape) if (v > max) max = v;
      ctx.fillStyle = color; ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.moveTo(0, top + half);
      a.shape.forEach((v, i) => ctx.lineTo(i / (a.shape.length - 1) * w, top + half - (max ? v / max : 0) * (half - 10)));
      ctx.lineTo(w, top + half); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      if (!a.melody) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
      ctx.beginPath();
      a.melody.forEach((v, i) => { const x = i / (a.melody.length - 1) * w, y = top + half / 2 - v / 12 * (half / 2 - 8); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    };
    area(native, 0, css("--accent"));
    area(mine, half, css("--good"));
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, half); ctx.lineTo(w, half); ctx.stroke();
  }, [native, mine]);
  return <canvas ref={ref} className="shadow-waves" role="img" aria-label="Forma y entonación de la voz nativa (arriba) y de la tuya (abajo)" />;
}

/** Shadowing: escuchar al nativo, repetir, y comparar forma, entonación y velocidad. */
export default function Shadowing({ s, ai, update, today, toast }) {
  const list = DICTATION[band(s.profile.level)];
  const [idx, setIdx] = useState(() => hash(today + "shadow") % list.length);
  const text = list[idx % list.length];
  const [native, setNative] = useState(null); // { url, a } | { none: true }
  const [loading, setLoading] = useState(false);
  const [rec, setRec] = useState(null);
  const [clip, setClip] = useState(null); // { url, wavBase64, a }
  const [ai2, setAi2] = useState(null);
  const [busy, setBusy] = useState(false);
  const [word, setWord] = useState(-1);
  const scored = useRef(new Set());
  const urls = useRef([]);
  const st = useSyncExternalStore(subscribeAudio, getAudioState);
  const nativeOn = st.id === NATIVE && st.status !== "idle";
  const mineOn = st.id === MINE && st.status !== "idle";

  useEffect(() => () => { stopAudio(); urls.current.forEach(u => URL.revokeObjectURL(u)); }, []);
  // Al cambiar de frase se prepara el audio del nativo (voz de Gemini o Kokoro) para dibujarlo.
  useEffect(() => {
    let off = false;
    setNative(null); setClip(null); setAi2(null); setWord(-1); setLoading(true);
    audioBlobFor(text).then(async r => {
      if (off) return;
      if (!r) { setNative({ none: true }); return; }
      const url = URL.createObjectURL(r.blob);
      urls.current.push(url);
      const a = await decode(r.blob);
      if (!off) setNative({ url, a, engine: r.engine });
    }).catch(() => { if (!off) setNative({ none: true }); }).finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [text, ai]);

  const times = useMemo(() => (native && native.a ? wordTimes(text, native.a.span, native.a.env.length) : null), [native, text]);
  useEffect(() => {
    if (!nativeOn || !times) { setWord(-1); return undefined; }
    return subscribeProgress(p => setWord(times.findIndex(t => p >= t.start && p < t.end)));
  }, [nativeOn, times]);

  const result = native && native.a && clip ? compare(native.a, clip.a) : null;

  const record = async () => {
    stopAudio();
    try {
      const r = await startRecording({ maxMs: 12000 });
      setRec(r);
      r.done.then(async c => {
        urls.current.push(c.url);
        const a = await decode(c.url);
        setClip({ ...c, a }); setRec(null); setAi2(null);
        if (!scored.current.has(text)) {
          scored.current.add(text);
          update(d => { logSession(d, "shadow", { secs: Math.round(c.seconds) }, today); d.speakSeconds += Math.round(c.seconds); return addXP(d, 4, today, "Shadowing"); });
        }
      }).catch(() => { setRec(null); toast("No se pudo procesar la grabación. Inténtalo otra vez."); });
    } catch { toast("No se pudo usar el micrófono. Revisa el permiso del navegador."); }
  };
  const evaluate = async () => {
    setBusy(true);
    try {
      const r = await api("pron-assess", { audio: clip.wavBase64, target: text, level: s.profile.level });
      setAi2(r);
      update(d => { bumpSkill(d, "pron", r.score); });
    } catch (e) { toast(e.message); }
    setBusy(false);
  };
  const paceText = p => (p == null ? "—" : p > 1.25 ? "Más lento que el nativo" : p < 0.8 ? "Más rápido que el nativo" : "Velocidad muy parecida");

  return (
    <div className="grid2">
      <div className="card" style={{ display: "grid", gap: 14 }} data-testid="shadowing">
        <div className="card-head" style={{ margin: 0 }}>
          <div><span className="eyebrow">Tu voz contra la nativa</span><h2>Shadowing</h2></div>
          <button type="button" className="btn ghost sm" onClick={() => { stopAudio(); setIdx(i => i + 1); }}>Otra frase</button>
        </div>
        <p className="shadow-text" data-testid="shadow-text">
          {text.split(/\s+/).map((w, i) => {
            const r = ai2 && ai2.words[i];
            return <span key={i} className={(word === i ? "k-on" : "") + (r ? (r.ok ? " w-ok" : " w-miss") : "")} title={r && !r.ok ? r.issue_es : undefined}>{w} </span>;
          })}
        </p>
        <div className="row">
          {native && native.url ? (
            <button type="button" className={"btn audio-btn" + (nativeOn ? " playing" : "")} onClick={() => toggleClip(native.url, NATIVE)}><Icon name={nativeOn ? "stop" : "play"} /> {nativeOn ? "Detener" : "1 · Escuchar al nativo"}</button>
          ) : loading ? <button type="button" className="btn audio-btn loading" disabled><Icon name="dots" /> Preparando la voz…</button>
            : <SpeakButton text={text} label="1 · Escuchar" className="btn" />}
          {canRecord() && (rec
            ? <button type="button" className="btn rec" onClick={() => rec.stop()}><Icon name="stop" /> Detener grabación</button>
            : <button type="button" className="btn ghost" onClick={record}><Icon name="rec" /> {clip ? "Grabar otra vez" : "2 · Repetir y grabar"}</button>)}
          {clip && !rec && <button type="button" className={"btn ghost audio-btn" + (mineOn ? " playing" : "")} onClick={() => toggleClip(clip.url, MINE)}><Icon name={mineOn ? "stop" : "play"} /> {mineOn ? "Detener" : "Tu voz"}</button>}
        </div>
        {!canRecord() && <p className="hint">Este navegador no permite grabar. Usa Chrome, Edge o Safari actualizados.</p>}
        {native && native.none && <p className="hint">Para ver la onda del nativo activa la voz de Gemini o descarga la voz Kokoro en Ajustes → Voz. Con la voz del navegador solo se dibuja la tuya.</p>}
        <div>
          <div className="shadow-legend small"><span className="lg native">Nativo</span><span className="lg mine">Tú</span><span className="muted">Relleno: fuerza de la voz · Línea: entonación</span></div>
          <Waves native={native && native.a} mine={clip && clip.a} />
        </div>
        {result && (
          <div className="scores" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }} data-testid="shadow-scores">
            <div className="score"><b>{result.rhythm}</b><span>Ritmo</span></div>
            <div className="score"><b>{result.melody ?? "—"}</b><span>Entonación</span></div>
            <div className="score"><b>{result.pace != null ? Math.round(result.pace * 100) + "%" : "—"}</b><span>{paceText(result.pace)}</span></div>
          </div>
        )}
        {clip && !rec && ai && !ai2 && <button type="button" className="btn" onClick={evaluate} disabled={busy}>{busy ? "Escuchando…" : "3 · Evaluar pronunciación con IA"}</button>}
        {ai2 && (
          <div className="hint" data-testid="shadow-ai">
            <b>Pronunciación: {ai2.score}/100.</b> {ai2.tip_es}
            {ai2.words.some(w => !w.ok) && <ul className="small" style={{ margin: "6px 0 0 18px" }}>{ai2.words.filter(w => !w.ok).slice(0, 4).map((w, i) => <li key={i}><b>{w.word}</b>: {w.issue_es}</li>)}</ul>}
          </div>
        )}
      </div>
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Cómo se hace</h3>
          <ol className="small muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Escucha la frase dos veces siguiendo las palabras resaltadas.</li>
            <li>Repítela imitando la música: dónde sube, dónde baja y qué palabras suenan más fuerte.</li>
            <li>Compara las dos formas. Si tu línea es plana, exagera la entonación en el siguiente intento.</li>
          </ol>
        </div>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Qué miden los puntajes</h3>
          <p className="small muted"><b>Ritmo</b> y <b>entonación</b> comparan la forma de tu frase con la del nativo (0 a 100). Son aproximados y no revisan cada sonido: para eso usa «Evaluar pronunciación con IA». El resaltado de palabras también es estimado.</p>
        </div>
      </div>
    </div>
  );
}
