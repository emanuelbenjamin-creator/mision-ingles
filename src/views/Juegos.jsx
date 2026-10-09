import { useEffect, useRef, useState } from "react";
import SpeakButton from "../components/SpeakButton.jsx";
import SayBox from "../components/SayBox.jsx";
import { CLOCK_QUESTIONS, ECHO, ECHO_SPEEDS, RIDDLES, TWISTERS } from "../content/games.js";
import { band } from "../lib/level.js";
import { hash } from "../lib/dates.js";
import { playAudio, stopAudio } from "../lib/audio.js";
import { clockScore, echoScore, riddleRight, twisterScore } from "../lib/voicegames.js";
import { addPlayXP, logSession, setRecord } from "../lib/game.js";

const GAMES = [
  { id: "twister", name: "Trabalenguas", desc: "Dilo claro y rápido. Gana precisión más velocidad." },
  { id: "clock", name: "Contra reloj", desc: "15 segundos para responder hablando todo lo que puedas." },
  { id: "riddle", name: "Adivina la palabra", desc: "Una voz la describe y tú la dices. 5 rondas." },
  { id: "echo", name: "Eco veloz", desc: "Repite la frase cada vez más rápido." },
];
/** n elementos distintos de una lista, empezando en un punto que cambia cada día y cada partida. */
const pick = (list, n, seed) => { const start = hash(seed) % list.length; return Array.from({ length: Math.min(n, list.length) }, (_, i) => list[(start + i) % list.length]); };

