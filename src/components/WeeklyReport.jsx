import { useState } from "react";
import { weeklyReport } from "../lib/report.js";

const fmt = d => { const [, m, dd] = d.split("-"); return `${dd}/${m}`; };
const DAY = d => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString("es-PE", { weekday: "long" }); };

/** Reporte semanal: esta semana o la anterior, con comparación y avance de habilidades. */
export default function WeeklyReport({ s, today }) {
  const [offset, setOffset] = useState(0);
  const r = weeklyReport(s, today, offset);
  const arrow = r.change == null ? "" : r.change >= 0 ? `▲ ${r.change}%` : `▼ ${Math.abs(r.change)}%`;
  return (
    <div className="card" data-testid="weekly-report">
      <div className="card-head">
        <h2>Reporte semanal</h2>
        <div className="seg" role="group" aria-label="Semana">
          <button type="button" aria-pressed={offset === 0} onClick={() => setOffset(0)}>Esta semana</button>
          <button type="button" aria-pressed={offset === -1} onClick={() => setOffset(-1)}>Anterior</button>
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 10 }}>Desde el lunes {fmt(r.weekStart)}</p>
      <div className="tiles">
        <div className="tile"><b>{r.xp}</b><span>XP {arrow && <em className={r.change >= 0 ? "up" : "down"}>{arrow}</em>}</span></div>
        <div className="tile"><b>{r.daysPracticed}/7</b><span>días practicados</span></div>
        <div className="tile"><b>{r.missions}</b><span>misiones</span></div>
        <div className="tile"><b>{r.speakMin}</b><span>min hablando</span></div>
      </div>
      <div className="meters" style={{ marginTop: 12 }}>
        {r.deltas.filter(d => d.now != null).map(d => (
          <div key={d.key} className="row" style={{ justifyContent: "space-between" }}>
            <span>{d.name}</span>
            <span className="mono">{d.now}{d.delta != null && d.delta !== 0 ? <em className={d.delta > 0 ? "up" : "down"}> {d.delta > 0 ? "+" : ""}{d.delta}</em> : ""}</span>
          </div>
        ))}
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        {r.bestDay ? <>Mejor día: <b>{DAY(r.bestDay.day)}</b> con {r.bestDay.xp} XP. </> : "Aún no hay práctica esta semana. "}
        {r.topErrors.length > 0 && <>A trabajar: {r.topErrors.map(([rule, n]) => `${rule} (${n})`).join(", ")}.</>}
      </p>
    </div>
  );
}
