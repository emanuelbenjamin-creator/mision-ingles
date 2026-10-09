# Misión Inglés

Coach de inglés para hispanohablantes, instalable en el celular (PWA). Reúne lo mejor de Stimuler, Duolingo, ELSA, Speak y Anki, **usando solo capas gratuitas**: Gemini de Google como base, más Groq, Cerebras, Mistral, OpenRouter, Azure Speech y la voz Kokoro que corre en tu propio equipo.

| Sección | Qué hace |
|---|---|
| **En vivo** | Panel dedicado a **Gemini Live**: conversación libre (con tema), profesor de speaking que corrige al momento, juegos de roles o examinador IELTS; ritmo natural o lento; **cada escenario tiene su personaje** con voz, acento y tono propios (o eliges entre las **30 voces**); **tarjetas en vivo** con correcciones, palabras nuevas y retos mientras hablan, que guardas con un toque; visualizador de voz, transcripción, revisión al colgar e historial de llamadas. **Modo económico** si Gemini Live está ocupado: hablan por turnos con reconocimiento del navegador o Whisper, modelos gratuitos y tu voz elegida |
| **Diseño** | Menú lateral, tarjetas suaves y acentos morado → azul → cian; **tema claro, oscuro o según el dispositivo** (botón ☾/☀ y menú de usuario) |
| **Menú de usuario** | Ajustes (Ctrl+,), Mi uso (consultas de hoy vs. límite gratis), Tema, Idioma, Ayuda, Instalar la app, Copia de seguridad y Cerrar sesión (se activa cuando haya cuentas de usuario) |
| **Hoy** | Meta diaria de XP, racha, gráfico de 14 días, ruta MCER, habilidades, **reporte semanal**, liga, último IELTS, errores frecuentes y logros |
| **Misiones diarias** | 4 principales (habla 60 s, sonido del día, gramática, repaso) + bonus (conversación, dictado, lectura) |
| **Hablar** | Habla 60 s con evaluación (fluidez, gramática, vocabulario, coherencia), **pronunciación grabando tu voz** (Gemini escucha y marca cada palabra), **shadowing** (tu voz dibujada sobre la del nativo: fuerza, entonación, ritmo y velocidad, con texto tipo karaoke) y **simulacro IELTS Speaking** con las 4 bandas oficiales |
| **Conversar** | Chat con corrección en cada mensaje **o voz en vivo con Gemini Live** (llamada real, transcripción y revisión al colgar), incluido un examinador IELTS |
| **Escuchar y leer** | Dictado con frases de tu nivel, lecturas graduadas y **diálogos a dos voces** (dos personajes con acentos distintos, guion oculto al inicio y 3 preguntas): tocas una palabra para traducirla y agregarla a tus tarjetas |
| **Jugar** | **Historias con decisiones** (un narrador y dos personajes hablan con su voz y tú decides hablando), **4 juegos de voz** (trabalenguas, contra reloj, adivina la palabra, eco veloz) y **manos libres** (toda la práctica por voz, con comandos como «repeat», «slower», «next», «translate» y «stop»). Hasta 40 XP por día |
| **Gramática** | 10 temas con ejercicios, «Explica mi respuesta» y «Pregúntale al profe» |
| **Repaso** | Repetición espaciada, cuaderno de errores y **lección semanal creada con tus errores** |
| **Liga** | Ligas semanales Bronce → Diamante: los 5 primeros suben y los 5 últimos bajan |
| **Profesión** | Vocabulario, temas y conversaciones de Contabilidad y tributos, Ventas, Tecnología, Salud o Turismo |
| **Voces** | Gemini (nube, 30 voces, **7 acentos** — EE. UU., Reino Unido, Australia, Irlanda, Escocia, India y Canadá — y **6 tonos**: amigable, formal, alegre, calmado, susurro y locutor), **Kokoro** (82M, **28 voces** de EE. UU. y Reino Unido; se descarga una vez ~90 MB y funciona sin internet ni límites) o la del navegador. Si Gemini falla, se usa Kokoro antes que la del navegador |
| **Modelos (diagnóstico)** | Menú de usuario → *Modelos (diagnóstico)*. Al activarlo, cada respuesta y cada audio muestran qué modelo respondió y en cuánto tiempo. Una barra flotante muestra los últimos eventos. El panel resume, por modelo, cuántas veces ganó, llegó tarde o falló y por qué (sin cuota, no existe, tiempo agotado, respuesta inválida), con el tiempo medio y en qué secciones gana. Exporta CSV o JSON |
| **Recordatorios** | Notificación si tu racha está en riesgo |

