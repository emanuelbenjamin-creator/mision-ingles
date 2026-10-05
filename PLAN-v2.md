# Plan: Misión Inglés v2: Gemini Live, audio con Play/Stop, modelos en paralelo y nuevas misiones

## Contexto

La v1 ya está en `emanuelbenjamin-creator/mision-ingles` (rama `main`; Vercel despliega desde ahí). Es una PWA en React + Vite con funciones serverless de Gemini y 63 pruebas unitarias y 6 de punta a punta en verde. El clon local está en `/home/user/mision-ingles`.

El usuario pide:
1. **Conversación por voz en vivo con Gemini Live.**
2. **Botón de audio** que cambie mientras suena (Play → Stop).
3. **Lanzar varios modelos a la vez**, porque el principal a veces responde «ocupado». Eligió **todos a la vez**: gana la primera respuesta válida.
4. Las mejoras pendientes del plan anterior más mis nuevas propuestas. Eligió: **pronunciación con audio**, **voces naturales (Gemini TTS)**, **listening y lectura**, e **inglés por profesión + lección de tus errores + reporte semanal**. También marcó «Otra», pero sin texto: hay que preguntarle qué tenía en mente.

Después de ver el plan, el usuario agregó: **notificaciones, ligas y simulacro IELTS**, y que **solo se usen modelos gratuitos de Google**.

## 1. Solo modelos gratuitos de Google, todos a la vez (`api/_lib/gemini.js`)

