import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Icon from "../components/Icon.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import { DIALOGUES } from "../content/dialogues.js";
import { characterById } from "../content/characters.js";
import { accentLabel } from "../content/voices.js";
import { professionOf } from "../content/professions.js";
import { band } from "../lib/level.js";
import { hash } from "../lib/dates.js";
import { api } from "../lib/api.js";
import { getAudioState, getSeqState, playAudio, subscribeAudio, subscribeProgress, subscribeSeq, toggleDialogue } from "../lib/audio.js";
import { addCard, bumpSkill, completeMission, logSession } from "../lib/game.js";

const ID = "dlg";
const readCache = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const writeCache = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const valid = r => !!(r && Array.isArray(r.lines) && r.lines.length >= 4 && r.lines.every(l => Array.isArray(l) && typeof l[1] === "string")
  && Array.isArray(r.speakers) && r.speakers.length === 2 && Array.isArray(r.questions) && r.questions.every(q => q && Array.isArray(q.o)));
const clean = w => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");

/** Qué línea suena cuando el diálogo es un solo audio: se reparte el avance según el largo de cada línea. */
export function lineAt(lines, p) {
  const total = lines.reduce((n, l) => n + l[1].length, 0) || 1;
  let acc = 0;
  for (let i = 0; i < lines.length; i++) { acc += lines[i][1].length; if (p * total < acc) return i; }
  return lines.length - 1;
}