Todos los botones de audio cambian a **Detener** y se ponen **verdes con una barra de avance** mientras suenan (barra animada mientras carga la voz natural). En Ajustes eliges entre las 30 voces de Gemini y ves si estás escuchando la voz natural o la del navegador, y por qué. Las voces son las naturales de Gemini, con la voz del navegador como respaldo. Sin IA, la app sigue funcionando en **modo básico** (20 reglas de errores típicos, dictado, repaso, gramática).

## Cómo está hecha

- **Frontend**: React 19 + Vite 8 + PWA (service worker propio en `src/sw.js` para trabajar sin conexión y recibir notificaciones). El progreso se guarda en el dispositivo y se puede respaldar en Ajustes.
- **API**: una sola función serverless (`api/[route].js`) que despacha a `api/_routes/*`. El plan gratis de Vercel admite máximo 12 funciones.
- **IA, solo gratuita**: Gemini 3 Flash, 3.1 Flash-Lite, 2.5 Flash y 2.5 Flash-Lite **se lanzan a la vez y gana la primera respuesta válida**. Los modelos que no existen para tu clave se descartan solos. Si uno se queda sin cuota, descansa 1 minuto. Si todos fallan, se usa Gemma.
- **Más proveedores gratuitos** (opcionales): con `GROQ_API_KEY` y `CEREBRAS_API_KEY` sus modelos corren en la misma carrera que Gemini; Mistral y OpenRouter quedan de respaldo junto a Gemma. Con solo Groq o Cerebras (sin Gemini) la app funciona, pero sin voz en la nube ni Gemini Live.
- **Transcripción**: el navegador (Web Speech) y, donde no existe (Firefox, algunos iPhone), grabación + **Whisper de Groq**.
- **Pronunciación**: Azure Pronunciation Assessment (puntaje por fonema, 5 h/mes gratis) → si no, Gemini escuchando el audio → si no, Whisper + comparación de palabras.
- **Kokoro**: modelo TTS abierto que corre en un Web Worker (WASM) con `kokoro-js`; se baja de Hugging Face la primera vez y queda guardado en el navegador.
- **Diagnóstico**: cada respuesta de `/api/*` lleva los encabezados `X-AI-Model` (el modelo ganador) y `X-AI-Trace` (JSON con todos los intentos de la carrera). En los logs de Vercel aparece una línea `[ai] <ruta> <estado> ...` por llamada, que puedes filtrar buscando `[ai]`.
- **Gemini Live**: el servidor crea un token temporal de un uso y el navegador conecta directo. La clave nunca sale del servidor. Las tarjetas en vivo son tres funciones (`show_correction`, `show_word`, `give_challenge`) fijadas en el token; el modo económico las recibe en un bloque `CARDS:`. Si tu modelo Live no admite funciones y la llamada no conecta, apágalas en «Configura tu llamada» o con `LIVE_CARDS=0`.
- **Voces por personaje**: `src/content/characters.js` asigna a cada escenario una voz de Gemini, una voz Kokoro de respaldo, un acento y un tono. El acento y el tono salen de listas cerradas (`src/content/voices.js`): el navegador nunca escribe la instrucción de estilo.
- **Diálogos a dos voces**: `/api/tts` acepta `speakers` + `lines` y usa el TTS multi-hablante de Gemini (un solo audio); si falla, el navegador lee línea por línea con la voz de cada personaje.
- **Shadowing**: `src/lib/pitch.js` calcula en el navegador el volumen por tramos y la entonación (autocorrelación). Los puntajes de ritmo y entonación comparan la forma de la frase y son aproximados; el resaltado por palabra es estimado porque el TTS no entrega tiempos.
- **Ligas y recordatorios**: Upstash Redis (capa gratuita) + Web Push con claves VAPID.