- **Modelos por defecto, todos con capa gratuita en la Gemini API:**
  - Texto: `gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `gemini-2.5-flash` y `gemini-2.5-flash-lite`.
  - Respaldo final: `gemma-3-27b-it`. Es gratis, pero se usa solo si todos los anteriores fallan, porque es más débil. No admite instrucción de sistema ni modo JSON, así que la instrucción va dentro del prompt.
  - TTS: `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview` y `gemini-2.5-flash-preview-tts`.
  - Live: `gemini-3.8-live`, con respaldo `gemini-2.5-flash-native-audio-preview-12-2025`.
  - Se eliminan los modelos de pago de la v1 (`gemini-3.6-flash` y `gemini-3.5-flash`).
- **Validación de nombres:** en la primera llamada de cada instancia se ejecuta `client.models.list()` y se descartan los modelos configurados que no existan. Lo mismo pasa con un modelo que devuelva 404. Así un nombre equivocado no rompe nada.
- **Todos a la vez:** `generate({ system, contents, json, validate })` lanza todos los modelos disponibles en paralelo, cada uno con su `config.abortSignal`.
  - Gana la primera respuesta que pase `validate`. En los endpoints JSON, `validate = parseJson`.
  - Los demás se cancelan.
  - Como son gratuitos, la carrera no cuesta dinero; solo consume la cuota diaria de cada modelo, que es independiente.
- **Si un modelo se queda sin cuota (429):** se marca «enfriando» por 60 s en esa instancia y no se le vuelve a llamar.
- **Si todos fallan:** se prueba Gemma. Si Gemma también falla, se devuelve 502 `ai_error` y la app pasa al modo básico, que ya existe.
- Hay un timeout global de 25 s.
- **Aviso en el README:** para garantizar costo cero, la clave debe ser de un proyecto de AI Studio **sin facturación activada**. En la capa gratuita Google puede usar los datos para mejorar sus productos.
- La misma carrera se aplica a TTS y a la evaluación de audio.

## 2. Audio con Play/Stop y voces naturales

- **`src/lib/audio.js`**: reproductor único.
  - `play(text, { rate, id })` usa **Gemini TTS** (`POST /api/tts`, que devuelve un WAV) si la voz natural está activa y hay IA. Si no, o si falla, usa `speechSynthesis`.
  - Emite su estado a los botones: `loading`, `playing` o `idle`. Solo suena un audio a la vez; uno nuevo detiene el anterior.
  - Cachea el WAV por voz y texto en memoria y en Cache Storage, para no pagar dos veces la misma frase.
  - La velocidad lenta usa `playbackRate`.
- **`src/components/SpeakButton.jsx`**: cambia de ▶ Escuchar a ◼ Detener mientras suena, y muestra «…» mientras carga.
  - Reemplaza todos los `speak()` actuales: tema, versión mejorada, pares mínimos, frases, ejemplos de gramática, chat y tarjetas.
- **`api/tts.js`**:
  - Llama a `generateContent` con `responseModalities: ["AUDIO"]` y `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`.
  - Modelos: `gemini-3.1-flash-tts-preview` y `gemini-2.5-flash-preview-tts`, configurables.
  - Convierte el PCM de 24 kHz a WAV con `pcmToWav` en `api/_lib/audio.js`.
  - Acepta como máximo 600 caracteres por llamada.
- **Ajustes**: «Voz» (Natural de Gemini o del navegador), «Acento» (EE. UU. o Reino Unido, mapeado a voces prediseñadas) y velocidad.

## 3. Gemini Live: conversación por voz en vivo

- **`api/live-token.js`**: crea un **token temporal** con `client.authTokens.create`:
  - `uses: 1`, `expireTime` = ahora + `LIVE_MAX_MINUTES` (por defecto 10) y `newSessionExpireTime` = ahora + 1 min.
  - `liveConnectConstraints`: modelo `GEMINI_LIVE_MODEL` (por defecto `gemini-3.8-live`), `responseModalities: ["AUDIO"]`, instrucción del escenario, nivel y profesión (reutiliza `chatSystem` en versión voz), `inputAudioTranscription`, `outputAudioTranscription` y la voz elegida.
  - Límite propio por IP: `LIVE_SESSIONS_PER_DAY` (por defecto 6), además del código de acceso.
  - **La clave de Gemini nunca sale del servidor.**
- **`src/lib/live.js`**: importa `@google/genai` de forma dinámica, para no engordar el bundle inicial.
  - Conecta con `new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } }).live.connect(...)`.
  - Micrófono: `getUserMedia` + AudioWorklet en línea, que baja a 16 kHz PCM16 (`downsample` y `floatToPcm16`, funciones puras con pruebas) y envía con `sendRealtimeInput({ audio })`.
  - Salida: cola de reproducción de PCM a 24 kHz con `AudioContext`. Si el alumno interrumpe (`interrupted`), se detiene.
  - Transcripciones en vivo del alumno y del coach.
- **Vista**: `Conversar` tendrá dos modos, «Chat» y «Voz en vivo».
  - Botón Iniciar/Colgar, indicador de quién habla y temporizador con corte a los `LIVE_MAX_MINUTES`.
  - Al colgar, **«Revisar mi conversación»** manda la transcripción a `POST /api/chat-review`. Devuelve correcciones, que van al cuaderno, completa la misión de conversación y da XP por minutos hablados.
- Costo de referencia: unos US$0.023 por minuto. Va en el README.

## 4. Pronunciación con audio

- **`src/lib/recorder.js`**: grabación con MediaRecorder (webm/opus o mp4 en Safari), de 8 s como máximo.
- **Componente «Grábate»** en cada frase:
  - Grabar → escucharte → escuchar la versión nativa (comparación lado a lado).
  - Luego **«Evaluar con IA»** llama a `POST /api/pron-assess` con el audio en base64 (límite de 1.5 MB solo en ese endpoint) y la frase objetivo.
  - Gemini escucha el audio y devuelve `{ score, transcript, words: [{ word, ok, issue_es }], sounds_to_practice, tip_es }`.
  - Las palabras se marcan en verde o rojo con la explicación del error.
- Sin IA o sin micrófono, sigue funcionando el modo actual por dictado (`alignWords`).

## 5. Listening y lectura: nueva pestaña «Escuchar y leer»

- **Dictado**:
  - Escuchas una frase (SpeakButton, normal o lenta), la escribes y se califica con `alignWords`, mostrando las palabras que faltaron.
  - Contenido estático por banda en `src/content/dictation.js` (unas 12 frases por banda A, B y C). Si hay IA, además se generan con `POST /api/dictation`.
- **Lectura graduada**:
  - `POST /api/reading` genera una historia corta según nivel y profesión: `{ title, text, glossary[], questions[] }`. Se cachea por día en el dispositivo.
  - Respaldo estático: una historia por banda en `src/content/stories.js`.
  - Al **tocar una palabra** aparece su traducción, tomada del glosario o de `POST /api/word` → `{ es, example }`. Con **«+ Tarjeta»** se agrega al mazo.
  - La historia se puede escuchar completa y termina con 3 preguntas de comprensión.
- Nuevas misiones bonus: **dictado** (+15) y **lectura** (+15).
  - Las 4 principales no cambian: habla, sonido, gramática y repaso. Las bonus quedan en conversación, dictado y lectura.
  - Se actualizan `missionList` y `MISSION_XP` en `src/lib/game.js` y `src/lib/missions.js`.

## 6. Inglés por profesión, lección de tus errores y reporte semanal

- **`src/content/professions.js`**: General, **Contabilidad y tributos**, Ventas, Tecnología, Salud y Turismo. Cada una trae unas 12 tarjetas de vocabulario, 3 temas para hablar y 2 escenarios de conversación. Ejemplo para contabilidad: «Explaining a tax notice to a client» y «Month-end close with the CFO».
- La profesión se elige en el Onboarding (nuevo paso) y en Ajustes. Mezcla sus temas, escenarios y tarjetas con los generales. `migrate()` agrega `profile.profession = "general"`.
- **Lección de tus errores** (en Repaso, a partir de 5 errores guardados):
  - `POST /api/mistakes-lesson` con los últimos 15 errores devuelve `{ summary_es, patterns[], exercises[] }`.
  - Los ejercicios se presentan con el mismo formato de Gramática y se guardan por semana.
- **Reporte semanal** (`src/lib/report.js`, local y sin IA):
  - XP de esta semana contra la anterior, días practicados, minutos hablados, misiones completadas, cambio en las habilidades, top 3 errores y mejor día.
  - Aparece como tarjeta en «Hoy» y en detalle desde ahí.

## 7. Ligas semanales (estilo Duolingo)

- **Almacenamiento compartido gratuito:** Upstash Redis desde el Marketplace de Vercel, con un clic. Inyecta `KV_REST_API_URL` y `KV_REST_API_TOKEN`. Se usa `@upstash/redis` en `api/_lib/store.js`.
  - No hace falta Supabase ni login: cada jugador es anónimo, con apodo e id del dispositivo.
- **Endpoints:**
  - `POST /api/league-join` con `{ nickname }` devuelve `{ playerId, secret }`. El secreto se guarda en el dispositivo y en el servidor solo su hash.
  - `POST /api/league-xp` con `{ playerId, secret, weekXP }` envía el XP semanal. Se rechazan saltos imposibles (más de 400 XP por hora o más de 3000 por semana).
  - `GET /api/league?playerId=` devuelve mi grupo.
- **Divisiones:** Bronce, Plata, Oro, Zafiro y Diamante. Grupos de hasta 30 jugadores por división y semana, con Redis sorted sets.
  - Cada lunes (en la primera petición de la semana o con el cron), los 5 primeros suben y los 5 últimos bajan.
- **Vista:** la tarjeta «Tu liga» en Hoy muestra posición, zona de ascenso o descenso y días restantes. La clasificación completa está en una nueva pestaña **«Liga»**.
  - Se pide un apodo la primera vez y hay un botón para salir de la liga. Sin Redis configurado, la tarjeta dice «Ligas no activadas» y el resto funciona.

## 8. Notificaciones (Web Push)

- **Service worker propio:** `vite-plugin-pwa` pasa a `strategy: "injectManifest"` con `src/sw.js`, que maneja precache, `push` y `notificationclick` (abre la misión pendiente).
- **Claves VAPID** en las variables `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. Se generan con `npx web-push generate-vapid-keys`, que va en el README. El envío usa la librería `web-push`.
- **`POST /api/push-subscribe`:** guarda en Redis la suscripción, la hora preferida, la zona horaria y el último día practicado. Se actualiza al ganar XP.
- **`GET /api/cron-remind`:** protegido con `CRON_SECRET`. Notifica a quien no practicó hoy en su hora local con mensajes como «Tu racha de 5 días está en peligro 🔥» o «Te falta 1 misión».
  - El plan gratuito de Vercel permite un cron al día, a las 19:00 de Perú (`0 0 * * *` UTC).
  - Para respetar la hora elegida por cada persona, el README explica cómo programar un cron horario gratis en cron-job.org que llame al mismo endpoint.
