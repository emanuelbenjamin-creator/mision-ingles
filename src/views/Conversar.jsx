import { useEffect, useRef, useState } from "react";
import SpeakButton from "../components/SpeakButton.jsx";
import LiveVoice from "./LiveVoice.jsx";
import MicButton from "../components/MicButton.jsx";
import { scenariosFor, todaysScenario } from "../lib/missions.js";
import { aiOf, api } from "../lib/api.js";
import { ModelTag } from "../components/Diag.jsx";
import { addMistake, completeMission, logSession } from "../lib/game.js";

const GOAL_TURNS = 4;
const opener = sc => [{ role: "assistant", content: sc.open }];
const who = sc => sc.role.split(",")[0].replace(/^an? /, "");

const IELTS = { id: "ielts", name: "Examinador IELTS" };

export default function Conversar({ s, update, today, ai, toast, server = {}, scen, setScen, mode = "chat", setMode }) {
  const list = scenariosFor(s);
  const sc = list.find(x => x.id === scen) || todaysScenario(today, s);
  const voiceSc = scen === "ielts" ? IELTS : sc;
  const [turns, setTurns] = useState(() => opener(sc));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sugs, setSugs] = useState([]);
  const [count, setCount] = useState(0);
  const ctl = useRef(null);
  const chatRef = useRef(null);
  const base = useRef("");

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [turns, busy]);
  useEffect(() => () => ctl.current && ctl.current.abort(), []);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !ai) return;
    const next = [...turns, { role: "user", content: text }];
    setTurns(next); setInput(""); setSugs([]); setBusy(true);
    ctl.current = new AbortController();
    try {
      const r = await api("chat-turn", { scenario: sc.id, level: s.profile.level, turns: next.map(t => ({ role: t.role, content: t.content })) }, { signal: ctl.current.signal });
      const me = { ...next[next.length - 1], corr: r.correction || "ok" };
      setTurns([...next.slice(0, -1), me, { role: "assistant", content: r.reply, ai: aiOf(r) }]);
      const n = count + 1;
      setCount(n);
      update(d => {
        if (r.correction) addMistake(d, { wrong: text, right: r.correction.corrected, why: r.correction.explanation_es, rule: r.correction.rule, src: "conversación" }, today);
        if (n === GOAL_TURNS) { logSession(d, "chat", { scen: sc.id }, today); return completeMission(d, "chat", "Conversación", today); }
        return [];
      });
    } catch (e) {
      setTurns(turns); setInput(text);
      if (e.code !== "cancelled") toast(e.message);
    }
    setBusy(false);
  };

  const help = async () => {
    const last = [...turns].reverse().find(t => t.role === "assistant");
    try { const r = await api("chat-suggest", { scenario: sc.id, level: s.profile.level, last: last.content }); setSugs(r.suggestions || []); }
    catch (e) { toast(e.message); }
  };

  return (
    <div className="grid2">
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div className="seg" role="group" aria-label="Modo de conversación">
          <button type="button" aria-pressed={mode === "chat"} onClick={() => setMode("chat")}>Chat</button>
          <button type="button" aria-pressed={mode === "voice"} onClick={() => setMode("voice")}>Voz en vivo</button>
        </div>
        {mode === "voice" ? <LiveVoice s={s} update={update} today={today} ai={ai} toast={toast} server={server} engine={s.profile.liveEngine || (server.gemini === false ? "economy" : "live")} onEngineChange={v => update(d => { d.profile.liveEngine = v; })} opts={{ scenario: voiceSc.id }} title={voiceSc.name} /> : <>
        <div className="card-head" style={{ margin: 0 }}>
          <h2>{sc.name}</h2>
          <span className={"pill " + (count >= GOAL_TURNS ? "ok" : "neutral")}>{Math.min(count, GOAL_TURNS)} / {GOAL_TURNS} intercambios</span>
        </div>
        {!ai && <p className="hint">La conversación necesita el coach IA. Revisa en Ajustes que el servidor tenga la clave de Gemini (o tu código de acceso). Mientras tanto puedes practicar las otras misiones.</p>}
        <div className="chat" ref={chatRef} data-testid="chat">
          {turns.map((t, i) => t.role === "assistant" ? (
            <div className="msg ai" key={i}>
              <span className="who">{who(sc)}</span>
              <div className="bub">{t.content}</div>
              <ModelTag ev={t.ai} />
              <SpeakButton text={t.content} style={{ justifySelf: "start" }} />
            </div>
          ) : (
            <div className="msg me" key={i}>
              <span className="who">Tú</span>
              <div className="bub">{t.content}</div>
              {t.corr === "ok" && <div className="corr ok">Correcto y natural ✓</div>}
              {t.corr && t.corr !== "ok" && <div className="corr">Mejor: <b>{t.corr.corrected}</b><br />{t.corr.explanation_es}</div>}
            </div>
          ))}
          {busy && <div className="msg ai"><div className="bub thinking">escribiendo…</div></div>}
        </div>
        {sugs.length > 0 && <div className="sugs">{sugs.map(x => <button type="button" key={x} onClick={() => setInput(x)}>{x}</button>)}</div>}
        <div className="composer" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
          <textarea id="chatIn" value={input} onChange={e => setInput(e.target.value)} disabled={!ai}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Responde en inglés (habla, dicta o escribe)" aria-label="Tu respuesta" />
          <MicButton label="" maxMs={15000} disabled={!ai} onStart={() => { base.current = input ? input.trim() + " " : ""; }} onText={t => setInput(base.current + t)} />
          <button className="btn" type="button" onClick={send} disabled={!ai || busy}>Enviar</button>
        </div>
        <div className="row">
          <button className="btn ghost sm" type="button" onClick={help} disabled={!ai || busy}>¿Qué puedo decir?</button>
          <button className="btn ghost sm" type="button" onClick={() => { if (ctl.current) ctl.current.abort(); setTurns(opener(sc)); setSugs([]); setCount(0); }}>Reiniciar</button>
          {busy && <button className="btn ghost sm" type="button" onClick={() => ctl.current && ctl.current.abort()}>Detener</button>}
        </div>
        </>}
      </div>
      <div className="stack">
        <div className="card">
          <div className="card-head"><h2>Escenarios</h2><span className="small muted">Juego de roles</span></div>
          <div className="scen">
            {(mode === "voice" ? [...list, IELTS] : list).map(x => (
              <button type="button" key={x.id} aria-pressed={x.id === (mode === "voice" ? voiceSc.id : sc.id)} onClick={() => { if (ctl.current) ctl.current.abort(); setScen(x.id); }}>
                {x.name}{x.id === todaysScenario(today, s).id ? " · hoy" : ""}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Cómo practicar</h3>
          <p className="muted small">{mode === "voice" ? "Una llamada real con el coach: habla y escucha sin escribir. Al colgar, pulsa «Revisar mi conversación» para ver tus errores y sumar XP. Con 1 minuto o más completas la misión de conversación." : <>Responde con frases completas. Después de cada mensaje verás si hubo un error y cómo decirlo mejor; los errores van a tu cuaderno de repaso. Pulsa «Escuchar» para oír la respuesta e imitar la entonación.</>}</p>
        </div>
      </div>
    </div>
  );
}
