import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Icon from "../components/Icon.jsx";
import SayBox from "../components/SayBox.jsx";
import { ADVENTURES, MAX_SCENES } from "../content/adventures.js";
import { characterById } from "../content/characters.js";
import { accentLabel } from "../content/voices.js";
import { api } from "../lib/api.js";
import { getSeqState, stopAudio, subscribeSeq, toggleSequence } from "../lib/audio.js";
import { matchChoice, sceneLines, sceneText, treeScene } from "../lib/story.js";
import { addMistake, addPlayXP, logSession } from "../lib/game.js";

const SEQ = "story";

/** Historias con decisiones: el narrador y los personajes hablan con su voz y tú decides hablando. */
export default function Historia({ s, update, today, ai, toast }) {
  const [adv, setAdv] = useState(null);
  const [scenes, setScenes] = useState([]); // [{ narration, lines, choices, said?, correction?, ending?, ending_es? }]
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const sq = useSyncExternalStore(subscribeSeq, getSeqState);
  const narrator = useMemo(() => characterById("narrator"), []);
  const cast = useMemo(() => (adv ? adv.cast.map(characterById) : []), [adv]);
  const cur = scenes[scenes.length - 1];
  const playing = sq.id === SEQ;

  useEffect(() => () => stopAudio(), []);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [scenes]);

  const play = (scene, c = cast) => toggleSequence(sceneLines(scene, c, narrator), { id: SEQ });
  const begin = a => {
    const offline = !ai;
    const first = offline ? treeScene(a, "start") : { ...a.open, ending: false };
    const c = a.cast.map(characterById);
    setAdv(a); setScenes([first]);
    stopAudio();
    setTimeout(() => play(first, c), 50);
  };
  const finish = (all, spoken) => update(d => {
    all.forEach(sc => { if (sc.correction && sc.said) addMistake(d, { wrong: sc.said, right: sc.correction.corrected, why: sc.correction.explanation_es, rule: "Historia", src: "historia" }, today); });
    logSession(d, "story", { id: adv.id, turns: spoken }, today);
    d.stories = [...(d.stories || []), { d: today, id: adv.id, turns: spoken }].slice(-20);
    return addPlayXP(d, 8 + spoken * 2, today, "Historia: " + adv.title_es);
  });

  const say = async text => {
    if (!cur || cur.ending || busy) return;
    stopAudio();
    const spoken = scenes.length;
    if (!ai) {
      const i = matchChoice(cur.choices, text);
      if (i < 0) { toast("No coincide con ninguna opción. Di una de las tres frases (o tócala)."); return; }
      const next = treeScene(adv, cur.next[i]);
      const all = [...scenes.slice(0, -1), { ...cur, said: cur.choices[i] }, next];
      setScenes(all);
      if (next.ending) finish(all, spoken);
      play(next);
      return;
    }
    setBusy(true);
    try {
      // El historial incluye la escena actual (la última), a la que responde `say`.
      const history = scenes.map(sc => ({ scene: sceneText(sc, cast), say: sc.said || "" }));
      const next = await api("story-turn", { story: adv.id, level: s.profile.level, say: text, history });
      const all = [...scenes.slice(0, -1), { ...cur, said: text, correction: next.correction }, next];
      setScenes(all);
      if (next.ending) finish(all, spoken);
      play(next);
    } catch (e) { toast(e.message); }
    setBusy(false);
  };

  if (!adv) {
    return (
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow">Historias con decisiones</span>
          <h2>Tú decides qué pasa, hablando</h2>
          <p className="muted">Cada personaje tiene su propia voz y acento. Escucha la escena, di lo que harías y la historia cambia según tus palabras. Son {MAX_SCENES} escenas, unos 5 minutos.</p>
        </div>
        <div className="adv-grid" data-testid="adventures">
          {ADVENTURES.map(a => {
            const locked = !ai && !a.tree;
            return (
              <button type="button" key={a.id} className="card adv" disabled={locked} onClick={() => begin(a)}>
                <span className="eyebrow">{a.title}</span>
                <b>{a.title_es}</b>
                <span className="small muted">{a.premise_es}</span>
                <span className="small">{a.cast.map(id => { const c = characterById(id); return `${c.name} (${accentLabel(c.accent)})`; }).join(" · ")}</span>
                {locked && <span className="pill neutral">Necesita el coach IA</span>}
              </button>
            );
          })}
        </div>
        {!ai && <p className="hint">Sin el coach IA puedes jugar «Perdido en el aeropuerto» eligiendo entre las frases de cada escena. Con IA la historia responde a cualquier cosa que digas.</p>}
      </div>
    );
  }

  return (
    <div className="grid2">
      <div className="card" style={{ display: "grid", gap: 14 }} data-testid="story">
        <div className="card-head" style={{ margin: 0 }}>
          <div><span className="eyebrow">Escena {Math.min(scenes.length, MAX_SCENES)}{ai ? ` de ${MAX_SCENES}` : ""}</span><h2>{adv.title_es}</h2></div>
          <button type="button" className="btn ghost sm" onClick={() => { stopAudio(); setAdv(null); setScenes([]); }}>Salir</button>
        </div>
        <div className="story-log" ref={box} aria-live="polite">
          {scenes.map((sc, i) => (
            <div key={i} className="scene">
              <p className="narr">{sc.narration}</p>
              {sc.lines.map(([who, text], k) => (
                <div key={k} className={"dl s" + who}><span className="who">{cast[who].name}</span><div className="bub">{text}</div></div>
              ))}
              {sc.said && <div className="msg me"><span className="who">Tú</span><div className="bub">{sc.said}</div></div>}
              {sc.correction && <div className="fix"><span className="now">{sc.correction.corrected}</span><div className="why">{sc.correction.explanation_es}</div></div>}
            </div>
          ))}
          {busy && <p className="thinking">La historia continúa…</p>}
        </div>
        {cur && !cur.ending && (
          <>
            <div className="row">
              <button type="button" className={"btn ghost audio-btn" + (playing ? " playing" : "")} onClick={() => play(cur)}><Icon name={playing ? "stop" : "play"} /> {playing ? "Detener" : "Escuchar la escena"}</button>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{ai ? "Di una de estas frases, o lo que tú quieras" : "Di una de estas frases"}</div>
              <div className="choice" data-testid="story-choices">
                {cur.choices.map((c, i) => <button type="button" key={c} disabled={busy} onClick={() => say(c)}>{i + 1}. {c}</button>)}
              </div>
            </div>
            <SayBox id="story" onSay={say} disabled={busy} onStart={stopAudio} label="Decirlo" />
          </>
        )}
        {cur && cur.ending && (
          <div className="hint" data-testid="story-end">
            <b>Fin.</b> {cur.ending_es}
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn sm" onClick={() => begin(adv)}>Jugar otra vez</button>
              <button type="button" className="btn ghost sm" onClick={() => { stopAudio(); setAdv(null); setScenes([]); }}>Elegir otra historia</button>
            </div>
          </div>
        )}
      </div>
      <div className="stack">
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <h3>Voces de esta historia</h3>
          {[narrator, ...cast].map((c, i) => (
            <div key={i} className="cast-item"><span className="who-avatar" aria-hidden="true">{c.name.replace(/^(Dr|Mr|Mrs|Ms)\.\s*/, "")[0]}</span><span><b>{c.name}</b><span className="small muted"> · {accentLabel(c.accent)}</span><div className="small muted">{c.bio_es}</div></span></div>
          ))}
        </div>
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <h3>Consejo</h3>
          <p className="small muted">No leas: escucha primero y responde en voz alta. Si no sabes cómo decir algo, dilo en español y verás la versión en inglés como corrección.</p>
          <p className="small muted">Tus errores de la historia se guardan en tu cuaderno al terminar.</p>
        </div>
      </div>
    </div>
  );
}