```
api/[route].js     router único        api/_routes/   un archivo por endpoint
api/_lib/          gemini (carrera de modelos), prompts, league, push, store, http
src/content/       temas, sonidos, escenarios, gramática, mazo, profesiones, dictado, lecturas, IELTS, voces, personajes, diálogos, aventuras, juegos
src/lib/           srs, rules, align, game, missions, report, audio, live, recorder, league, push, pitch, cards, story, voicegames, handsfree, listen…
src/views/         Hoy, Hablar, Speak60, Pronunciacion, Shadowing, IeltsMock, Conversar, LiveVoice, Leer, Dialogos, Jugar, Historia, Juegos, ManosLibres, Gramatica, Repaso, Liga, Ajustes, Onboarding
tests/             unit (Vitest, 198 pruebas) y e2e (Playwright, 32 pruebas × celular y escritorio, micrófono simulado)
```

## Desplegar en Vercel (gratis)

1. **Clave de Gemini**: créala en <https://aistudio.google.com/apikey>, en un proyecto **sin facturación**, así nunca te cobran. En la capa gratuita Google puede usar los datos para mejorar sus productos.
2. **Vercel**: Add New → Project → importa `mision-ingles` → en *Environment Variables* agrega `GEMINI_API_KEY` (y opcionalmente `APP_ACCESS_CODE`) → Deploy.
3. **Ligas y recordatorios** (opcional): en el proyecto de Vercel ve a **Storage → Marketplace → Upstash (Redis) → Connect**. Crea `KV_REST_API_URL` y `KV_REST_API_TOKEN` solas.
4. **Notificaciones** (opcional): en tu computadora ejecuta `npx web-push generate-vapid-keys`. Copia la clave pública en `VAPID_PUBLIC_KEY` y la privada en `VAPID_PRIVATE_KEY`, y agrega `VAPID_SUBJECT=mailto:tu-correo` y `CRON_SECRET` (cualquier texto largo y secreto). Vuelve a desplegar.
   - El plan gratis de Vercel ejecuta el recordatorio **una vez al día** (19:00 hora de Perú, en `vercel.json`).
   - Para avisar a la hora que elige cada persona: crea una tarea gratis en <https://cron-job.org> que cada hora llame a `https://TU-APP.vercel.app/api/cron-remind?mode=hourly&key=TU_CRON_SECRET`.
   - En iPhone las notificaciones solo funcionan con la app instalada (Compartir → Agregar a inicio).
5. **Más capacidad gratis** (opcional, recomendado): crea claves sin tarjeta en <https://console.groq.com/keys> (`GROQ_API_KEY`) y <https://cloud.cerebras.ai> (`CEREBRAS_API_KEY`). Groq además activa Whisper y el modo de voz económico en navegadores sin reconocimiento de voz.
6. **Pronunciación por fonemas** (opcional): en <https://portal.azure.com> crea un recurso **Speech** con plan **Free F0**, y copia `AZURE_SPEECH_KEY` y `AZURE_SPEECH_REGION` (por ejemplo `eastus`).
7. Comprueba en `https://TU-APP.vercel.app/api/health` que `models.tts` y `models.live` no estén vacíos: si lo están, tu clave no tiene acceso a esos modelos y la app usará la voz del navegador (suena más básica). También muestra `providers`, `stt` y `pronunciation` para saber qué está activo. Si la voz suena básica, descarga **Kokoro** en Ajustes → Voz.
8. En el celular abre la URL → **Instalar app / Agregar a pantalla de inicio**.

Todas las variables están explicadas en `.env.example`.

## Desarrollo local

```bash
npm install
cp .env.example .env      # pon tu GEMINI_API_KEY
npm run dev               # app + /api en http://localhost:5173
npm test                  # Vitest (Gemini, Redis y push simulados)
npm run test:e2e          # Playwright con API simulada y micrófono falso
npm run lint
```
