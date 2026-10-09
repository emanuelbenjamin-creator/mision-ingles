import { useEffect, useMemo, useState } from "react";
import SpeakButton from "../components/SpeakButton.jsx";
import Dialogos from "./Dialogos.jsx";
import { DICTATION } from "../content/dictation.js";
import { STORIES } from "../content/stories.js";
import { professionOf } from "../content/professions.js";
import { band } from "../lib/level.js";
import { hash } from "../lib/dates.js";
import { alignWords } from "../lib/align.js";
import { api } from "../lib/api.js";
import { addCard, bumpSkill, completeMission, logSession } from "../lib/game.js";

const readCache = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const writeCache = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const validStory = r => !!(r && typeof r.text === "string" && r.text.trim() && Array.isArray(r.glossary) && Array.isArray(r.questions) && r.questions.every(q => q && Array.isArray(q.o)));
const clean = w => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");

export default function Leer(props) {
  const { mode, setMode } = props;
  return (
    <>
      <div className="seg" role="group" aria-label="Modo">
        <button type="button" aria-pressed={mode !== "lectura" && mode !== "dialogo"} onClick={() => setMode("dictado")}>Dictado</button>
        <button type="button" aria-pressed={mode === "lectura"} onClick={() => setMode("lectura")}>Lectura</button>
        <button type="button" aria-pressed={mode === "dialogo"} onClick={() => setMode("dialogo")}>Diálogos</button>
      </div>
      {mode === "lectura" ? <Lectura {...props} /> : mode === "dialogo" ? <Dialogos {...props} /> : <Dictado {...props} />}
    </>
  );
}

/* ---------------- Dictado ---------------- */
function staticSet(s, today) {
  const list = DICTATION[band(s.profile.level)];
  const start = hash(today + "dict") % list.length;
  return [0, 1, 2, 3, 4].map(i => list[(start + i * 3) % list.length]);
}

