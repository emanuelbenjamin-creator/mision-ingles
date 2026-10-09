# Plan: Misión Inglés v3 — voces al máximo y más interacción

## Contexto

`emanuelbenjamin-creator/mision-ingles` (React 19 + Vite 8, PWA, una función serverless en Vercel) ya tiene 30 voces de Gemini, Kokoro en el dispositivo, Gemini Live y un modo económico por turnos. Pero hoy todo suena con **una sola voz y dos acentos**, la llamada en vivo solo muestra la transcripción, y la revisión llega al colgar.

Pediste: exprimir las voces, hacer la app más interactiva y recibir propuestas de nombre. Elegiste **solo servicios gratuitos** y las ocho mejoras: personajes con voz propia, diálogos a varias voces, más acentos y estilos, tu voz contra la nativa, tarjetas en vivo, historias con decisiones, juegos de voz y manos libres.

## Forma de trabajo

- Clonar el repo en `C:\Users\ruric\Desktop\mision-ingles` y trabajar en la rama `v3-voces`.
- **No se hace push a `main`** (Vercel despliega producción desde ahí). Se abre un pull request; Vercel genera una URL de vista previa para probar con tus claves reales.
- Un commit por bloque, en el orden de abajo. Cada bloque queda usable por sí solo.

## Bloque 1 — Base de voces: acentos, estilos y personajes

Es la base de todo lo demás.

- **`src/content/voices.js`**: agregar `ACCENTS` (EE. UU., Reino Unido, Australia, Irlanda, Escocia, India, Canadá) y `TONES` (amigable, formal, alegre, calmado, susurro, locutor rápido).
- **`api/_routes/tts.js`**: hoy `STYLE` solo tiene `us` y `uk`. Pasa a construirse con acento × tono, siempre desde listas cerradas (nunca texto libre del navegador). Acepta `tone`.
- **`src/lib/audio.js`**:
  - la clave de caché de `naturalBlob` incluye el tono (pasa de `v2` a `v3`);
  - `browserVoice()` y `playBrowser()` mapean los nuevos acentos a `en-AU`, `en-IE`, `en-IN`, `en-CA`;
  - nuevo `playSequence(lines)`: reproduce varias líneas seguidas, cada una con su voz, con el mismo estado compartido (lo usan diálogos e historias);
  - nuevo `audioBlobFor(text, opts)`: expone el blob que ya generan `naturalBlob`/`kokoroBlob` (lo usa el shadowing).
- **`src/lib/kokoro.js`**: `KOKORO_VOICES` pasa de 8 a las 28 voces en inglés del modelo (EE. UU. y Reino Unido). `KokoroPanel.jsx` las agrupa por acento y género. Kokoro no tiene otros acentos: para Australia, India, etc. se usa Gemini.
- **Nuevo `src/content/characters.js`**: elenco con `{ id, name, role, voice, kokoroVoice, accent, tone, bio_es }`. Los 6 escenarios de `src/content/scenarios.js` y los de `professions.js` apuntan a un personaje (Megan, Dr. Patel, Tom, Sam ya existen como texto).
- **`api/_routes/live-token.js`** y `liveSystem` en `api/_lib/prompts.js`: la llamada usa la voz, el acento y el tono del personaje; el alumno puede cambiarlos.
- **`src/views/EnVivo.jsx`**: tarjeta del personaje (nombre, de dónde es, cómo habla) y botón para escucharlo antes de llamar, reutilizando `VoicePicker.jsx`.
- **`src/views/Ajustes.jsx`**: selector de acento ampliado y selector de tono.

## Bloque 2 — Diálogos a varias voces

