import { Fragment, useCallback, useEffect, useState } from "react";
import Icon from "./components/Icon.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import UserMenu from "./components/UserMenu.jsx";
import { HelpModal, UsageModal } from "./components/Modals.jsx";
import { DiagBar, ModelsModal } from "./components/Diag.jsx";
import { setDiag } from "./lib/trace.js";
import Hoy from "./views/Hoy.jsx";
import Hablar from "./views/Hablar.jsx";
import Conversar from "./views/Conversar.jsx";
import Gramatica from "./views/Gramatica.jsx";
import Repaso from "./views/Repaso.jsx";
import Leer from "./views/Leer.jsx";
import Liga from "./views/Liga.jsx";
import EnVivo from "./views/EnVivo.jsx";
import Jugar from "./views/Jugar.jsx";
import { syncLeague, weekXP } from "./lib/league.js";
import { reportPractice } from "./lib/push.js";
import Ajustes from "./views/Ajustes.jsx";
import Onboarding from "./views/Onboarding.jsx";
import { useStore } from "./store.js";
import { dkey } from "./lib/dates.js";
import { CORE_MISSIONS, missionDone, streak } from "./lib/game.js";
import { health, setAccessCode } from "./lib/api.js";
import { configureAudio, setFallbackHandler } from "./lib/audio.js";
import { configureSpeech } from "./lib/speech.js";
import { loadKokoro } from "./lib/kokoro.js";
import { addProfessionCards } from "./lib/state.js";

const TABS = [["hoy", "Hoy", "home"], ["envivo", "En vivo", "mic"], ["hablar", "Hablar", "wave"], ["conversar", "Conversar", "chat"], ["leer", "Escuchar y leer", "headphones"], ["jugar", "Jugar", "game"], ["gramatica", "Gramática", "book"], ["repaso", "Repaso", "cards"], ["liga", "Liga", "trophy"]];
const SEP_BEFORE = "repaso";
const prefersDark = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const TAB_IDS = TABS.map(t => t[0]);
const readTab = () => {
  const h = (typeof location !== "undefined" && location.hash.slice(1)) || "";
  if (TAB_IDS.includes(h)) return h;
  try { return sessionStorage.getItem("mi-tab") || "hoy"; } catch { return "hoy"; }
};

