import Icon from "./Icon.jsx";

export const NEW_VERSION = "v3";

/* Lo nuevo de la v3: cada tarjeta lleva directo a la función. `settings: true` abre Ajustes. */
export const NEW_ITEMS = [
  { id: "stories", icon: "book", title: "Historias con decisiones", sub: "Tú decides hablando; cada personaje tiene su voz", go: { tab: "jugar", jugarMode: "historias" } },
  { id: "games", icon: "game", title: "Juegos de voz", sub: "Trabalenguas, contra reloj, adivinanzas y eco veloz", go: { tab: "jugar", jugarMode: "juegos" } },
  { id: "handsfree", icon: "headphones", title: "Manos libres", sub: "Practica solo con la voz, sin tocar la pantalla", go: { tab: "jugar", jugarMode: "manos" } },
  { id: "shadow", icon: "wave", title: "Shadowing", sub: "Tu voz dibujada sobre la del nativo", go: { tab: "hablar", mode: "shadow" } },
  { id: "dialogue", icon: "chat", title: "Diálogos a dos voces", sub: "Dos acentos conversan + 3 preguntas", go: { tab: "leer", leerMode: "dialogo" } },
  { id: "cast", icon: "mic", title: "Personajes con voz propia", sub: "Megan, Dr. Patel, Tom… cada uno con su acento", go: { tab: "envivo" } },
  { id: "cards", icon: "cards", title: "Tarjetas en vivo", sub: "Correcciones y palabras nuevas durante la llamada", go: { tab: "envivo" } },
  { id: "accents", icon: "globe", title: "7 acentos y 6 tonos", sub: "Australia, Irlanda, India… elígelos en Ajustes", settings: true },
];

/** Tarjeta destacada del panel con las funciones nuevas. Las que ya abriste quedan marcadas; se puede ocultar. */
export default function WhatsNew({ s, update, go, onSettings }) {
  if (s.profile.hideNew === NEW_VERSION) return null;
  const seen = s.profile.seenNew || {};
  const left = NEW_ITEMS.filter(x => !seen[x.id]).length;
  const open = item => {
    update(d => { d.profile.seenNew = { ...d.profile.seenNew, [item.id]: true }; });
    if (item.settings) onSettings(); else go(item.go);
  };
  return (
    <section className="whatsnew" data-testid="whats-new" aria-labelledby="wnTitle">
      <div className="wn-head">
        <div>
          <span className="wn-badge">Nuevo</span>
          <h2 id="wnTitle">Lo nuevo en Misión Inglés</h2>
          <p className="small">{left ? `${left} de ${NEW_ITEMS.length} por probar. Toca una para abrirla.` : "Ya probaste todo lo nuevo."}</p>
        </div>
        <button type="button" className="wn-hide" onClick={() => update(d => { d.profile.hideNew = NEW_VERSION; })}>Ocultar</button>
      </div>
      <div className="wn-grid">
        {NEW_ITEMS.map(item => (
          <button type="button" key={item.id} className={"wn-item" + (seen[item.id] ? " seen" : "")} data-testid={"new-" + item.id} onClick={() => open(item)}>
            <span className="wn-ic"><Icon name={seen[item.id] ? "check" : item.icon} /></span>
            <span className="wn-txt"><b>{item.title}</b><small>{item.sub}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}
