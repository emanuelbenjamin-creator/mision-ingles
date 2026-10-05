import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { daysLeft, joinLeague, leaveLeague, weekXP } from "../lib/league.js";

const DIV_CLASS = ["bronce", "plata", "oro", "zafiro", "diamante"];

export default function Liga({ s, update, today, toast, server, league, setLeague, refresh }) {
  const [nick, setNick] = useState(s.profile.name || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!server.leagues) {
    return (
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h2>Ligas no activadas</h2>
        <p className="muted">Las ligas necesitan una base de datos compartida gratuita. Quien administra la app debe conectar <b>Upstash Redis</b> en Vercel (Storage → Marketplace → Upstash) y volver a desplegar.</p>
      </div>
    );
  }
  const join = async () => {
    setBusy(true);
    try {
      const r = await joinLeague(nick, weekXP(s, today));
      update(d => { d.league = { playerId: r.playerId, secret: r.secret }; return ["¡Te uniste a la liga!"]; });
      setLeague(r);
    } catch (e) { toast(e.message); }
    setBusy(false);
  };
  if (!s.league) {
    return (
      <div className="card onb" style={{ display: "grid", gap: 12 }}>
        <span className="eyebrow">Ligas semanales</span>
        <h1>Compite con otros estudiantes</h1>
        <p className="muted">Cada semana entras a un grupo de hasta 30 personas de tu división. Los 5 primeros suben de división y los 5 últimos bajan. Tu XP de la semana es tu puntaje. Solo se muestra tu apodo.</p>
        <div className="field"><label htmlFor="lgNick">Tu apodo en la liga</label><input type="text" id="lgNick" value={nick} maxLength={20} onChange={e => setNick(e.target.value)} placeholder="Ej.: Ana_Lima" /></div>
        <div className="row"><button type="button" className="btn" onClick={join} disabled={busy || nick.trim().length < 2}>{busy ? "Uniéndote…" : "Unirme a la liga"}</button></div>
      </div>
    );
  }
  const leave = async () => {
    if (!confirm) { setConfirm(true); return; }
    try { await leaveLeague(s.league); } catch { /* si ya no existe, igual se sale */ }
    update(d => { delete d.league; return ["Saliste de la liga"]; });
    setLeague(null); setConfirm(false);
  };
  if (!league) return <div className="card"><p className="thinking">Cargando tu liga…</p><button type="button" className="btn ghost sm" onClick={refresh}>Reintentar</button></div>;

  return (
    <div className="grid2">
      <div className="card" style={{ display: "grid", gap: 14 }} data-testid="league">
        <div className="card-head" style={{ margin: 0 }}>
          <div><span className="eyebrow">Liga semanal · quedan {daysLeft(today)} {daysLeft(today) === 1 ? "día" : "días"}</span><h2><span className={"div-badge " + DIV_CLASS[league.divIndex]}><Icon name="trophy" /> {league.division}</span></h2></div>
          <span className="pill neutral">Puesto {league.myRank} de {league.rows.length}</span>
        </div>
        {league.last === "up" && <p className="hint">¡Subiste de división la semana pasada! 🎉</p>}
        {league.last === "down" && <p className="hint">Bajaste de división la semana pasada. Esta semana puedes recuperarla.</p>}
        <ol className="board">
          {league.rows.map(r => (
            <li key={r.rank} className={(r.me ? "me " : "") + r.zone}>
              <span className="mono rk">{r.rank}</span><span className="nk">{r.nick}{r.me ? " (tú)" : ""}</span><span className="mono xp">{r.xp} XP</span>
            </li>
          ))}
        </ol>
        <p className="small muted"><span className="zone-dot up" /> Zona de ascenso · <span className="zone-dot down" /> Zona de descenso (con 10 o más jugadores)</p>
      </div>
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Cómo sumar puntos</h3>
          <p className="muted small">Todo el XP que ganas cuenta: misiones, conversación en vivo, simulacros IELTS y lecciones. Se actualiza solo al ganar XP. La liga se reinicia cada lunes.</p>
          <button type="button" className="btn ghost sm" onClick={refresh}>Actualizar</button>
        </div>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <p className="small muted">Juegas como <b>{league.nick}</b>.</p>
          <button type="button" className="btn ghost sm" style={{ color: "var(--bad)" }} onClick={leave}>{confirm ? "Pulsa otra vez para salir de la liga" : "Salir de la liga"}</button>
        </div>
      </div>
    </div>
  );
}
