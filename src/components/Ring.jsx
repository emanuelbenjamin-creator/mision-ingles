import { useId } from "react";

/* Anillo de la meta diaria con degradado morado → cian. */
export default function Ring({ value, goal }) {
  const pct = Math.min(1, goal ? value / goal : 0);
  const C = 2 * Math.PI * 54;
  const gid = "ring" + useId().replace(/:/g, "");
  return (
    <div className="ring" role="img" aria-label={`Meta diaria: ${value} de ${goal} XP`}>
      <svg viewBox="0 0 120 120">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--grad-ring-a)" }} />
            <stop offset="100%" style={{ stopColor: "var(--grad-ring-b)" }} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={`url(#${gid})`} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="lbl"><b>{value}</b><span className="small muted">de {goal} XP</span></div>
    </div>
  );
}
