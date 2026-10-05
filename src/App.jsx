import { useCallback, useEffect, useState } from "react";
import Icon from "./components/Icon.jsx";
import Hoy from "./views/Hoy.jsx";
import Hablar from "./views/Hablar.jsx";
import Conversar from "./views/Conversar.jsx";
import Gramatica from "./views/Gramatica.jsx";
import Repaso from "./views/Repaso.jsx";
import Ajustes from "./views/Ajustes.jsx";
import Onboarding from "./views/Onboarding.jsx";
import { useStore } from "./store.js";
import { dkey } from "./lib/dates.js";
import { streak } from "./lib/game.js";
import { health, setAccessCode } from "./lib/api.js";
import { configureAudio } from "./lib/audio.js";

const TABS = [["hoy", "Hoy"], ["hablar", "Hablar"], ["conversar", "Conversar"], ["gramatica", "Gramática"], ["repaso", "Repaso"]];
const readTab = () => { try { return sessionStorage.getItem("mi-tab") || "hoy"; } catch { return "hoy"; } };

export default function App() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback(msg => setToasts(t => [...t, msg]), []);
  const onMessages = useCallback(msgs => setToasts(t => [...t, ...msgs]), []);
  const [s, update, replace] = useStore(onMessages);
  const [nav, setNav] = useState({ tab: readTab(), mode: "speak", soundId: null, topic: null, scen: null, chatMode: "chat" });
  const [server, setServer] = useState({ ai: false, accessCodeRequired: false, checked: false });
  const [settings, setSettings] = useState(false);
  const today = dkey();

  useEffect(() => { health().then(h => setServer({ ...h, checked: true })); }, []);
  useEffect(() => { setAccessCode(s.profile.accessCode); }, [s.profile.accessCode]);
  useEffect(() => { try { sessionStorage.setItem("mi-tab", nav.tab); } catch { /* sin almacenamiento */ } }, [nav.tab]);
  useEffect(() => {
    if (!toasts.length) return undefined;
    const id = setTimeout(() => setToasts(t => t.slice(1)), 2600);
    return () => clearTimeout(id);
  }, [toasts]);

  const ai = server.ai && (!server.accessCodeRequired || !!s.profile.accessCode);
  const { voiceMode, voice, accent, rate } = s.profile;
  useEffect(() => { configureAudio({ mode: voiceMode, voice, accent, rate, ai }); }, [voiceMode, voice, accent, rate, ai]);
  const go = target => { setNav(n => ({ ...n, ...target })); window.scrollTo({ top: 0 }); };
  const xp = s.xpByDay[today] || 0;
  const aiLabel = !server.checked ? "Coach IA: conectando…" : ai ? "Coach IA activo" : server.ai ? "Falta código de acceso" : "Modo básico (sin IA)";
  const common = { s, update, today, ai, toast };

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="top-row">
            <div className="brand"><b>Misión Inglés</b><span className="lvl">{s.profile.level}</span></div>
            <div className="chips">
              <span className="chip flame" title="Racha de días"><Icon name="flame" />{streak(s, today)} días</span>
              <span className="chip" title="XP de hoy" data-testid="xp-chip"><Icon name="bolt" />{xp} / {s.profile.dailyGoal} XP</span>
              <button type="button" className={"chip " + (ai ? "ai-on" : "ai-off")} onClick={() => setSettings(true)} title="Estado del coach IA">{aiLabel}</button>
              <button className="iconbtn" type="button" onClick={() => setSettings(true)}>Ajustes</button>
            </div>
          </div>
          {s.profile.onboarded && (
            <nav className="tabs" role="tablist" aria-label="Secciones">
              {TABS.map(([id, label]) => (
                <button key={id} className="tab" role="tab" type="button" aria-selected={nav.tab === id} onClick={() => go({ tab: id })}>{label}</button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="wrap">
        {!s.profile.onboarded ? (
          <section className="view"><Onboarding s={s} onDone={profile => update(d => { d.profile = { ...d.profile, ...profile }; return ["¡Listo! Estas son tus misiones de hoy."]; })} /></section>
        ) : (
          <section className="view" key={nav.tab}>
            {nav.tab === "hoy" && <Hoy s={s} today={today} go={go} />}
            {nav.tab === "hablar" && <Hablar {...common} mode={nav.mode} setMode={mode => setNav(n => ({ ...n, mode }))} soundId={nav.soundId} setSoundId={soundId => setNav(n => ({ ...n, soundId }))} />}
            {nav.tab === "conversar" && <Conversar key={nav.scen || "hoy"} {...common} scen={nav.scen} setScen={scen => setNav(n => ({ ...n, scen }))} mode={nav.chatMode} setMode={chatMode => setNav(n => ({ ...n, chatMode }))} />}
            {nav.tab === "gramatica" && <Gramatica {...common} topic={nav.topic} setTopic={topic => setNav(n => ({ ...n, topic }))} />}
            {nav.tab === "repaso" && <Repaso {...common} />}
          </section>
        )}
      </main>

      {settings && <Ajustes s={s} update={update} replace={replace} server={server} toast={toast} onClose={() => setSettings(false)} />}
      {toasts.length > 0 && <div className="toast" role="status">{toasts[0]}</div>}
    </>
  );
}
