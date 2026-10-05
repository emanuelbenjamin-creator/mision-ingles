export default function Ring({ value, goal }) {
  const pct = Math.min(1, goal ? value / goal : 0);
  const C = 2 * Math.PI * 54;
  return (
    <div className="ring" role="img" aria-label={`Meta diaria: ${value} de ${goal} XP`}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={pct >= 1 ? "var(--accent)" : "var(--flame-fill)"} strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="lbl"><b>{value}</b><span className="small muted">de {goal} XP</span></div>
    </div>
  );
}
