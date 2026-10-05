import { useSyncExternalStore } from "react";
import Icon from "./Icon.jsx";
import { getAudioState, subscribeAudio, toggleAudio } from "../lib/audio.js";

/** Botón de audio: ▶ Escuchar ↔ ◼ Detener mientras suena (… mientras carga la voz natural). */
export default function SpeakButton({ text, slow = false, label = "Escuchar", iconOnly = false, className = "btn ghost sm", style }) {
  const st = useSyncExternalStore(subscribeAudio, getAudioState);
  const id = (slow ? "slow:" : "norm:") + text;
  const active = st.id === id && st.status !== "idle";
  const loading = active && st.status === "loading";
  const text2 = active ? (loading ? "Cargando…" : "Detener") : label;
  return (
    <button type="button" className={className + (active ? " playing" : "")} style={style} aria-label={iconOnly ? text2 : undefined} aria-pressed={active}
      onClick={() => toggleAudio(text, { slow, id })}>
      <Icon name={active ? (loading ? "dots" : "stop") : "play"} />{iconOnly ? null : text2}
    </button>
  );
}