function Dictado({ s, update, today, ai, toast }) {
  const [set, setSet] = useState(() => staticSet(s, today));
  const [inputs, setInputs] = useState({});
  const [res, setRes] = useState({});
  const [loading, setLoading] = useState(false);
  const done = Object.keys(res).length;

  const check = i => {
    const v = (inputs[i] || "").trim();
    if (!v) { toast("Escribe lo que escuchaste."); return; }
    const r = alignWords(set[i], v);
    const next = { ...res, [i]: r };
    setRes(next);
    if (Object.keys(next).length === set.length && done < set.length) {
      const avg = Math.round(Object.values(next).reduce((a, b) => a + b.score, 0) / set.length);
      update(d => { bumpSkill(d, "comp", avg); logSession(d, "dictation", { pct: avg }, today); return completeMission(d, "dictation", "Dictado", today); });
    }
  };
  const fresh = async () => {
    setLoading(true);
    try {
      const r = await api("dictation", { level: s.profile.level, profession: s.profile.profession });
      if (r.sentences.length >= 3) { setSet(r.sentences); setInputs({}); setRes({}); }
    } catch (e) { toast(e.message); }
    setLoading(false);
  };

  return (
    <div className="grid2">
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div className="card-head" style={{ margin: 0 }}><h2>Dictado</h2><span className="pill neutral">{done} / {set.length}</span></div>
        <p className="muted small">Escucha cada frase (puedes repetirla o ponerla lenta) y escríbela tal cual. Las palabras que faltan o están mal se marcan en rojo.</p>
        {set.map((sent, i) => {
          const r = res[i];
          return (
            <div className="sent" key={sent}>
              <div className="row">
                <b className="mono">{i + 1}.</b>
                <SpeakButton text={sent} label="Escuchar" />
                <SpeakButton text={sent} slow label="Lento" />
                {r && <span className={"pill " + (r.score >= 85 ? "ok" : r.score >= 60 ? "" : "bad")}>{r.score}%</span>}
              </div>
              <div className="composer" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <input type="text" id={"dict" + i} value={inputs[i] || ""} disabled={!!r} autoComplete="off" autoCapitalize="off" spellCheck="false"
                  onChange={e => setInputs({ ...inputs, [i]: e.target.value })} onKeyDown={e => { if (e.key === "Enter") check(i); }} aria-label={`Frase ${i + 1}`} placeholder="Escribe lo que escuchas" />
                <button type="button" className="btn" onClick={() => check(i)} disabled={!!r}>Comprobar</button>
              </div>
              {r && <div className="words" data-testid={"dict-res-" + i}>{r.tokens.map((t, k) => <span key={k} className={t.status === "ok" ? "w-ok" : t.status === "miss" ? "w-miss" : ""}>{t.text}</span>)}</div>}
            </div>
          );
        })}
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => { setSet(staticSet(s, today)); setInputs({}); setRes({}); }}>Repetir</button>
          {ai && <button type="button" className="btn ghost" onClick={fresh} disabled={loading}>{loading ? "Creando…" : "Frases nuevas con IA"}</button>}
        </div>
      </div>
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Por qué funciona</h3>
          <p className="muted small">El dictado entrena el oído para separar palabras que en inglés se pronuncian juntas («want to» → «wanna», «did you» → «didja»). Es el ejercicio que más mejora la comprensión auditiva en poco tiempo.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Lectura ---------------- */
function Lectura({ s, update, today, ai, toast }) {
  const prof = professionOf(s);
  const key = `mi-reading-${today}-${s.profile.level}-${s.profile.profession || "general"}`;
  const fallback = useMemo(() => {
    const st = STORIES[band(s.profile.level)];
    return { title: st.title, text: st.text, glossary: st.glossary, questions: st.questions, offline: true };
  }, [s.profile.level]);
  const [story, setStory] = useState(() => { const c = readCache(key); return validStory(c) ? c : fallback; });
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null); // { word, sentence, es, ipa, example, loading }
  const [answers, setAnswers] = useState({});

  const load = async (force = false) => {
    if (!ai) return;
    if (!force && validStory(readCache(key))) return;
    setLoading(true);
    try {
      const r = await api("reading", { level: s.profile.level, profession: s.profile.profession, seed: force ? String(Date.now()) : today });
      if (!validStory(r)) throw new Error("La lectura llegó incompleta. Inténtalo otra vez.");
      writeCache(key, r);
      setStory(r); setAnswers({}); setSel(null);
    } catch (e) { if (force) toast(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(false); }, [ai, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const gloss = useMemo(() => new Map(story.glossary.map(([w, es]) => [w.toLowerCase(), es])), [story]);
  const paragraphs = story.text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  const tap = async (raw, sentence) => {
    const w = clean(raw);
    if (!w) return;
    const phrase = [...gloss.keys()].find(k => k.includes(" ") && k.split(" ").includes(w) && sentence.toLowerCase().includes(k));
    const known = gloss.get(w) || (phrase && gloss.get(phrase));
    const word = known && phrase && !gloss.get(w) ? phrase : w;
    if (known) { setSel({ word, sentence, es: known }); return; }
    if (!ai) { setSel({ word, sentence, es: "", note: "Sin traducción disponible sin el coach IA." }); return; }
    setSel({ word, sentence, loading: true });
    try { const r = await api("word", { word: w, sentence }); setSel({ word, sentence, ...r }); }
    catch (e) { setSel({ word, sentence, es: "", note: e.message }); }
  };
  const save = () => {
    if (!sel || !sel.es) return;
    update(d => [addCard(d, { front: sel.word, back: sel.es, ex: sel.example || sel.sentence, tag: "lectura" }) ? `«${sel.word}» agregada a tus tarjetas` : `«${sel.word}» ya estaba en tus tarjetas`]);
  };
  const answer = (i, j) => {
    if (answers[i] != null) return;
    const next = { ...answers, [i]: j };
    setAnswers(next);
    if (Object.keys(next).length === story.questions.length) {
      const right = story.questions.filter((q, k) => next[k] === q.a).length;
      const pct = Math.round(right / story.questions.length * 100);
      update(d => { bumpSkill(d, "comp", pct); logSession(d, "reading", { pct }, today); return completeMission(d, "reading", "Lectura", today); });
    }
  };

  return (
    <div className="grid2">
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div className="card-head" style={{ margin: 0 }}>
          <div><span className="eyebrow">Nivel {s.profile.level}{prof.name !== "General" ? " · " + prof.name : ""}{story.offline ? " · lectura base" : ""}</span><h2>{story.title}</h2></div>
          {ai && <button type="button" className="btn ghost sm" onClick={() => load(true)} disabled={loading}>{loading ? "Creando…" : "Otra historia"}</button>}
        </div>
        {loading && <p className="thinking">El coach está escribiendo una historia para tu nivel…</p>}
        <div className="reading" data-testid="reading">
          {paragraphs.map((p, pi) => (
            <div key={pi} className="para">
              <SpeakButton text={p} iconOnly className="btn ghost sm" />
              <p>{p.split(/(\s+)/).map((tok, k) => /\s+/.test(tok) || !/[a-z]/i.test(tok) ? tok
                : <span key={k} role="button" tabIndex={0} className={"tw" + (sel && clean(tok) && sel.word.split(" ").includes(clean(tok)) ? " on" : "") + (gloss.has(clean(tok)) ? " g" : "")}
                  onClick={() => tap(tok, p)} onKeyDown={e => { if (e.key === "Enter") tap(tok, p); }}>{tok}</span>)}</p>
            </div>
          ))}
        </div>
        <p className="small muted">Toca cualquier palabra para ver su traducción. Las subrayadas son las más útiles del texto.</p>
      </div>
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 10 }} data-testid="word-card">
          <h3>Palabra</h3>
          {!sel ? <p className="empty">Toca una palabra del texto.</p> : (
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
        <div className="card">
          <div className="card-head"><h2>Comprensión</h2><span className="pill neutral">{Object.keys(answers).length} / {story.questions.length}</span></div>
          <div className="qs">
            {story.questions.map((q, i) => (
              <div className="q" key={story.title + i}>
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
      </div>
    </div>
  );
}