- **Ajustes:** «Recordatorios», con activar/desactivar y la hora.
  - Si el navegador no tiene push (iPhone sin instalar la app), un aviso explica que hay que instalarla primero.
  - Respaldo local: un banner dentro de la app si la racha está en riesgo.

## 9. Simulacro IELTS Speaking

- **Nuevo modo «Simulacro IELTS»** en Hablar, con el formato oficial:
  - **Part 1:** 4 preguntas personales, de unos 30 s cada una.
  - **Part 2:** tarjeta de tema con 1 minuto de preparación (temporizador con notas) y hasta 2 minutos hablando, grabados con MediaRecorder además del dictado.
  - **Part 3:** 3 preguntas de discusión relacionadas con la tarjeta.
- **Banco de preguntas:** estático en `src/content/ielts.js`, con 6 juegos completos. Con IA se pueden generar más con `POST /api/ielts-set`.
- **Evaluación con `POST /api/ielts-evaluate`:**
  - Recibe las transcripciones por parte y el audio de la Part 2.
  - Devuelve las bandas de **Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy y Pronunciation** (esta última a partir del audio), con su justificación en español, errores, frases mejores y próximos pasos.
  - La **banda global** se calcula en el servidor con la regla oficial: promedio redondeado al 0.5 más cercano, donde .25 sube a .5 y .75 sube al entero. Es la función pura `ieltsOverall` y tiene pruebas.