- **`api/_lib/gemini.js`**: `synthesize` acepta `speakers` y usa `speechConfig.multiSpeakerVoiceConfig` (máximo 2 hablantes). Entra en la misma carrera de modelos TTS (`race`).
- **Nuevo `api/_routes/dialogue.js`**: con `generate` crea `{ title, speakers[2], lines[], questions[3] }` según nivel y profesión; las voces salen de `characters.js`.
- **`api/_routes/tts.js`**: acepta `lines` + `speakers` (límite de 1200 caracteres en ese caso).
- **Respaldo**: si el TTS multi-hablante falla o no hay Gemini, el navegador reproduce línea por línea con `playSequence` y dos voces de Kokoro o del sistema.
- **Nuevo `src/content/dialogues.js`**: 2 diálogos fijos por banda para el modo sin IA.
- **`src/views/Leer.jsx`**: nueva pestaña «Diálogos»: escuchar, ver el guion (oculto al inicio), preguntas de comprensión y tocar una palabra para traducirla (ya existe para lecturas).
- Misión bonus nueva en `src/lib/missions.js` y `MISSION_XP` en `src/lib/game.js`. `vercel.json`: `maxDuration` de 60 s para `dialogue`.

## Bloque 3 — Tu voz contra la nativa (shadowing)

- **Nuevo `src/lib/pitch.js`** (funciones puras, con pruebas): contorno de entonación por autocorrelación, envolvente de volumen y comparación de ritmo entre dos audios.
- **Nueva `src/views/Shadowing.jsx`**, como tercera opción dentro de `Hablar.jsx`:
  1. escuchas la frase con texto tipo karaoke;
  2. grabas con `src/lib/recorder.js` (ya existe);
  3. ves tu onda y tu entonación sobre las del nativo, y escuchas ambas con `toggleClip`;
  4. puntaje por palabra con el endpoint existente `pron-assess` (Azure → Gemini → Whisper).
- **Límite conocido**: Gemini TTS no entrega tiempos por palabra. El karaoke se estima con la duración del audio y las pausas detectadas, así que es aproximado. Con la voz del navegador sí es exacto (`onboundary`).

## Bloque 4 — Tarjetas en vivo durante la llamada

- **`api/_routes/live-token.js`**: agregar al `config` tres funciones para Gemini Live: `show_correction`, `show_word` y `give_challenge`. Quedan fijadas en el token.
- **`src/lib/live.js`**: `onmessage` hoy solo lee `serverContent`. Se agrega el manejo de `toolCall` → nuevo callback `onTool(name, args)` y respuesta con `sendToolResponse`.
- **`src/views/LiveVoice.jsx`**: panel «En esta llamada» junto a la transcripción. Cada tarjeta se puede guardar: correcciones con `addMistake` y palabras al mazo (mismo flujo que `Leer.jsx`).
- **Modo económico**: `api/_routes/voice-turn.js` devuelve además `cards` en su JSON y `src/lib/economy.js` las entrega por el mismo callback.
- **Riesgo**: no pude confirmar sin tu clave que el modelo Live configurado llame funciones mientras habla. Si no lo hace, las tarjetas se generan con una llamada de texto por turno (la misma vía del modo económico).

## Bloque 5 — Historias con decisiones

- **Nuevo `api/_routes/story-turn.js`**: recibe la historia y lo que dijiste; devuelve `{ narration, lines[{ character, text }], choices[3], ending? }`.
- **Nuevo `src/content/adventures.js`**: 4 premisas (misterio en Londres, primer día de trabajo, perdido en el aeropuerto, presentar tu startup) y una historia completa ramificada para el modo sin IA.
- **Nueva `src/views/Historia.jsx`**: el narrador y cada personaje suenan con su voz (`playSequence` + `characters.js`). Decides **hablando** (`MicButton.jsx`, `src/lib/speech.js` o Whisper); tu frase se compara con las opciones usando `alignWords` de `src/lib/align.js`, o se envía libre al modelo. Al final: resumen, errores al cuaderno y XP.

## Bloque 6 — Juegos de voz rápidos

