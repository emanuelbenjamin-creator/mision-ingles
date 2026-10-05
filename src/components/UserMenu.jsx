import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { PROFESSIONS } from "../content/professions.js";

const THEMES = [["system", "Según el dispositivo"], ["light", "Claro"], ["dark", "Oscuro"]];
const initials = name => (name || "Estudiante").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

/**
 * Menú de usuario (avatar + nombre). Agrupa ajustes, uso, tema, idioma, ayuda, instalación y cuenta.
 * Cuando existan cuentas de usuario, «Cerrar sesión» se activa con onLogout.
 */
export default function UserMenu({ s, theme, setTheme, onSettings, onUsage, onHelp, onInstall, canInstall, onBackup, onLogout }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(null); // "theme" | "lang" | "about"
  const box = useRef(null);
  const name = s.profile.name || "Estudiante";
  const prof = PROFESSIONS[s.profile.profession] || PROFESSIONS.general;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = e => { if (box.current && !box.current.contains(e.target)) { setOpen(false); setSub(null); } };
    const onKey = e => { if (e.key === "Escape") { setOpen(false); setSub(null); } };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const run = fn => () => { setOpen(false); setSub(null); fn(); };
  const Item = ({ icon, label, kbd, onClick, chevron, disabled, hint, testid }) => (
    <button type="button" role="menuitem" className="um-item" onClick={onClick} disabled={disabled} data-testid={testid} aria-expanded={chevron ? sub === chevron : undefined}>
      <Icon name={icon} /><span className="um-label">{label}{hint && <small>{hint}</small>}</span>
      {kbd && <kbd>{kbd}</kbd>}
      {chevron && <span className={"um-chev" + (sub === chevron ? " open" : "")}><Icon name="chevR" /></span>}
    </button>
  );

  return (
    <div className="um" ref={box}>
      <button type="button" className="um-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(o => !o); setSub(null); }} data-testid="user-menu">
        <span className="um-avatar">{initials(name)}</span>
        <span className="um-who"><b>{name}</b><small>Nivel {s.profile.level}{prof !== PROFESSIONS.general ? " · " + prof.name : ""}</small></span>
        <Icon name="chevD" />
      </button>
      {open && (
        <div className="um-pop" role="menu" aria-label="Menú de usuario">
          <Item icon="gear" label="Ajustes" kbd="Ctrl+," onClick={run(onSettings)} />
          <Item icon="gauge" label="Mi uso" onClick={run(onUsage)} />
          <Item icon={theme === "dark" ? "moon" : "sun"} label="Tema" chevron="theme" onClick={() => setSub(sub === "theme" ? null : "theme")} />
          {sub === "theme" && (
            <div className="um-sub" role="group" aria-label="Tema">
              {THEMES.map(([id, label]) => (
                <button key={id} type="button" role="menuitemradio" aria-checked={theme === id} className="um-subitem" onClick={() => setTheme(id)}>
                  {label}{theme === id && <Icon name="check" />}
                </button>
              ))}
            </div>
          )}
          <Item icon="globe" label="Idioma" chevron="lang" onClick={() => setSub(sub === "lang" ? null : "lang")} />
          {sub === "lang" && (
            <div className="um-sub" role="group" aria-label="Idioma">
              <button type="button" role="menuitemradio" aria-checked="true" className="um-subitem">Español <Icon name="check" /></button>
              <button type="button" role="menuitemradio" aria-checked="false" className="um-subitem" disabled>English <small>próximamente</small></button>
            </div>
          )}
          <Item icon="help" label="Ayuda" onClick={run(onHelp)} />
          <div className="um-sep" />
          <Item icon="download" label="Instalar la app" hint={canInstall ? "" : "en el celular: Compartir → Agregar a inicio"} onClick={run(onInstall)} />
          <Item icon="save" label="Copia de seguridad" onClick={run(onBackup)} />
          <div className="um-sep" />
          <Item icon="logout" label="Cerrar sesión" disabled={!onLogout} hint={onLogout ? "" : "disponible al activar cuentas de usuario"} onClick={onLogout ? run(onLogout) : undefined} testid="logout" />
        </div>
      )}
    </div>
  );
}
