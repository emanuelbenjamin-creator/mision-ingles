# Plan: «Misión Inglés», app para aprender inglés (estilo Stimuler + Duolingo)

## Contexto

Se pide un programa completo para aprender inglés con lo mejor de las apps del mercado: panel de avances, misiones diarias, práctica hablada, corrección y explicaciones de gramática, inspirado en Stimuler y Duolingo.

Decisiones del usuario:
- **IA: Gemini.**
- **Pronunciación: reconocimiento de voz gratuito.**
- **Plataforma: web instalable (PWA).**
- **Ubicación: repositorio propio** `emanuelbenjamin-creator/mision-ingles`.
- **Supabase no es obligatorio** (pregunta del usuario): en la v1 no se usa.

Respuestas a las preguntas del usuario:
- **¿Google Sites?** No conviene para la app. Sites solo permite incrustar HTML dentro de un iframe aislado: no hay servidor donde esconder la clave de Gemini, el iframe no recibe permiso de micrófono y el guardado local es poco fiable. Sí se puede **enlazar** la app desde un sitio de Google Sites, con un botón o una página que apunte a la URL de Vercel.
- **¿Siempre se necesita Supabase?** No. Supabase solo hace falta para tener login y sincronizar el progreso entre varios dispositivos o usuarios. En la v1 el progreso se guarda en el dispositivo, con un botón de **exportar/importar copia de seguridad (JSON)**. Supabase queda como mejora opcional de la Fase 2.
- **Lo que sí es imprescindible:** un pequeño servidor que llame a Gemini, para que la clave no quede expuesta en el navegador. Se resuelve con funciones serverless de Vercel dentro de la misma carpeta, sin otro servicio.

**Ya existe un prototipo funcional**, sin commit: `english-coach/mision-ingles.html`. Incluye panel, 5 misiones diarias, habla de 60 s con evaluación, pronunciación por imitación, conversación con IA, 10 temas de gramática con «Explica mi respuesta», repaso espaciado y cuaderno de errores. Es la especificación viva: su contenido y sus prompts se reutilizan tal cual.

## Investigación: qué tomar de cada app

| App | Lo que copiamos |
|---|---|
| **Stimuler** | Hablar 60 s → informe en ~20 s con fluidez, gramática, vocabulario, muletillas y ritmo. Ruta diaria, simulacro IELTS con banda estimada |
| **Duolingo** | Racha, XP, meta diaria, misiones, gemas y logros. Max: «Explain My Answer», Roleplay con personajes y Video Call |
| **ELSA Speak** | Foco en los sonidos difíciles según la lengua materna, puntaje por palabra |
| **Speak / Praktika** | Juegos de roles en escenarios reales; explica *por qué* algo suena mal |
| **Busuu / Babbel** | Ruta MCER A1 → C1 y gramática explicada |
| **Anki / FSRS** | Repaso espaciado: unos 3 min diarios triplican la retención de vocabulario |

Diferencial propio: **pensada para hispanohablantes** (errores típicos, falsos amigos, sonidos difíciles). **Cada error corregido se convierte en tarjeta de repaso.**

## Arquitectura v1 (solo 2 servicios: Gemini + Vercel, ambos gratis)

```
english-coach/
  index.html, vite.config.js (vite-plugin-pwa), package.json, vercel.json, .env.example, README.md
  public/            íconos y manifest de la PWA
  api/               funciones serverless de Vercel (Node): la clave de Gemini vive aquí
    _gemini.js       cliente @google/genai, salida JSON con responseSchema, límite por IP, código de acceso opcional
    speak-evaluate.js, chat-turn.js, chat-suggest.js, grammar-explain.js, grammar-ask.js
  src/
    content/         topics.js, sounds.js, scenarios.js, grammar.js, deck.js (datos del prototipo)
    lib/             srs.js, rules.js (errores de hispanohablantes), align.js, missions.js, xp.js,
                     speech.js (Web Speech + speechSynthesis), storage.js (localStorage + export/import), api.js
    views/           Hoy, Hablar, Pronunciacion, Conversar, Gramatica, Repaso, Ajustes (incluye prueba de nivel)
    components/      Ring, Chart14, Meter, MissionItem, Flashcard, ChatBubble, Toast
  tests/             Vitest (lib) y Playwright (punta a punta)
```

