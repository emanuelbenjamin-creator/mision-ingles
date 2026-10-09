import Icon from "../components/Icon.jsx";
import Ring from "../components/Ring.jsx";
import Meter from "../components/Meter.jsx";
import Chart14 from "../components/Chart14.jsx";
import WeeklyReport from "../components/WeeklyReport.jsx";
import WhatsNew from "../components/WhatsNew.jsx";
import { LEVELS, GOALS } from "../content/meta.js";
import { addDays } from "../lib/dates.js";
import { streak, missionDone, MISSION_XP, BADGES } from "../lib/game.js";
import { missionList } from "../lib/missions.js";
import { learnedCount } from "../lib/srs.js";
import { levelIdx, levelProgress } from "../lib/level.js";

const SKILLS = [["pron", "Pronunciación"], ["flu", "Fluidez"], ["gram", "Gramática"], ["vocab", "Vocabulario"], ["comp", "Comprensión"]];

export default function Hoy({ s, today, go, league, server = {}, update, onSettings }) {
  const xp = s.xpByDay[today] || 0, goal = s.profile.dailyGoal;
  const st = streak(s, today);
  const weekXP = [...Array(7)].reduce((a, _, i) => a + (s.xpByDay[addDays(today, -i)] || 0), 0);
  const speakCount = s.sessions.filter(x => x.type === "speak" || x.type === "chat").length;
  const ms = missionList(s, today);
  const doneN = ms.filter(m => !m.bonus && missionDone(s, m.id, today)).length;
  const lp = levelProgress(s), li = levelIdx(s.profile.level);
  const ruleCount = {};
  s.mistakes.forEach(m => { ruleCount[m.rule] = (ruleCount[m.rule] || 0) + 1; });
  const topRules = Object.entries(ruleCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const noSkills = Object.values(s.skills).every(v => v == null);
  const date = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  const atRisk = st > 0 && !(xp > 0) && new Date().getHours() >= 18;

  return (
    <>
      {atRisk && <div className="risk" role="status"><b>🔥 Tu racha de {st} {st === 1 ? "día" : "días"} está en peligro.</b> Completa una misión antes de medianoche.</div>}
      <div className="card hero">
        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          <span className="eyebrow">{date} · {GOALS[s.profile.goal]}</span>
          <h1>Hola{s.profile.name ? ", " + s.profile.name : ""}. {doneN >= 4 ? "Misiones del día completas." : `Te faltan ${4 - doneN} misiones hoy.`}</h1>
          <p className="muted">
            {st ? <>Llevas <b style={{ color: "var(--flame)" }}>{st} {st === 1 ? "día" : "días"}</b> de racha. Cumple tu meta de {goal} XP para mantenerla.</> : "Completa una misión para encender tu racha."}
          </p>
          <div className="tiles" style={{ marginTop: 6 }}>
            <div className="tile"><b>{st}</b><span>días de racha</span></div>
            <div className="tile"><b>{weekXP}</b><span>XP últimos 7 días</span></div>
            <div className="tile"><b>{learnedCount(s)}</b><span>palabras aprendidas</span></div>
            <div className="tile"><b>{speakCount}</b><span>sesiones habladas</span></div>
          </div>
        </div>
        <Ring value={xp} goal={goal} />
      </div>

      {update && <WhatsNew s={s} update={update} go={go} onSettings={onSettings} />}

      <div className="grid2">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Misiones de hoy</h2><span className={"pill " + (doneN >= 4 ? "ok" : "neutral")}>{doneN} / 4</span></div>
            <div className="missions">
              {ms.map(m => {
                const done = missionDone(s, m.id, today);
                return (
                  <div className={"mission" + (done ? " done" : "")} key={m.id} data-testid={"mission-" + m.id}>
                    <div className="ic"><Icon name={done ? "check" : m.icon} /></div>
                    <div style={{ minWidth: 0 }}><div className="t">{m.title}</div><div className="s">{m.sub}</div></div>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      {done ? <span className="pill ok">+{MISSION_XP[m.id]} XP</span> : <><span className="pill">+{MISSION_XP[m.id]}</span><button className="btn sm" type="button" onClick={() => go(m.go)}>Empezar</button></>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2>Actividad</h2><span className="small muted">XP por día · últimos 14 días</span></div>
            <Chart14 xpByDay={s.xpByDay} goal={goal} today={today} />
            <p className="small muted" style={{ marginTop: 8 }}>Morado: meta cumplida · celeste: practicaste sin llegar a la meta.</p>
          </div>
          <WeeklyReport s={s} today={today} />
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Tu ruta</h2><span className="small muted">Marco Común Europeo (MCER)</span></div>
            <div className="path">{LEVELS.map((l, i) => <div key={l} className={"step" + (i < li ? " past" : i === li ? " now" : "")}>{l}</div>)}</div>
            <div style={{ marginTop: 14 }}><Meter label={"Avance en " + s.profile.level} value={lp} /></div>
            <p className="small muted" style={{ marginTop: 8 }}>Combina la gramática dominada del nivel, tus puntajes de habla y el vocabulario aprendido.</p>
            {s.ielts.length > 0 ? (
              <button type="button" className="ielts-chip" onClick={() => go({ tab: "hablar", mode: "ielts" })}>
                Último simulacro IELTS: <b className="mono">{Number(s.ielts.at(-1).overall).toFixed(1)}</b>
                {s.ielts.length > 1 && <em className={s.ielts.at(-1).overall >= s.ielts.at(-2).overall ? "up" : "down"}> {s.ielts.at(-1).overall >= s.ielts.at(-2).overall ? "▲" : "▼"} {Math.abs(s.ielts.at(-1).overall - s.ielts.at(-2).overall).toFixed(1)}</em>}
              </button>
            ) : <button type="button" className="ielts-chip" onClick={() => go({ tab: "hablar", mode: "ielts" })}>Haz un simulacro IELTS Speaking (+40 XP)</button>}
          </div>
          <div className="card">
            <div className="card-head"><h2>Accesos rápidos</h2></div>
            <div className="quick">
              {[
                ["live-cta", "mic", "Habla en vivo con Gemini", "Llamada con voz natural", { tab: "envivo" }],
                ["q-ielts", "trophy", "Simulacro IELTS", "Banda estimada en 12 min", { tab: "hablar", mode: "ielts" }],
                ["q-read", "headphones", "Escuchar y leer", "Dictado y lectura de hoy", { tab: "leer" }],
                ["q-review", "cards", "Repaso y lección de errores", "Tus tarjetas pendientes", { tab: "repaso" }],
              ].map(([tid, icon, t, sub, target]) => (
                <button type="button" key={tid} className="quick-item" data-testid={tid} onClick={() => go(target)}>
                  <span className="quick-ic"><Icon name={icon} /></span>
                  <span className="quick-txt"><b>{t}</b><small>{sub}</small></span>
                  <Icon name="chevR" />
                </button>
              ))}
            </div>
          </div>
          {server.leagues && (
            <button type="button" className="league-chip" onClick={() => go({ tab: "liga" })} data-testid="league-chip">
              {league ? <><span><b>Liga {league.division}</b><span className="small muted"> · puesto {league.myRank} de {league.rows.length}</span></span><span className={"pill " + (league.rows[league.myRank - 1]?.zone === "up" ? "ok" : league.rows[league.myRank - 1]?.zone === "down" ? "bad" : "neutral")}>{league.rows[league.myRank - 1]?.zone === "up" ? "Zona de ascenso" : league.rows[league.myRank - 1]?.zone === "down" ? "Zona de descenso" : "Sigue sumando"}</span></>
                : <><b>Únete a la liga semanal</b><span className="pill">Competir</span></>}
            </button>
          )}
          <div className="card">
            <div className="card-head"><h2>Habilidades</h2><span className="small muted">0–100</span></div>
            <div className="meters">{SKILLS.map(([k, l]) => <Meter key={k} label={l} value={s.skills[k]} />)}</div>
            {noSkills && <p className="empty">Tus puntajes aparecen después de tu primera sesión de habla o pronunciación.</p>}
          </div>
          <div className="card">
            <div className="card-head"><h2>Errores frecuentes</h2><button className="btn ghost sm" type="button" onClick={() => go({ tab: "repaso" })}>Ver cuaderno</button></div>
            {topRules.length
              ? <div className="meters">{topRules.map(([r, n]) => <div key={r} className="row" style={{ justifyContent: "space-between" }}><span>{r}</span><span className="pill bad">{n}×</span></div>)}</div>
              : <p className="empty">Cuando el coach corrija algo, lo verás aquí y se convertirá en tarjeta de repaso.</p>}
          </div>
          <div className="card">
            <div className="card-head"><h2>Logros</h2><span className="small muted">{s.gems} gemas · {s.totalXP} XP en total</span></div>
            <div className="badges">{BADGES.map(([id, n]) => <span key={id} className={"badge" + (s.badges[id] ? " on" : "")}>{n}</span>)}</div>
          </div>
        </div>
      </div>
    </>
  );
}
