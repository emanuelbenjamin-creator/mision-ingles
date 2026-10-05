import { useId, useRef, useState } from "react";
import { addDays } from "../lib/dates.js";

/* XP por día de los últimos 14 días, con la meta diaria como línea punteada. */
export default function Chart14({ xpByDay, goal, today }) {
  const [tip, setTip] = useState(null);
  const box = useRef(null);
  const gid = "bars" + useId().replace(/:/g, "");
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
  const vals = days.map(d => xpByDay[d] || 0);
  const max = Math.max(goal * 1.25, ...vals, 10);
  const W = 560, H = 170, L = 30, B = 24, T = 10, bw = (W - L) / 14;
  const y = v => T + (H - T - B) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), Math.round(max)];
  const fmt = d => { const [, mm, dd] = d.split("-"); return dd + "/" + mm; };
  const show = (i, el) => {
    const bb = el.getBoundingClientRect(), pb = box.current.getBoundingClientRect();
    setTip({ text: `${fmt(days[i])}: ${vals[i]} XP`, left: bb.left - pb.left + bb.width / 2, top: bb.top - pb.top + 30 });
  };
  return (
    <div className="chart-box" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="XP por día, últimos 14 días">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: "var(--grad-ring-a)" }} /><stop offset="100%" style={{ stopColor: "var(--accent-2)" }} /></linearGradient>
        </defs>
        {ticks.map(tv => (
          <g key={tv}>
            <line x1={L} x2={W} y1={y(tv)} y2={y(tv)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 6} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--f-mono)">{tv}</text>
          </g>
        ))}
        {vals.map((v, i) => {
          const x = L + i * bw + 4, w = bw - 8, top = y(v), base = y(0), isToday = i === 13;
          const r = Math.min(4, base - top);
          return (
            <g key={days[i]}>
              {v > 0 && <path d={`M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`} fill={v >= goal ? `url(#${gid})` : "var(--accent-3)"} opacity={v >= goal ? 1 : 0.55} />}
              {(i % 2 === 1 || isToday) && <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={isToday ? "var(--ink)" : "var(--muted)"} fontFamily="var(--f-mono)" fontWeight={isToday ? 700 : 400}>{isToday ? "hoy" : fmt(days[i])}</text>}
              <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" onMouseEnter={e => show(i, e.currentTarget)} onClick={e => show(i, e.currentTarget)} onMouseLeave={() => setTip(null)} />
            </g>
          );
        })}
        <line x1={L} x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={W} y={y(goal) - 5} textAnchor="end" fontSize="11" fill="var(--ink)">meta {goal} XP</text>
      </svg>
      {tip && <div className="chart-tip" style={{ left: tip.left, top: tip.top }}>{tip.text}</div>}
    </div>
  );
}
