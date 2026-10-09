import Historia from "./Historia.jsx";
import Juegos from "./Juegos.jsx";
import ManosLibres from "./ManosLibres.jsx";
import { PLAY_XP_CAP } from "../lib/game.js";

/** Sección «Jugar»: historias con decisiones, juegos de voz y práctica manos libres. */
export default function Jugar(props) {
  const { mode, setMode, s, today } = props;
  const used = (s.playXP || {})[today] || 0;
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="seg" role="group" aria-label="Modo de juego">
          <button type="button" aria-pressed={mode !== "juegos" && mode !== "manos"} onClick={() => setMode("historias")}>Historias</button>
          <button type="button" aria-pressed={mode === "juegos"} onClick={() => setMode("juegos")}>Juegos de voz</button>
          <button type="button" aria-pressed={mode === "manos"} onClick={() => setMode("manos")}>Manos libres</button>
        </div>
        <span className="small muted" data-testid="play-xp">XP de juegos hoy: {used} / {PLAY_XP_CAP}</span>
      </div>
      {mode === "juegos" ? <Juegos {...props} /> : mode === "manos" ? <ManosLibres {...props} /> : <Historia {...props} />}
    </>
  );
}
