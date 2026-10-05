import Speak60 from "./Speak60.jsx";
import Pronunciacion from "./Pronunciacion.jsx";
import IeltsMock from "./IeltsMock.jsx";
import { canRecognize } from "../lib/speech.js";

export default function Hablar(props) {
  const { mode, setMode } = props;
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="seg" role="group" aria-label="Modo">
          <button type="button" aria-pressed={mode === "speak"} onClick={() => setMode("speak")}>Habla 60 s</button>
          <button type="button" aria-pressed={mode === "pron"} onClick={() => setMode("pron")}>Pronunciación</button>
          <button type="button" aria-pressed={mode === "ielts"} onClick={() => setMode("ielts")}>Simulacro IELTS</button>
        </div>
        <span className="small muted">{canRecognize() ? "Usa el micrófono o dicta con el teclado" : "Dicta con el micrófono de tu teclado o escribe"}</span>
      </div>
      {mode === "pron" ? <Pronunciacion key={props.soundId || "hoy"} {...props} /> : mode === "ielts" ? <IeltsMock {...props} /> : <Speak60 {...props} />}
    </>
  );
}
