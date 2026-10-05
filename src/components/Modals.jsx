import { useEffect } from "react";
import Meter from "./Meter.jsx";
import { getUsage } from "../lib/api.js";
import { weekStart } from "../lib/report.js";
import { addDays } from "../lib/dates.js";

function Sheet({ title, onClose, children, testid }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} data-testid={testid}>
        <div className="row" style={{ justifyContent: "space-between" }}><h2>{title}</h2><button type="button" className="btn ghost sm" onClick={onClose}>Cerrar</button></div>
        {children}
      </div>
    </div>
  );
}

const pct = (n, max) => (max ? Math.min(100, Math.round(n / max * 100)) : 0);

/** «Mi uso»: consultas al coach de hoy frente al límite gratis, y tu práctica de la semana. */
export function UsageModal({ s, today, server, onClose }) {
  const u = getUsage();
  const L = server.limits || { ai: 80, tts: 400, live: 6, liveMinutes: 10 };
  const ws = weekStart(today);
  let weekXP = 0, days = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (d <= today) { weekXP += s.xpByDay[d] || 0; if (s.xpByDay[d] > 0) days++; } }
  const live = (s.liveSessions || []).filter(h => h.d >= ws).reduce((a, h) => a + h.secs, 0);
  return (
    <Sheet title="Mi uso" onClose={onClose} testid="usage">
      <p className="small muted">Uso de hoy en este dispositivo. Los límites son diarios y protegen la capa gratuita de Gemini.</p>
      <div className="usage-row"><Meter label={`Consultas al coach · ${u.ai} de ${L.ai}`} value={pct(u.ai, L.ai)} /></div>
      <div className="usage-row"><Meter label={`Audios con voz natural · ${u.tts} de ${L.tts}`} value={pct(u.tts, L.tts)} /></div>
      <div className="usage-row"><Meter label={`Llamadas en vivo · ${u.live} de ${L.live} (máx. ${L.liveMinutes} min cada una)`} value={pct(u.live, L.live)} /></div>
      <h3>Esta semana</h3>
      <div className="tiles" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="tile"><b>{weekXP}</b><span>XP</span></div>
        <div className="tile"><b>{days}/7</b><span>días</span></div>
        <div className="tile"><b>{Math.round(live / 60)}</b><span>min en vivo</span></div>
      </div>
    </Sheet>
  );
}

const FAQ = [
  ["La voz suena robótica", "Es la voz del navegador: aparece cuando la voz natural de Gemini no responde (por ejemplo, si se acabó la cuota gratuita del día). En Ajustes verás el motivo; mañana vuelve la voz natural."],
  ["No me escucha el micrófono", "Acepta el permiso de micrófono del navegador. En el celular también puedes usar el micrófono del teclado para dictar."],
  ["¿Puedo responder en español?", "Sí. En las llamadas en vivo y en el chat, si no sabes algo dilo en español: el coach te dice cómo se dice en inglés, te pide repetirlo y sigue en inglés."],
  ["¿Dónde se guarda mi progreso?", "En este dispositivo. Desde el menú de usuario → Copia de seguridad puedes descargarlo y restaurarlo en otro."],
  ["Instalar en el celular", "Android: menú del navegador → Instalar app. iPhone: Compartir → Agregar a inicio. Así también recibes recordatorios."],
];

export function HelpModal({ onClose }) {
  return (
    <Sheet title="Ayuda" onClose={onClose} testid="help">
      <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="small muted">{a}</p></details>)}</div>
    </Sheet>
  );
}