/** Diálogos a dos voces: escuchar primero, ver el guion después y responder 3 preguntas. */
export default function Dialogos({ s, update, today, ai, toast }) {
  const prof = professionOf(s);
  const b = band(s.profile.level);
  const key = `mi-dialogue-${today}-${s.profile.level}-${s.profile.profession || "general"}`;
  const [pick, setPick] = useState(() => hash(today + "dlg") % DIALOGUES[b].length);
  const fallback = useMemo(() => ({ ...DIALOGUES[b][pick % DIALOGUES[b].length], offline: true }), [b, pick]);
  const [gen, setGen] = useState(() => { const c = readCache(key); return valid(c) ? c : null; });
  const dlg = gen || fallback;
  const cast = useMemo(() => dlg.speakers.map((id, i) => characterById(id) || characterById(i ? "alex" : "megan")), [dlg]);
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState(false);
  const [answers, setAnswers] = useState({});
  const [sel, setSel] = useState(null);

  const st = useSyncExternalStore(subscribeAudio, getAudioState);
  const sq = useSyncExternalStore(subscribeSeq, getSeqState);
  const whole = st.id === ID && st.status !== "idle";
  const active = whole || sq.id === ID;
  const fetching = whole && st.status === "loading";
  const [blobLine, setBlobLine] = useState(-1);
  useEffect(() => {
    if (!whole || fetching) { setBlobLine(-1); return undefined; }
    return subscribeProgress(p => setBlobLine(lineAt(dlg.lines, p)));
  }, [whole, fetching, dlg]);
  const cur = sq.id === ID ? sq.index : blobLine;

  const reset = () => { setAnswers({}); setSel(null); setScript(false); };
  const another = async () => {
    if (!ai) { setPick(p => p + 1); setGen(null); reset(); return; }
    setLoading(true);
    try {
      const r = await api("dialogue", { level: s.profile.level, profession: s.profile.profession, seed: String(Date.now()) });
      if (!valid(r)) throw new Error("El diálogo llegó incompleto. Inténtalo otra vez.");
      writeCache(key, r);
      setGen(r); reset();
    } catch (e) { toast(e.message); }
    setLoading(false);
  };

  const tap = async (raw, sentence) => {
    const word = clean(raw);
    if (!word) return;
    if (!ai) { setSel({ word, sentence, es: "", note: "Sin traducción disponible sin el coach IA." }); return; }
    setSel({ word, sentence, loading: true });
    try { const r = await api("word", { word, sentence }); setSel({ word, sentence, ...r }); }
    catch (e) { setSel({ word, sentence, es: "", note: e.message }); }
  };
  const save = () => {
    if (!sel || !sel.es) return;
    update(d => [addCard(d, { front: sel.word, back: sel.es, ex: sel.example || sel.sentence, tag: "diálogo" }) ? `«${sel.word}» agregada a tus tarjetas` : `«${sel.word}» ya estaba en tus tarjetas`]);
  };
  const answer = (i, j) => {
    if (answers[i] != null) return;
    const next = { ...answers, [i]: j };
    setAnswers(next);
    if (Object.keys(next).length === dlg.questions.length) {
      const right = dlg.questions.filter((q, k) => next[k] === q.a).length;
      const pct = Math.round(right / dlg.questions.length * 100);
      update(d => { bumpSkill(d, "comp", pct); logSession(d, "dialogue", { pct }, today); return completeMission(d, "dialogue", "Diálogo", today); });
    }
  };
  const sayLine = (i, text) => {
    const c = cast[dlg.lines[i][0]];
    playAudio(text, { id: `${ID}-line-${i}`, voice: c.voice, accent: c.accent, tone: c.tone, kokoroFallback: c.kokoroVoice, pitch: c.g === "m" ? 0.8 : 1.15 });
  };

  return (
    <div className="grid2">
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div className="card-head" style={{ margin: 0 }}>
          <div><span className="eyebrow">Nivel {s.profile.level}{prof.name !== "General" && !dlg.offline ? " · " + prof.name : ""}{dlg.offline ? " · diálogo base" : ""}</span><h2>{dlg.title}</h2></div>
          <button type="button" className="btn ghost sm" onClick={another} disabled={loading}>{loading ? "Creando…" : "Otro diálogo"}</button>
        </div>
        {dlg.setting_es && <p className="muted small">{dlg.setting_es}</p>}
        <div className="cast" data-testid="dialogue-cast">
          {cast.map((c, i) => (
            <div key={i} className={"cast-item s" + i}><span className="who-avatar" aria-hidden="true">{c.name.replace(/^(Dr|Mr|Mrs|Ms)\.\s*/, "")[0]}</span><span><b>{c.name}</b><span className="small muted"> · {accentLabel(c.accent)}</span></span></div>
          ))}
        </div>
        <div className="row">
          <button type="button" className={"btn audio-btn" + (active ? (fetching ? " loading" : " playing") : "")} data-testid="dialogue-play" aria-pressed={active}
            onClick={() => toggleDialogue(dlg, cast, { id: ID })}>
            <Icon name={active ? (fetching ? "dots" : "stop") : "play"} />{active ? (fetching ? "Cargando…" : "Detener") : "Escuchar la conversación"}
          </button>
          <button type="button" className="btn ghost" onClick={() => setScript(v => !v)} aria-pressed={script}>{script ? "Ocultar guion" : "Ver guion"}</button>
        </div>
        {loading && <p className="thinking">El coach está escribiendo una conversación para tu nivel…</p>}
        <div className={"dialogue" + (script ? "" : " hidden-script")} data-testid="dialogue">
          {dlg.lines.map(([sp, text], i) => (
            <div key={dlg.title + i} className={"dl s" + sp + (cur === i ? " on" : "")}>
              <span className="who">{cast[sp].name}</span>
              <div className="bub">
                {script ? text.split(/(\s+)/).map((tok, k) => /\s+/.test(tok) || !/[a-z]/i.test(tok) ? tok
                  : <span key={k} role="button" tabIndex={0} className={"tw" + (sel && sel.word === clean(tok) ? " on" : "")} onClick={() => tap(tok, text)} onKeyDown={e => { if (e.key === "Enter") tap(tok, text); }}>{tok}</span>)
                  : <span aria-label="Línea oculta">{text.replace(/[^\s]/g, "•")}</span>}
              </div>
              {script && <button type="button" className="audio-btn vp-play" aria-label={`Escuchar la línea ${i + 1}`} onClick={() => sayLine(i, text)}><Icon name="play" /></button>}
            </div>
          ))}
        </div>
        <p className="small muted">{script ? "Toca una palabra para traducirla, o ▶ para repetir una línea con la voz de ese personaje." : "Primero escucha sin leer. Cuando quieras, abre el guion para comprobar lo que entendiste."}</p>
      </div>
      <div className="stack">
        <div className="card">
          <div className="card-head"><h2>Comprensión</h2><span className="pill neutral">{Object.keys(answers).length} / {dlg.questions.length}</span></div>
          <div className="qs">
            {dlg.questions.map((q, i) => (
              <div className="q" key={dlg.title + i}>
                <div className="stem">{i + 1}. {q.q}</div>
                <div className="opts">
                  {q.o.map((o, j) => (
                    <button key={o} type="button" disabled={answers[i] != null} onClick={() => answer(i, j)}
                      className={"opt" + (answers[i] != null ? (j === q.a ? " right" : j === answers[i] ? " wrong" : "") : "")}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        {script && (
          <div className="card" style={{ display: "grid", gap: 10 }} data-testid="dialogue-word">
            <h3>Palabra</h3>
            {!sel ? <p className="empty">Toca una palabra del guion.</p> : (
              <>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span style={{ fontSize: "1.4rem", fontWeight: 700 }}>{sel.word}</span>
                  <SpeakButton text={sel.word} iconOnly />
                </div>
                {sel.loading ? <p className="thinking">Traduciendo…</p> : <>
                  {sel.ipa && <span className="mono muted">{sel.ipa}</span>}
                  {sel.es ? <p><b>{sel.es}</b></p> : <p className="muted small">{sel.note}</p>}
                  {sel.example && <p className="small muted"><i>{sel.example}</i></p>}
                  {sel.es && <button type="button" className="btn sm" onClick={save}>+ Agregar a mis tarjetas</button>}
                </>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