- React 19 + Vite + Tailwind 4, las mismas versiones que `frontend/package.json`. Los tokens de diseño se copian del prototipo.
- La IA se llama solo desde `api/`. Los prompts salen de `evaluateSpeak`, `chatRules`, `chatHelp`, `explainQ` y `askTeacher` del prototipo, adaptados a Gemini (modelo flash, `responseMimeType: "application/json"`).
- Control de costo: límite por IP (p. ej. 80 llamadas al día) y variable opcional `APP_ACCESS_CODE` para que solo use la app quien tenga el código.
- Sin conexión o sin IA, el **modo básico** sigue funcionando: reglas locales, SRS, pronunciación y gramática estática.
- Voz: Web Speech API para hablar (Chrome, Edge, Android, Safari) con el dictado del teclado como respaldo, y `speechSynthesis` para escuchar. No se necesita ninguna API paga de voz.

## Lo que tiene que conectar el usuario (una sola vez)

1. **Clave de Gemini nueva** en https://aistudio.google.com. La actual está escrita en `backend/main_assistant.py`: hay que rotarla.
2. **Vercel** (gratis): entrar con GitHub → «Add New Project» → importar `asistente-ia-tributario-mvp` → *Root Directory* = `english-coach` → variables `GEMINI_API_KEY` y, opcionalmente, `APP_ACCESS_CODE` → Deploy. Cada push redespliega solo.
3. (Opcional) En Google Sites, un botón que enlace a la URL de Vercel.

APIs opcionales a futuro: Supabase (login y sincronización entre dispositivos), Gemini Live API (conversación por voz en tiempo real, con la misma clave) y voces neuronales con Google Cloud TTS.

## Pasos de ejecución

1. Publicar ya el prototipo como artifact de claude.ai, para tener un enlace de prueba mientras se construye la versión Vercel (en esa demo la IA es Claude).
2. Generar `english-coach/` con Vite, React, Tailwind y la PWA. Migrar el prototipo a `content/`, `lib/`, `views/` y `components/`. Mover el HTML del prototipo a `english-coach/prototype/`.
3. Crear `api/` con Gemini, `vercel.json`, `.env.example` y un `README.md` con los pasos de despliegue.
4. Añadir las pruebas (ver Verificación), hacer commit y push a `claude/tender-fermi-cvue2z`.

## Hoja de ruta posterior

| Fase | Entregable |
|---|---|
| 2 | Supabase opcional (login y sincronización), grabación con MediaRecorder y transcripción con Gemini cuando no hay Web Speech, FSRS, notificaciones push |
| 3 | Ligas y misiones con amigos (requiere Supabase), simulacro IELTS con banda, conversación por voz con Gemini Live |

## Verificación

- Vitest: `srs.js` (intervalos), `rules.js` (cada regla con un caso positivo y uno negativo), `align.js`, `missions.js` (estables por fecha), `xp.js` (racha entre días) y `storage.js` (exportar/importar).
- Funciones `api/*` con Gemini simulado: JSON válido e inválido, código de acceso, límite por IP.
- `npm run build` y `oxlint` en verde.
- Playwright (Chromium preinstalado) contra `vite preview` con la API simulada: completar las 5 misiones y comprobar que XP, racha, gráfico y cuaderno de errores se actualizan y persisten al recargar.

## Fuentes

- Stimuler: https://apps.apple.com/app/id1627501632 · https://stimuler.tech/blog/duolingo-vs-stimuler-which-app-is-right-for-your-english-goals
- Duolingo: https://www.strivecloud.io/blog/blog-gamification-examples-boost-user-retention-duolingo · https://blog.duolingo.com/duolingo-max
- Apps de habla con IA: https://getfluently.app/blog/best-ai-apps-to-learn-english · https://www.talkdrill.com/blog/compare/best-ai-english-speaking-apps-2026/
- Busuu y Babbel: https://learnenglish.life/compare/busuu-vs-duolingo-vs-babbel/
- Repaso espaciado: https://migaku.com/blog/language-fun/spaced-repetition-in-2026-how-it-actually-works
