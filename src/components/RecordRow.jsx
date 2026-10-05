import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Icon from "./Icon.jsx";
import { useProgressVar } from "./SpeakButton.jsx";
import { canRecord, startRecording } from "../lib/recorder.js";
import { getAudioState, stopAudio, subscribeAudio, toggleClip } from "../lib/audio.js";
import { api } from "../lib/api.js";

/** Grábate → escúchate → (con IA) Gemini evalúa tu pronunciación a partir del audio. */
export default function RecordRow({ target, id, ai, level, toast, onResult }) {
  const [rec, setRec] = useState(null);
  const [clip, setClip] = useState(null);
  const [busy, setBusy] = useState(false);
  const st = useSyncExternalStore(subscribeAudio, getAudioState);
  const clipId = "clip:" + id;
  const playing = st.id === clipId && st.status !== "idle";
  const clipRef = useProgressVar(playing);
  const urlRef = useRef(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  if (!canRecord()) return null;

  const start = async () => {
    stopAudio();
    try {
      const r = await startRecording({ maxMs: 8000 });
      setRec(r);
      r.done.then(c => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = c.url;
        setClip(c);
        setRec(null);
      }).catch(() => { setRec(null); toast("No se pudo procesar la grabación. Inténtalo otra vez."); });
    } catch { toast("No se pudo usar el micrófono. Revisa el permiso del navegador."); }
  };
  const evaluate = async () => {
    setBusy(true);
    try { onResult(await api("pron-assess", { audio: clip.wavBase64, target, level })); }
    catch (e) { toast(e.message); }
    setBusy(false);
  };

  return (
    <div className="row">
      {rec ? <button type="button" className="btn rec sm" onClick={() => rec.stop()}><Icon name="stop" /> Detener grabación</button>
        : <button type="button" className="btn ghost sm" onClick={start}><Icon name="rec" /> {clip ? "Grabar otra vez" : "Grábate"}</button>}
      {clip && !rec && <button ref={clipRef} type="button" className={"audio-btn btn ghost sm" + (playing ? " playing" : "")} onClick={() => toggleClip(clip.url, clipId)}><Icon name={playing ? "stop" : "play"} /> {playing ? "Detener" : "Tu voz"}</button>}
      {clip && !rec && ai && <button type="button" className="btn sm" onClick={evaluate} disabled={busy}>{busy ? "Escuchando…" : "Evaluar con IA"}</button>}
    </div>
  );
}