export default function Juegos({ s, update, today, toast }) {
  const [game, setGame] = useState(null);
  const [round, setRound] = useState(0); // cambia en cada partida para variar el contenido
  useEffect(() => () => stopAudio(), []);
  const b = band(s.profile.level);
  const end = (id, name, points, xp) => update(d => {
    const record = setRecord(d, id, points);
    logSession(d, "game", { game: id, points }, today);
    return [...(record ? [`¡Nuevo récord en ${name}: ${points} puntos!`] : []), ...addPlayXP(d, xp, today, name)];
  });
  const props = { b, today, round, toast, best: (s.games || {})[game] || 0, onEnd: (points, xp) => end(game, GAMES.find(g => g.id === game).name, points, xp), again: () => setRound(r => r + 1) };

  if (!game) {
    return (
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow">Juegos de voz</span>
          <h2>Dos minutos, en voz alta</h2>
          <p className="muted">Minijuegos para soltar la lengua. Funcionan con el micrófono del navegador y no necesitan el coach IA.</p>
        </div>
        <div className="adv-grid" data-testid="games">
          {GAMES.map(g => (
            <button type="button" key={g.id} className="card adv" onClick={() => { setGame(g.id); setRound(r => r + 1); }}>
              <b>{g.name}</b>
              <span className="small muted">{g.desc}</span>
              <span className="pill neutral">Récord: {(s.games || {})[g.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const Game = { twister: Twister, clock: Clock, riddle: Riddle, echo: Echo }[game];
  return (
    <div className="card" style={{ display: "grid", gap: 14 }} data-testid={"game-" + game}>
      <div className="card-head" style={{ margin: 0 }}>
        <div><span className="eyebrow">Récord: {props.best}</span><h2>{GAMES.find(g => g.id === game).name}</h2></div>
        <button type="button" className="btn ghost sm" onClick={() => { stopAudio(); setGame(null); }}>Otros juegos</button>
      </div>
      <Game key={round} {...props} />
    </div>
  );
}

function Result({ points, lines, again }) {
  return (
    <div className="hint" data-testid="game-result">
      <b>{points} puntos.</b> {lines}
      <div className="row" style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={again}>Jugar otra vez</button></div>
    </div>
  );
}

/* ---------- Trabalenguas: 3 rondas ---------- */
function Twister({ today, round, onEnd, again }) {
  const set = useRef(pick(TWISTERS, 3, today + "tw" + round)).current;
  const [i, setI] = useState(0);
  const [res, setRes] = useState([]);
  const t0 = useRef(0);
  const cur = set[i];
  const done = res.length === set.length;
  const say = text => {
    const secs = t0.current ? (Date.now() - t0.current) / 1000 : cur.secs * 2;
    t0.current = 0;
    const r = twisterScore(cur.text, text, secs, cur.secs);
    const next = [...res, { ...r, secs }];
    setRes(next);
    if (next.length === set.length) onEnd(next.reduce((a, x) => a + x.points, 0), 6);
    else setI(i + 1);
  };
  const last = res[res.length - 1];
  return (
    <>
      {!done && <>
        <span className="pill neutral">Ronda {i + 1} de {set.length} · practica {cur.focus}</span>
        <p className="shadow-text" data-testid="twister-text">{cur.text}</p>
        <div className="row"><SpeakButton text={cur.text} label="Escuchar" /><SpeakButton text={cur.text} slow label="Lento" /></div>
        <SayBox id="twister" onSay={say} onStart={() => { stopAudio(); t0.current = Date.now(); }} label="Decirlo" maxMs={12000} />
        <p className="small muted">Pulsa «Decirlo», dilo y pulsa «Detener». El tiempo cuenta desde que empiezas a grabar.</p>
      </>}
      {last && !done && <p className="small">Anterior: precisión {last.accuracy}% · velocidad +{last.bonus}</p>}
      {done && <Result points={res.reduce((a, x) => a + x.points, 0)} again={again}
        lines={`Precisión media ${Math.round(res.reduce((a, x) => a + x.accuracy, 0) / res.length)}%. El bono de velocidad solo cuenta si se entiende al menos el 80 %.`} />}
    </>
  );
}

/* ---------- Contra reloj: 1 pregunta, 15 s ---------- */
function Clock({ b, today, round, onEnd, again }) {
  const q = useRef(pick(CLOCK_QUESTIONS[b], 1, today + "ck" + round)[0]).current;
  const [left, setLeft] = useState(null);
  const [res, setRes] = useState(null);
  useEffect(() => {
    if (left == null || left <= 0) return undefined;
    const id = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  const say = text => { const r = clockScore(text); setRes(r); setLeft(null); onEnd(r.points, 6); };
  return (
    <>
      <p className="shadow-text">{q}</p>
      {!res && <>
        <div className="row"><SpeakButton text={q} label="Escuchar la pregunta" />{left != null && <span className={"pill " + (left <= 5 ? "bad" : "")} data-testid="clock-left">{left} s</span>}</div>
        <SayBox id="clock" onSay={say} onStart={() => { stopAudio(); setLeft(15); }} label="Empezar a hablar" maxMs={15000} />
        <p className="small muted">Al pulsar «Empezar a hablar» corren 15 segundos y la grabación se corta sola. No busques la frase perfecta: sigue hablando.</p>
      </>}
      {res && <Result points={res.points} again={again} lines={`Dijiste ${res.words} palabras, ${res.unique} distintas. Para subir: agrega razones («because…») y ejemplos («for example…»).`} />}
    </>
  );
}

/* ---------- Adivina la palabra: 5 rondas ---------- */
function Riddle({ b, today, round, onEnd, again }) {
  const set = useRef(pick(RIDDLES[b], 5, today + "rd" + round)).current;
  const [i, setI] = useState(0);
  const [hits, setHits] = useState([]);
  const [shown, setShown] = useState(false);
  const cur = set[i];
  const done = hits.length === set.length;
  const hear = () => playAudio(cur.clue, { id: "riddle" + i });
  useEffect(() => { if (!done) { setShown(false); const id = setTimeout(hear, 300); return () => clearTimeout(id); } return undefined; }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const say = text => {
    stopAudio();
    const ok = riddleRight(cur, text);
    const next = [...hits, ok];
    setHits(next);
    if (next.length === set.length) onEnd(next.filter(Boolean).length * 20, 6);
    else setI(i + 1);
  };
  return (
    <>
      {!done && <>
        <span className="pill neutral">Ronda {i + 1} de {set.length}</span>
        <div className="row">
          <button type="button" className="btn ghost" onClick={hear}>Escuchar la pista otra vez</button>
          <button type="button" className="btn ghost" onClick={() => setShown(v => !v)} aria-pressed={shown}>{shown ? "Ocultar texto" : "Ver la pista escrita"}</button>
        </div>
        {shown ? <p className="shadow-text" data-testid="riddle-clue">{cur.clue}</p> : <p className="muted">Escucha la pista y di la palabra en inglés.</p>}
        <SayBox id="riddle" onSay={say} onStart={stopAudio} label="Decir la palabra" maxMs={6000} />
      </>}
      {hits.length > 0 && <p className="small words" data-testid="riddle-hits">{hits.map((h, k) => <span key={k} className={h ? "w-ok" : "w-miss"}>{h ? "✓" : "✗"} {set[k].answer} </span>)}</p>}
      {done && <Result points={hits.filter(Boolean).length * 20} again={again} lines={`Acertaste ${hits.filter(Boolean).length} de ${set.length}.`} />}
    </>
  );
}

/* ---------- Eco veloz: 1 frase a 3 velocidades ---------- */
function Echo({ b, today, round, onEnd, again }) {
  const text = useRef(pick(ECHO[b], 1, today + "ec" + round)[0]).current;
  const [lv, setLv] = useState(0);
  const [res, setRes] = useState([]);
  const [over, setOver] = useState(false);
  const speed = ECHO_SPEEDS[Math.min(lv, ECHO_SPEEDS.length - 1)];
  const hear = () => playAudio(text, { id: "echo" + lv, speed });
  useEffect(() => { if (!over) { const id = setTimeout(hear, 300); return () => clearTimeout(id); } return undefined; }, [lv, over]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = r => r.reduce((a, x) => a + x.points, 0);
  const say = said => {
    stopAudio();
    const r = echoScore(text, said, speed);
    const next = [...res, r];
    setRes(next);
    if (!r.pass || lv === ECHO_SPEEDS.length - 1) { setOver(true); onEnd(total(next), 6); }
    else setLv(lv + 1);
  };
  return (
    <>
      <span className="pill neutral">Velocidad {Math.min(lv + 1, ECHO_SPEEDS.length)} de {ECHO_SPEEDS.length} · ×{speed}</span>
      <p className="shadow-text">{text}</p>
      {!over && <>
        <div className="row"><button type="button" className="btn ghost" onClick={hear}>Escuchar otra vez</button></div>
        <SayBox id="echo" onSay={say} onStart={stopAudio} label="Repetir" maxMs={10000} />
        <p className="small muted">Repite la frase completa. Si se entiende al menos el 80 %, sube la velocidad.</p>
      </>}
      {res.length > 0 && <p className="small words">{res.map((r, k) => <span key={k} className={r.pass ? "w-ok" : "w-miss"}>×{ECHO_SPEEDS[k]}: {r.accuracy}% </span>)}</p>}
      {over && <Result points={total(res)} again={again} lines={res[res.length - 1].pass ? "¡Llegaste a velocidad nativa rápida!" : "Te quedaste en esta velocidad. Escúchala lenta, marca dónde se unen las palabras y vuelve a intentarlo."} />}
    </>
  );
}