- **Historial:** se guarda en `state.ielts[]`. Hoy muestra la última banda y su tendencia.
  - Es una misión semanal de +40 XP y los errores van al cuaderno.
- **Examinador en vivo:** escenario de Gemini Live que conduce el examen por voz.

## 10. Otros cambios necesarios

- `api/_lib/http.js`: límite de tamaño del cuerpo configurable por endpoint.
- `api/_lib/prompts.js`: prompts y normalizadores nuevos (pron, reading, word, dictation, mistakes-lesson, chat-review, live).
- `.env.example` y README: `GEMINI_MODELS`, `GEMINI_FALLBACK_MODELS`, `GEMINI_TTS_MODELS`, `GEMINI_LIVE_MODELS`, `LIVE_MAX_MINUTES`, `LIVE_SESSIONS_PER_DAY`, VAPID, `CRON_SECRET` y Upstash.
- Nuevas dependencias: `@upstash/redis` y `web-push`.
- **Lo que tiene que conectar el usuario:**
  1. La clave de Gemini, de un proyecto sin facturación.
  2. Upstash Redis desde Vercel → Storage → Marketplace → Upstash → Connect, para ligas y notificaciones.
  3. Las 3 variables VAPID y `CRON_SECRET`.
  4. (Opcional) Un cron horario en cron-job.org.
- **Orden de trabajo, con un commit por bloque:**
  1. modelos gratuitos en carrera + SpeakButton/TTS;
  2. Gemini Live;
  3. pronunciación con audio;
  4. escuchar y leer;
  5. profesiones, lección de errores y reporte;
  6. IELTS;
  7. ligas;
  8. notificaciones.
- `vercel.json`: `maxDuration` de 60 s para `pron-assess` y `reading`.
- La copia vieja en `asistente-ia-tributario-mvp/english-coach/` se deja como está. Hay que preguntarle al usuario si la borra.

## Verificación

- **Vitest**:
  - carrera de modelos: gana el más rápido válido, se ignora el JSON inválido, se cancelan los perdedores y todo falla → 502;
  - `pcmToWav`, `downsample` y `floatToPcm16`;
  - `live-token` con el SDK simulado (restricciones, límite y código de acceso);
  - endpoints nuevos con Gemini simulado;
  - `report.js` (semana actual contra la anterior);
  - misiones nuevas, profesión en `migrate()`, tarjetas de lectura.
- **Playwright** (API simulada):
  - SpeakButton cambia a Detener y vuelve a Escuchar (se simula `speechSynthesis` o el endpoint de TTS);
  - dictado y lectura completan sus misiones bonus;
  - tocar una palabra la agrega al mazo;
  - grabación simulada (MediaRecorder falso) → evaluación con IA → palabras marcadas;
  - la vista «Voz en vivo» muestra su estado sin IA;
  - el reporte semanal aparece;
  - el simulacro IELTS completo muestra las bandas;
  - unirse a la liga y ver la clasificación;
  - activar recordatorios cuando el navegador no tiene push.
- **Vitest adicional:**
  - `ieltsOverall` (casos .25, .75 y bordes);
  - ligas con Redis simulado en memoria: unirse, secreto incorrecto, XP imposible, ascenso y descenso semanal;
  - `cron-remind`: solo notifica a quien no practicó en su día local y exige `CRON_SECRET`;
  - filtrado de modelos inexistentes, enfriamiento por 429 y respaldo a Gemma.
- `npm run build` y `oxlint` en verde. Se mantienen las pruebas de la v1.
- Commit y push a `main` de `emanuelbenjamin-creator/mision-ingles`, con lo que Vercel redespliega.
- **Límite conocido**: la conexión real con Gemini Live y TTS no se puede probar aquí sin clave. Hay que avisar al usuario que lo pruebe en su despliegue.

## Fuentes
- Tokens temporales del Live API: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- Ejemplo oficial con WebSocket y modelo `gemini-3.8-live`: https://github.com/google-gemini/gemini-live-api-examples/blob/main/gemini-live-ephemeral-tokens-websocket/README.md
- Costos del Live API: https://tokenkarma.app/blog/gemini-live-api-pricing-voice-agents-2026/
- Gemini TTS: https://firebase.google.com/docs/ai-logic/generate-speech
- Capa gratuita (Flash y Flash-Lite; Live y TTS gratis): https://www.aifreeapi.com/en/posts/google-gemini-api-free-tier · https://ai.google.dev/gemini-api/docs/pricing
- Gemma gratis en la Gemini API: https://www.sltcreative.com/adding-a-free-overflow-model-to-your-mcp-server-gemma-via-the-gemini-api
