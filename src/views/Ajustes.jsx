import { useEffect, useRef, useState } from "react";
import { GOALS, LEVELS } from "../content/meta.js";
import { exportState, importState } from "../lib/storage.js";
import { addProfessionCards, defaultState } from "../lib/state.js";
import { PROFESSIONS } from "../content/professions.js";
import { disableReminders, enableReminders, isIOS, pushSupported } from "../lib/push.js";
import { streak } from "../lib/game.js";
import { dkey } from "../lib/dates.js";

export default function Ajustes({ s, update, replace, server, onClose, toast }) {
  const [p, setP] = useState({ ...s.profile });
  const [confirmReset, setConfirmReset] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef(null);
  const set = patch => setP(x => ({ ...x, ...patch }));
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => { update(d => { const changed = d.profile.profession !== p.profession; d.profile = { ...d.profile, ...p, name: p.name.trim().slice(0, 40), accessCode: p.accessCode.trim() }; const n = changed ? addProfessionCards(d) : 0; return [n ? `Ajustes guardados · ${n} tarjetas de tu profesión agregadas` : "Ajustes guardados"]; }); onClose(); };
  const download = () => {
    const blob = new Blob([exportState(s)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mision-ingles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const upload = async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try { replace(importState(await f.text())); toast("Copia de seguridad restaurada"); onClose(); }
    catch (x) { setErr(x.message); }
  };
  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    const fresh = defaultState();
    fresh.profile = { ...s.profile };
    replace(fresh); toast("Progreso borrado"); onClose();
  };

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="stTitle">
        <h2 id="stTitle">Ajustes</h2>
        <div className="field"><label htmlFor="stName">Tu nombre</label><input type="text" id="stName" value={p.name} onChange={e => set({ name: e.target.value })} placeholder="Opcional" /></div>
        <div className="field"><label htmlFor="stLevel">Nivel actual</label><select id="stLevel" value={p.level} onChange={e => set({ level: e.target.value })}>{LEVELS.slice(0, 5).map(l => <option key={l}>{l}</option>)}</select></div>
        <div className="field"><label htmlFor="stGoal">Objetivo</label><select id="stGoal" value={p.goal} onChange={e => set({ goal: e.target.value })}>{Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="stProf">Profesión</label><select id="stProf" value={p.profession || "general"} onChange={e => set({ profession: e.target.value })}>{Object.entries(PROFESSIONS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></div>
        <div className="field"><label htmlFor="stDaily">Meta diaria</label><select id="stDaily" value={p.dailyGoal} onChange={e => set({ dailyGoal: +e.target.value })}>{[[30, "30 XP · 10 min (relajado)"], [50, "50 XP · 15 min (regular)"], [80, "80 XP · 25 min (serio)"], [120, "120 XP · 40 min (intenso)"]].map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
        <div className="field"><label htmlFor="stVoice">Voz para escuchar</label><select id="stVoice" value={p.voiceMode === "browser" ? "browser" : p.voice} onChange={e => set(e.target.value === "browser" ? { voiceMode: "browser" } : { voiceMode: "natural", voice: e.target.value })}>
          <option value="Kore">Natural de Gemini · femenina</option><option value="Puck">Natural de Gemini · masculina</option><option value="Aoede">Natural de Gemini · femenina 2</option><option value="Charon">Natural de Gemini · masculina 2</option><option value="browser">Voz del navegador (sin internet)</option>
        </select></div>
        <div className="field"><label htmlFor="stAccent">Acento</label><select id="stAccent" value={p.accent} onChange={e => set({ accent: e.target.value })}><option value="us">Estadounidense</option><option value="uk">Británico</option></select></div>
        <div className="field"><label htmlFor="stRate">Velocidad de la voz</label><select id="stRate" value={p.rate} onChange={e => set({ rate: +e.target.value })}>{[[0.75, "Lenta"], [0.9, "Normal"], [1, "Nativa"]].map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
        {(server.accessCodeRequired || p.accessCode) && (
          <div className="field"><label htmlFor="stCode">Código de acceso al coach IA</label><input type="text" id="stCode" value={p.accessCode} onChange={e => set({ accessCode: e.target.value })} placeholder="Te lo da quien administra la app" autoComplete="off" /></div>
        )}
        <Reminders s={s} update={update} server={server} />
        <div className="hint">
          Tu progreso se guarda en este dispositivo. Para pasarlo a otro, descarga una copia y restáurala allá.
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost sm" type="button" onClick={download}>Descargar copia</button>
            <button className="btn ghost sm" type="button" onClick={() => file.current && file.current.click()}>Restaurar copia</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={upload} />
          </div>
          {err && <p className="err" style={{ marginTop: 6 }}>{err}</p>}
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <button className="btn ghost sm" type="button" style={{ color: "var(--bad)" }} onClick={reset}>{confirmReset ? "Pulsa otra vez para borrar todo" : "Borrar progreso"}</button>
            <button className="btn ghost sm" type="button" onClick={() => { update(d => { d.profile.onboarded = false; }); onClose(); }}>Repetir prueba de nivel</button>
          </div>
          <div className="row"><button className="btn ghost" type="button" onClick={onClose}>Cancelar</button><button className="btn" type="button" onClick={save}>Guardar</button></div>
        </div>
      </div>
    </div>
  );
}

function Reminders({ s, update, server }) {
  const r = s.reminders || { enabled: false, hour: 19 };
  const [hour, setHour] = useState(r.hour ?? 19);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!server.push) return <div className="field"><label>Recordatorios</label><p className="small muted">No están activados en este servidor (faltan las claves VAPID o Upstash Redis).</p></div>;
  const on = async () => {
    setBusy(true); setErr("");
    try {
      const today = dkey();
      await enableReminders(server.vapidPublicKey, { hour, streak: streak(s, today), lastDay: s.xpByDay[today] > 0 ? today : "", missionsLeft: 4 });
      update(d => { d.reminders = { enabled: true, hour }; return ["Recordatorios activados"]; });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const off = async () => {
    setBusy(true);
    try { await disableReminders(); } catch { /* nada */ }
    update(d => { d.reminders = { enabled: false, hour }; return ["Recordatorios desactivados"]; });
    setBusy(false);
  };
  return (
    <div className="field" data-testid="reminders">
      <label htmlFor="stHour">Recordatorios</label>
      <div className="row">
        <select id="stHour" value={hour} onChange={e => setHour(+e.target.value)} style={{ width: "auto" }} disabled={r.enabled}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
        </select>
        {r.enabled ? <button type="button" className="btn ghost sm" onClick={off} disabled={busy}>Desactivar</button>
          : <button type="button" className="btn sm" onClick={on} disabled={busy}>{busy ? "Activando…" : "Activar"}</button>}
      </div>
      <p className="small muted">{r.enabled ? `Activos: te avisamos a las ${String(r.hour).padStart(2, "0")}:00 si ese día no practicaste.` : "Te avisamos si ese día aún no practicaste y tu racha está en riesgo."}</p>
      {!pushSupported() && <p className="small muted">{isIOS() ? "En iPhone: instala primero la app (Compartir → «Agregar a inicio») y actívalos desde ahí." : "Este navegador no admite notificaciones."}</p>}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
