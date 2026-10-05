import { useState, useSyncExternalStore } from "react";
import Icon from "./Icon.jsx";
import { useProgressVar } from "./SpeakButton.jsx";
import { VOICES } from "../content/voices.js";
import { getAudioState, previewVoice, subscribeAudio } from "../lib/audio.js";

function Preview({ voice }) {
  const st = useSyncExternalStore(subscribeAudio, getAudioState);
  const active = st.id === "voice:" + voice && st.status !== "idle";
  const loading = active && st.status === "loading";
  const ref = useProgressVar(active && !loading);
  return (
    <button ref={ref} type="button" className={"audio-btn vp-play" + (active ? (loading ? " loading" : " playing") : "")} aria-label={active ? `Detener ${voice}` : `Escuchar ${voice}`}
      onClick={e => { e.stopPropagation(); previewVoice(voice); }}>
      <Icon name={active ? (loading ? "dots" : "stop") : "play"} />
    </button>
  );
}

/** Elige entre las 30 voces de Gemini; cada una se puede escuchar antes de elegirla. */
export default function VoicePicker({ value, onChange, canPreview = true }) {
  const [group, setGroup] = useState(() => (VOICES.find(v => v.id === value) || VOICES[0]).g);
  return (
    <div className="vp" data-testid="voice-picker">
      <div className="seg" role="group" aria-label="Tipo de voz">
        <button type="button" aria-pressed={group === "f"} onClick={() => setGroup("f")}>Femeninas</button>
        <button type="button" aria-pressed={group === "m"} onClick={() => setGroup("m")}>Masculinas</button>
      </div>
      <div className="vp-grid" role="radiogroup" aria-label="Voz">
        {VOICES.filter(v => v.g === group).map(v => (
          <div key={v.id} className={"vp-item" + (v.id === value ? " on" : "")}>
            <button type="button" role="radio" aria-checked={v.id === value} className="vp-pick" onClick={() => onChange(v.id)}>
              <b>{v.id}</b><span>{v.es}</span>
            </button>
            {canPreview && <Preview voice={v.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
