import { useState, useSyncExternalStore } from "react";
import Icon from "./Icon.jsx";
import { useProgressVar } from "./SpeakButton.jsx";
import { KOKORO_VOICES, getKokoroState, kokoroSupported, loadKokoro, subscribeKokoro } from "../lib/kokoro.js";
import { getAudioState, previewKokoro, subscribeAudio } from "../lib/audio.js";

function Preview({ id }) {
  const st = useSyncExternalStore(subscribeAudio, getAudioState);
  const active = st.id === "kvoice:" + id && st.status !== "idle";
  const loading = active && st.status === "loading";
  const ref = useProgressVar(active && !loading);
  return (
    <button ref={ref} type="button" className={"audio-btn vp-play" + (active ? (loading ? " loading" : " playing") : "")} aria-label={active ? "Detener" : "Escuchar " + id} onClick={() => previewKokoro(id)}>
      <Icon name={active ? (loading ? "dots" : "stop") : "play"} />
    </button>
  );
}

/** Descarga y elección de la voz Kokoro (gratis, en el dispositivo, sin internet después). */
export default function KokoroPanel({ value, onChange, onEnable }) {
  const k = useSyncExternalStore(subscribeKokoro, getKokoroState);
  const cur = KOKORO_VOICES.find(v => v.id === value) || KOKORO_VOICES[0];
  const [group, setGroup] = useState(cur.accent + cur.g);
  if (!kokoroSupported()) return <p className="small muted">Este navegador no puede ejecutar la voz Kokoro.</p>;
  return (
    <div className="kokoro" data-testid="kokoro">
      {k.status !== "ready" && (
        <div className="hint">
          <b>Voz natural sin internet y sin límites.</b> Se descarga una sola vez (unos 90 MB) y queda guardada en este dispositivo. Mejor con Wi-Fi.
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm" onClick={() => { onEnable(); loadKokoro(); }} disabled={k.status === "downloading"}>
              {k.status === "downloading" ? `Descargando… ${Math.round(k.progress * 100)}%` : "Descargar voz Kokoro"}
            </button>
          </div>
          {k.status === "downloading" && <div className="bar" style={{ marginTop: 8 }}><i style={{ width: `${Math.round(k.progress * 100)}%` }} /></div>}
          {k.status === "error" && <p className="err" style={{ marginTop: 6 }}>No se pudo cargar: {k.error}</p>}
        </div>
      )}
      {k.status === "ready" && <p className="small" style={{ color: "var(--good)" }}>✓ Voz Kokoro lista en este dispositivo. También se usa como respaldo si la voz de Gemini falla.</p>}
      <div className="seg" role="group" aria-label="Grupo de voces Kokoro">
        {[["usf", "EE. UU. · mujeres"], ["usm", "EE. UU. · hombres"], ["ukf", "Reino Unido · mujeres"], ["ukm", "Reino Unido · hombres"]].map(([id, n]) => <button type="button" key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>{n}</button>)}
      </div>
      <div className="vp-grid">
        {KOKORO_VOICES.filter(v => v.accent + v.g === group).map(v => (
          <div key={v.id} className={"vp-item" + (v.id === value ? " on" : "")}>
            <button type="button" role="radio" aria-checked={v.id === value} className="vp-pick" onClick={() => onChange(v.id)}>
              <b>{v.name}</b><span>{v.accent === "us" ? "EE. UU." : "Reino Unido"}</span>
            </button>
            {k.status === "ready" && <Preview id={v.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