export default function App() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback(msg => setToasts(t => [...t, msg]), []);
  const onMessages = useCallback(msgs => setToasts(t => [...t, ...msgs]), []);
  const [s, update, replace] = useStore(onMessages);
  const [nav, setNav] = useState({ tab: readTab(), mode: "speak", soundId: null, topic: null, scen: null, chatMode: "chat", leerMode: "dictado", jugarMode: "historias" });
  const [server, setServer] = useState({ ai: false, accessCodeRequired: false, checked: false });
  const [settings, setSettings] = useState(false);
  const [modal, setModal] = useState(null); // "usage" | "help" | "models"
  const [installEvt, setInstallEvt] = useState(null);
  const [league, setLeague] = useState(null);
  const today = dkey();

  useEffect(() => { health().then(h => { configureSpeech({ stt: !!h.stt }); setServer({ ...h, checked: true }); }); }, []);
  useEffect(() => { setFallbackHandler(reason => toast("Voz natural no disponible ahora: " + reason + " Suena la voz del navegador.")); }, [toast]);
  useEffect(() => { setAccessCode(s.profile.accessCode); }, [s.profile.accessCode]);
  useEffect(() => { setDiag(!!s.profile.diag); }, [s.profile.diag]);
  useEffect(() => { try { sessionStorage.setItem("mi-tab", nav.tab); } catch { /* sin almacenamiento */ } }, [nav.tab]);
  useEffect(() => {
    if (!toasts.length) return undefined;
    const id = setTimeout(() => setToasts(t => t.slice(1)), 2600);
    return () => clearTimeout(id);
  }, [toasts]);

  const ai = server.ai && (!server.accessCodeRequired || !!s.profile.accessCode);
  const theme = s.profile.theme || "system";
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme; else root.dataset.theme = theme;
    const dark = theme === "dark" || (theme === "system" && prefersDark());
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0D0F22" : "#1E2350");
  }, [theme]);
  const setTheme = t => update(d => { d.profile.theme = t; });
  const isDark = theme === "dark" || (theme === "system" && prefersDark());
  useEffect(() => {
    const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key === ",") { e.preventDefault(); setSettings(true); } };
    const onPrompt = e => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeinstallprompt", onPrompt); };
  }, []);
  const install = () => {
    if (installEvt) { installEvt.prompt(); setInstallEvt(null); return; }
    toast(/iPhone|iPad/.test(navigator.userAgent) ? "En iPhone: botón Compartir → «Agregar a inicio»." : "En el menú del navegador elige «Instalar app» o «Agregar a pantalla de inicio».");
  };
  const { voiceMode, voice, accent, tone, rate, kokoroVoice, kokoroEnabled } = s.profile;
  const geminiVoice = ai && server.gemini !== false;
  useEffect(() => { configureAudio({ mode: voiceMode, voice, accent, tone, rate, ai: geminiVoice, kokoroVoice }); }, [voiceMode, voice, accent, tone, rate, geminiVoice, kokoroVoice]);
  // Si ya descargó Kokoro, se carga desde la caché al abrir la app (sin volver a bajar el modelo).
  useEffect(() => { if (kokoroEnabled) loadKokoro(); }, [kokoroEnabled]);
  const go = target => { setNav(n => ({ ...n, ...target })); window.scrollTo({ top: 0 }); };
  const xp = s.xpByDay[today] || 0;
  const aiLabel = !server.checked ? "Coach IA: conectando…" : ai ? "Coach IA activo" : server.ai ? "Falta código de acceso" : "Modo básico (sin IA)";
  const wxp = weekXP(s, today);
  const leagueCreds = s.league;
  const refreshLeague = useCallback(() => {
    if (!server.leagues || !leagueCreds) return;
    syncLeague(leagueCreds, wxp).then(setLeague).catch(e => { if (e.code === "bad_player") update(d => { delete d.league; return ["Tu liga se reinició: vuelve a unirte."]; }); });
  }, [server.leagues, leagueCreds, wxp, update]);
  useEffect(() => { const id = setTimeout(refreshLeague, 1500); return () => clearTimeout(id); }, [refreshLeague]);
  const remindersOn = !!(s.reminders && s.reminders.enabled);
  const streakNow = streak(s, today);
  const missionsLeft = CORE_MISSIONS.filter(id => !missionDone(s, id, today)).length;
  useEffect(() => {
    if (!remindersOn || !(s.xpByDay[today] > 0)) return undefined;
    const id = setTimeout(() => { reportPractice({ lastDay: today, streak: streakNow, missionsLeft }).catch(() => {}); }, 2000);
    return () => clearTimeout(id);
  }, [remindersOn, today, s.xpByDay, streakNow, missionsLeft]);
  const common = { s, update, today, ai, toast, server };

  const tabLabel = (TABS.find(t => t[0] === nav.tab) || TABS[0])[1];
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-m"><span className="logo-mark" />Misión Inglés</div>
        <h1 className="page-title">{s.profile.onboarded ? tabLabel : "Bienvenido"}</h1>
        <div className="chips">
          <span className="chip flame" title="Racha de días"><Icon name="flame" />{streak(s, today)} días</span>
          <span className="chip" title="XP de hoy" data-testid="xp-chip"><Icon name="bolt" />{xp} / {s.profile.dailyGoal} XP</span>
          <button type="button" className={"chip " + (ai ? "ai-on" : "ai-off")} onClick={() => setSettings(true)} title="Estado del coach IA">{aiLabel}</button>
          <button type="button" className="iconbtn" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} data-testid="theme-toggle"><Icon name={isDark ? "sun" : "moon"} /></button>
        </div>
        <UserMenu s={s} theme={theme} setTheme={setTheme} onSettings={() => setSettings(true)} onUsage={() => setModal("usage")} onHelp={() => setModal("help")} onModels={() => setModal("models")}
          onInstall={install} canInstall={!!installEvt} onBackup={() => setSettings(true)} onLogout={null} />
      </header>
      <aside className="side">
        <div className="logo"><span className="logo-mark" />Misión <b>Inglés</b></div>
        {s.profile.onboarded && (
          <nav className="nav" role="tablist" aria-orientation="vertical" aria-label="Secciones">
            {TABS.map(([id, label, icon]) => (
              <Fragment key={id}>
                {id === SEP_BEFORE && <div className="nav-sep" />}
                <button className="nav-item" role="tab" type="button" aria-selected={nav.tab === id} onClick={() => go({ tab: id })}><Icon name={icon} />{label}</button>
              </Fragment>
            ))}
          </nav>
        )}
        <div className="side-foot">
          <div className="side-streak"><span className="eyebrow">Racha</span><b>🔥 {streak(s, today)} {streak(s, today) === 1 ? "día" : "días"}</b><span className="small muted">{s.totalXP} XP en total</span></div>
        </div>
      </aside>

      <main className="content">
        {!s.profile.onboarded ? (
          <section className="view"><Onboarding s={s} onDone={profile => update(d => { d.profile = { ...d.profile, ...profile }; addProfessionCards(d); return ["¡Listo! Estas son tus misiones de hoy."]; })} /></section>
        ) : (
          <section className="view" key={nav.tab}>
            <ErrorBoundary resetKey={nav.tab}>
            {nav.tab === "hoy" && <Hoy s={s} today={today} go={go} league={league} server={server} update={update} onSettings={() => setSettings(true)} />}
            {nav.tab === "envivo" && <EnVivo {...common} />}
            {nav.tab === "hablar" && <Hablar {...common} mode={nav.mode} setMode={mode => setNav(n => ({ ...n, mode }))} soundId={nav.soundId} setSoundId={soundId => setNav(n => ({ ...n, soundId }))} />}
            {nav.tab === "conversar" && <Conversar key={nav.scen || "hoy"} {...common} scen={nav.scen} setScen={scen => setNav(n => ({ ...n, scen }))} mode={nav.chatMode} setMode={chatMode => setNav(n => ({ ...n, chatMode }))} />}
            {nav.tab === "leer" && <Leer {...common} mode={nav.leerMode} setMode={leerMode => setNav(n => ({ ...n, leerMode }))} />}
            {nav.tab === "jugar" && <Jugar {...common} mode={nav.jugarMode} setMode={jugarMode => setNav(n => ({ ...n, jugarMode }))} />}
            {nav.tab === "gramatica" && <Gramatica {...common} topic={nav.topic} setTopic={topic => setNav(n => ({ ...n, topic }))} />}
            {nav.tab === "repaso" && <Repaso {...common} />}
            {nav.tab === "liga" && <Liga {...common} league={league} setLeague={setLeague} refresh={refreshLeague} />}
            </ErrorBoundary>
          </section>
        )}
      </main>

      {modal === "usage" && <UsageModal s={s} today={today} server={server} onClose={() => setModal(null)} />}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "models" && <ModelsModal server={server} onClose={() => setModal(null)} onToggle={v => update(d => { d.profile.diag = v; })} />}
      <DiagBar onOpen={() => setModal("models")} />
      {settings && <Ajustes s={s} update={update} replace={replace} server={server} toast={toast} ai={ai} onClose={() => setSettings(false)} />}
      {toasts.length > 0 && <div className="toast" role="status">{toasts[0]}</div>}
    </div>
  );
}
