# Misión Inglés

Coach de inglés para hispanohablantes, instalable en el celular (PWA). Reúne lo mejor de Stimuler, Duolingo, ELSA y Anki:

| Sección | Qué hace |
|---|---|
| **Hoy** | Panel con meta diaria de XP, racha, gráfico de 14 días, ruta MCER (A1–C2), habilidades, errores frecuentes y logros |
| **Misiones diarias** | Habla 60 s · sonido del día · tema de gramática · repaso de tarjetas · bonus de conversación |
| **Hablar** | Hablas 60 s sobre un tema → puntajes de fluidez, gramática, vocabulario y coherencia, errores corregidos con la regla en español y una versión mejorada que puedes escuchar |
| **Pronunciación** | Sonidos difíciles para hispanohablantes (/θ/, ship–sheep, v–b, «estudent», -ed…), pares mínimos y frases para imitar con puntaje por palabra |
| **Conversar** | Juegos de roles (entrevista, cafetería, aeropuerto, médico, cliente, colega) con corrección en cada mensaje |
| **Gramática** | 10 temas por nivel con explicación, fórmula, ejemplos con audio, ejercicios, «Explica mi respuesta» y «Pregúntale al profe» |
| **Repaso** | Tarjetas con repetición espaciada (falsos amigos, phrasal verbs, colocaciones) y cuaderno de errores: **cada error corregido se vuelve tarjeta** |

Sin IA (o sin conexión con el coach), la app sigue funcionando en **modo básico**: detecta 20 errores típicos de hispanohablantes, mide palabras por minuto y muletillas, y mantiene el repaso, la pronunciación y la gramática.

## Cómo está hecha

- **Frontend**: React 19 + Vite 8 + `vite-plugin-pwa`. El progreso se guarda en el dispositivo; en *Ajustes* puedes descargar y restaurar una copia de seguridad (JSON).
- **IA**: Gemini, llamado solo desde funciones serverless en `api/`. La clave **nunca** llega al navegador. Prueba una cadena de modelos: si uno falla o está saturado, pasa al siguiente.
- **Voz**: gratis, en el navegador. Para hablar usa Web Speech API (Chrome, Edge, Android y Safari) y, como respaldo, el micrófono del teclado del celular. Para escuchar usa `speechSynthesis`.
- **No necesita Supabase.** Solo haría falta para tener login y sincronizar entre dispositivos (ver `PLAN.md`, fase 2).

```
api/            funciones serverless: speak-evaluate, chat-turn, chat-suggest, grammar-explain, grammar-ask, health
src/content/    contenido: temas, sonidos, escenarios, gramática, mazo
src/lib/        lógica pura: srs, rules, align, analyze, game, missions, storage, speech, api
src/views/      pantallas: Hoy, Hablar, Pronunciacion, Conversar, Gramatica, Repaso, Ajustes, Onboarding
prototype/      primer prototipo de un solo archivo (referencia)
tests/          unit (Vitest) y e2e (Playwright)
```

## Desplegar en Vercel (gratis, ~5 minutos)

1. Crea una **clave de Gemini** en <https://aistudio.google.com/apikey>.
2. Entra a <https://vercel.com> con tu cuenta de GitHub → **Add New… → Project** → importa `mision-ingles` (Vercel detecta Vite solo).
3. En **Environment Variables** agrega:
   - `GEMINI_API_KEY` = tu clave (obligatoria)
   - `APP_ACCESS_CODE` = un código para que solo tú y tus alumnos usen el coach IA (opcional, recomendado)
   - `DAILY_LIMIT_PER_IP` = consultas al coach por día y por IP (opcional, por defecto 80)
   - `GEMINI_MODELS` = cadena de modelos (opcional; ver `.env.example`)
4. **Deploy**. Cada push a `main` vuelve a desplegar.
5. En el celular, abre la URL → menú del navegador → **Instalar app / Agregar a pantalla de inicio**.

¿Quieres que aparezca en Google Sites? Agrega un botón o enlace a la URL de Vercel. No conviene incrustarla dentro de Sites, porque ahí el micrófono queda bloqueado.

## Desarrollo local

```bash
npm install
cp .env.example .env      # pon tu GEMINI_API_KEY
npm run dev               # la app y /api/* en http://localhost:5173
npm test                  # pruebas unitarias y de la API (Gemini simulado)
npm run test:e2e          # Playwright: recorre las 5 misiones con la API simulada
npm run lint
```