- **Nuevo `src/content/games.js`** y **nueva `src/views/Juegos.jsx`** con 4 minijuegos de 2 minutos:
  - **Trabalenguas**: puntaje por precisión (`alignWords`) y velocidad.
  - **Contra reloj**: respondes una pregunta en 15 s; cuenta palabras y variedad.
  - **Adivina la palabra**: una voz la describe y tú la dices.
  - **Eco veloz**: repites la frase cada vez más rápido (`playbackRate` ya existe en `audio.js`).
- Funcionan sin IA (reconocimiento del navegador o Whisper). Récords en el estado y XP con tope diario.

## Bloque 7 — Manos libres

- **Nuevo `src/lib/handsfree.js`**: bucle hablar → escuchar → reaccionar, con `speakAndWait` (ya existe en `audio.js`) y el reconocimiento por turnos de `economy.js`. `parseCommand()` puro y con pruebas: `repeat`, `slower`, `faster`, `next`, `translate`, `stop`.
- **Nueva `src/views/ManosLibres.jsx`**: lista de reproducción con repaso de tarjetas (`src/lib/srs.js`), repetir frases y dictado oral. Pantalla grande, Wake Lock para que no se apague y Media Session para los botones de los audífonos.
- **Límite conocido**: en iPhone el micrófono se corta si la app pasa a segundo plano; hay que dejarla abierta.

## Bloque 8 — Navegación, estado y documentación

- **`src/App.jsx`**: nueva sección «Jugar» (Historias, Juegos, Manos libres). Shadowing va en Hablar y Diálogos en Escuchar y leer.
- **`src/lib/state.js`**: `migrate()` agrega `profile.accent`/`tone` ampliados, récords de juegos e historial de historias, sin romper el progreso guardado.
- **`README.md`**, **`.env.example`** y `src/styles.css` actualizados.

## Nombres propuestos para la app

No se cambia nada del nombre en este plan; eliges y lo aplico al final. No verifiqué marcas registradas ni dominios: antes de decidir hay que buscarlos.

| Nombre | Idea |
|---|---|
| **Suelta** (recomendado) | «Suéltate a hablar»: ataca el miedo a hablar, que es el problema real. Corto y en español. |
| **Loro** | Repetir y hablar; da una mascota inmediata. Riesgo: suena a repetir sin entender. |
| **Dímelo** | Cercano, centrado en decirlo en voz alta. |
| **Fluye** | Promete fluidez; funciona como verbo («hoy fluye 10 minutos»). |
| **Háblalo** | Imperativo claro: el inglés se aprende hablándolo. |
| **Vozz** | Marca corta centrada en la voz; fácil de hacer logo. |
| **Charla Coach** | Describe exactamente qué es; menos memorable. |
| **Eco English** | Por el shadowing (repetir como eco); mezcla idiomas. |

Cambiar el nombre toca: `index.html` (título y descripción), el manifiesto en `vite.config.js`, `package.json`, `README.md`, los textos de `Onboarding.jsx` y los iconos en `public/`. El dominio de Vercel y el nombre del repositorio los cambias tú.

## Verificación

- **Vitest** (se mantienen las 146 actuales): `pitch.js`, `parseCommand`, listas cerradas de acento y tono en `tts`, `dialogue` y `story-turn` con `_setGenerator`, manejo de `toolCall` en `live.js`, `migrate()` y personajes por escenario.
- **Playwright** (API simulada y micrófono falso, como las 22 actuales): elegir acento y oír la vista previa, diálogo con preguntas, shadowing con grabación simulada, tarjeta en vivo que se guarda en el mazo, historia completa hasta el final, un juego con puntaje y manos libres con el comando «next».
- `npm run lint` y `npm run build` en verde.
- **Prueba real en la vista previa de Vercel** (necesita tus claves, no se puede simular): TTS multi-hablante, acentos nuevos y funciones de Gemini Live. Reviso `/api/health` y el panel «Modelos (diagnóstico)» para ver qué modelo respondió.
