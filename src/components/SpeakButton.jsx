import { useEffect, useRef, useSyncExternalStore } from "react";
import Icon from "./Icon.jsx";
import { getAudioState, subscribeAudio, subscribeProgress, toggleAudio } from "../lib/audio.js";

/** Mientras el audio suena, pinta el avance en la variable CSS --p del botón (sin re-renderizar). */
export function useProgressVar(active) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.style.setProperty("--p", "0");
    if (!active) return undefined;
    return subscribeProgress(p => el.style.setProperty("--p", String(p)));
  }, [active]);
  return ref;
}

/**
 * Botón de audio: ▶ Escuchar → ◼ Detener. Mientras suena se pone verde y se llena como una barra
 * de reproducción; mientras carga la voz natural muestra una barra animada.
 */
export default function SpeakButton({ text, slow = false, label = "Escuchar", iconOnly = false, className = "btn ghost sm", style }) {
  const st = useSyncExternalStore(subscribeAudio, getAudioState);
  const id = (slow ? "slow:" : "norm:") + text;
  const active = st.id === id && st.status !== "idle";
  const loading = active && st.status === "loading";
  const ref = useProgressVar(active && !loading);
  const text2 = active ? (loading ? "Cargando…" : "Detener") : label;
  const engine = active && !loading ? (({ natural: "Voz natural de Gemini", kokoro: "Voz Kokoro (en tu dispositivo)", browser: "Voz del navegador" }[st.engine] || "") + (st.model ? " · " + st.model : "")) : "";
  return (
    <button ref={ref} type="button" className={"audio-btn " + className + (active ? (loading ? " loading" : " playing") : "")} style={style}
      aria-label={iconOnly ? text2 : undefined} aria-pressed={active} title={engine || undefined} data-engine={active ? st.engine || "" : ""} data-model={active && st.model ? st.model : undefined}
      onClick={() => toggleAudio(text, { slow, id })}>
      <Icon name={active ? (loading ? "dots" : "stop") : "play"} />{iconOnly ? null : text2}
    </button>
  );
}
