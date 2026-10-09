import { useMemo, useState } from "react";
import LiveVoice from "./LiveVoice.jsx";
import VoicePicker from "../components/VoicePicker.jsx";
import { scenariosFor } from "../lib/missions.js";
import { weekStart } from "../lib/report.js";
import { accentLabel, toneOf, voiceLabel } from "../content/voices.js";
import { characterFor } from "../content/characters.js";
import { playAudio } from "../lib/audio.js";

const MODES = [
  { id: "free", name: "Conversación libre", desc: "Habla de lo que quieras con un compañero nativo." },
  { id: "tutor", name: "Profesor de speaking", desc: "Te hace preguntas, te pide ampliar y te corrige." },
  { id: "roleplay", name: "Juego de roles", desc: "Entrevista, cliente, aeropuerto y los de tu profesión." },
  { id: "ielts", name: "Examinador IELTS", desc: "Un examen de speaking completo por voz." },
];
const TOPICS = ["My weekend", "My job", "Travel", "Movies and series", "Food", "Technology", "Football", "My city", "Future plans"];
const mm = s => `${Math.floor(s / 60)} min`;

/** Panel dedicado a Gemini Live: modo, tema, voz, forma de corregir, ritmo, llamada e historial. */
export default function EnVivo(props) {
  const { s, update, ai, server = {} } = props;
  const [mode, setMode] = useState("free");
  const [topic, setTopic] = useState("");
  const scenarios = useMemo(() => scenariosFor(s), [s]);
  const [scen, setScen] = useState(scenarios[0].id);
  const [correction, setCorrection] = useState("end");
  const [pace, setPace] = useState("normal");
  const cards = s.profile.liveCards !== false;
  const [locked, setLocked] = useState(false);
  const custom = s.profile.liveVoiceMode === "custom";
  const engine = s.profile.liveEngine || (server.gemini === false ? "economy" : "live");
  const setEngine = v => update(d => { d.profile.liveEngine = v; });

  const scenario = mode === "roleplay" ? scen : mode;
  const title = mode === "roleplay" ? (scenarios.find(x => x.id === scen) || {}).name : MODES.find(m => m.id === mode).name;
  // Cada escenario tiene su personaje, con voz, acento y tono propios; el alumno puede elegir otra voz.
  const who = characterFor(scenario);
  const voice = custom ? s.profile.liveVoice || s.profile.voice || "Kore" : who.voice;
  const accent = custom ? s.profile.accent || "us" : who.accent;
  const tone = custom ? s.profile.tone || "friendly" : who.tone;
  const opts = { scenario, topic: mode === "free" || mode === "tutor" ? topic : "", correction: mode === "tutor" ? "now" : correction, pace, voice, accent, tone, cards, kokoroVoice: custom ? undefined : who.kokoroVoice };
  const hello = `Hi, I'm ${who.name}. Ready when you are!`;

  const hist = s.liveSessions || [];
  const ws = weekStart(props.today);
  const weekSecs = hist.filter(h => h.d >= ws).reduce((a, h) => a + h.secs, 0);
  const todaySecs = hist.filter(h => h.d === props.today).reduce((a, h) => a + h.secs, 0);

  return (
    <div className="grid2">
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow">Gemini Live · voz en tiempo real</span>
          <h1>Habla en vivo</h1>
          <p className="muted">Una llamada real con tu coach de inglés: hablas, te responde con voz natural y puedes interrumpirlo. Al colgar recibes tu revisión con errores y puntajes.</p>
        </div>
        <div className="card">
          <LiveVoice key={scenario + voice + accent + tone + pace + correction + engine + cards} {...props} opts={opts} title={title} onLiveChange={setLocked} engine={engine} onEngineChange={setEngine} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Tus llamadas</h2><span className="small muted">hoy {mm(todaySecs)} · semana {mm(weekSecs)}</span></div>
          {hist.length ? (
            <div className="mistakes">{hist.slice(-8).reverse().map((h, i) => (
              <div key={i} className="mk" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span><b>{h.title}</b> <span className="small muted">· {h.d} · {mm(h.secs)}</span></span>
                <span className="small mono">{h.fluency != null ? `fluidez ${h.fluency}` : ""}{h.errors ? ` · ${h.errors} errores` : ""}</span>
              </div>
            ))}</div>
          ) : <p className="empty">Cuando termines y revises tu primera llamada, aparecerá aquí.</p>}
        </div>
      </div>

      <div className="stack">
        <fieldset className="card live-setup" disabled={locked} data-testid="live-setup">
          <legend className="sr-only">Configura tu llamada</legend>
          <div className="card-head"><h2>Configura tu llamada</h2>{locked && <span className="pill">En llamada</span>}</div>
          <div className="field">
            <label>Motor de voz</label>
            <div className="seg" role="group" aria-label="Motor de voz">
              <button type="button" aria-pressed={engine === "live"} disabled={server.gemini === false} onClick={() => setEngine("live")}>Gemini Live</button>
              <button type="button" aria-pressed={engine === "economy"} onClick={() => setEngine("economy")}>Económico</button>
            </div>
            <p className="small muted">{engine === "live" ? "Tiempo real: puedes interrumpir al coach." : "Por turnos: reconocimiento del navegador o Whisper, modelos gratuitos (Gemini, Groq, Cerebras) y tu voz elegida. Úsalo si Gemini Live está ocupado o sin cuota."}</p>
          </div>
          <div className="choice">
            {MODES.map(m => <button type="button" key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.name}<span>{m.desc}</span></button>)}
          </div>
          {(mode === "free" || mode === "tutor") && (
            <div className="field">
              <label htmlFor="lvTopic">Tema (opcional)</label>
              <input type="text" id="lvTopic" value={topic} maxLength={80} onChange={e => setTopic(e.target.value)} placeholder="Ej.: mi trabajo, viajes, fútbol…" />
              <div className="sugs">{TOPICS.map(t => <button type="button" key={t} onClick={() => setTopic(t)}>{t}</button>)}</div>
            </div>
          )}
          {mode === "roleplay" && (
            <div className="field">
              <label htmlFor="lvScen">Escenario</label>
              <select id="lvScen" value={scen} onChange={e => setScen(e.target.value)}>{scenarios.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            </div>
          )}
          {mode !== "ielts" && mode !== "tutor" && (
            <div className="field">
              <label>Correcciones</label>
              <div className="seg" role="group" aria-label="Correcciones">
                <button type="button" aria-pressed={correction === "end"} onClick={() => setCorrection("end")}>Al final</button>
                <button type="button" aria-pressed={correction === "now"} onClick={() => setCorrection("now")}>Al momento</button>
              </div>
            </div>
          )}
          {mode !== "ielts" && (
            <div className="field">
              <label>Tarjetas en pantalla</label>
              <div className="seg" role="group" aria-label="Tarjetas en pantalla">
                <button type="button" aria-pressed={cards} onClick={() => update(d => { d.profile.liveCards = true; })}>Activadas</button>
                <button type="button" aria-pressed={!cards} onClick={() => update(d => { d.profile.liveCards = false; })}>Apagadas</button>
              </div>
              <p className="small muted">Mientras hablan, el coach te muestra correcciones, palabras nuevas y retos. Puedes guardarlos con un toque. Si la llamada no conecta, prueba a apagarlas.</p>
            </div>
          )}
          {mode !== "ielts" && (
            <div className="field">
              <label>Ritmo del coach</label>
              <div className="seg" role="group" aria-label="Ritmo">
                <button type="button" aria-pressed={pace === "normal"} onClick={() => setPace("normal")}>Natural</button>
                <button type="button" aria-pressed={pace === "slow"} onClick={() => setPace("slow")}>Lento y claro</button>
              </div>
            </div>
          )}
          <div className="field">
            <label>Con quién hablas</label>
            <div className="who-card" data-testid="character">
              <div className="who-avatar" aria-hidden="true">{who.name.replace(/^(Dr|Mr|Mrs|Ms)\.\s*/, "")[0]}</div>
              <div style={{ minWidth: 0 }}>
                <b>{who.name}</b>
                <div className="small muted">{who.bio_es}</div>
                <div className="small"><span className="pill neutral">{accentLabel(accent)}</span> <span className="pill neutral">{toneOf(tone).es}</span> <span className="pill neutral">{voiceLabel(voice)}</span></div>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => playAudio(hello, { id: "who:" + who.id + voice, voice, accent, tone, kokoroFallback: who.kokoroVoice })}>Escuchar</button>
            </div>
            <div className="seg" role="group" aria-label="Voz de la llamada">
              <button type="button" aria-pressed={!custom} onClick={() => update(d => { d.profile.liveVoiceMode = "character"; })}>Voz del personaje</button>
              <button type="button" aria-pressed={custom} onClick={() => update(d => { d.profile.liveVoiceMode = "custom"; })}>Elegir otra</button>
            </div>
            {custom && <>
              <VoicePicker value={voice} canPreview={ai} onChange={v => update(d => { d.profile.liveVoice = v; })} />
              <p className="small muted">Pulsa ▶ para escuchar cada voz. Usa el acento y el tono de tus Ajustes.</p>
            </>}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
