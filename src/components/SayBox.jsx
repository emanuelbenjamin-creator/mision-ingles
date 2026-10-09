import { useRef, useState } from "react";
import MicButton from "./MicButton.jsx";

/**
 * Entrada «dilo en voz alta»: micrófono (reconocimiento del navegador o Whisper) y, como alternativa,
 * un campo para escribir. Llama onSay(texto) cuando termina de hablar o al pulsar el botón.
 */
export default function SayBox({ onSay, disabled, maxMs = 15000, placeholder = "…o escríbelo aquí", label = "Hablar", send = "Enviar", id = "say", onStart }) {
  const [text, setText] = useState("");
  const latest = useRef("");
  const set = v => { latest.current = v; setText(v); };
  const submit = () => {
    const t = latest.current.trim();
    if (!t || disabled) return;
    set("");
    onSay(t);
  };
  return (
    <div className="saybox" data-testid={"saybox-" + id}>
      <MicButton className="btn" label={label} maxMs={maxMs} disabled={disabled} onText={set} onStart={onStart} onStop={submit} />
      <input type="text" value={text} disabled={disabled} aria-label="Lo que dices" placeholder={placeholder} autoComplete="off" autoCapitalize="off" spellCheck="false"
        onChange={e => set(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
      <button type="button" className="btn ghost" onClick={submit} disabled={disabled || !text.trim()}>{send}</button>
    </div>
  );
}
