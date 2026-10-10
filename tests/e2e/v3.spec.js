import { expect, test } from "@playwright/test";

/* v3: acentos y personajes, diálogos a dos voces, shadowing, tarjetas en vivo, historias, juegos y manos libres. */

/** WAV con un tono (para que el análisis de voz tenga algo que dibujar). */
function wav(seconds = 1, hz = 180) {
  const rate = 24000, n = Math.round(rate * seconds), pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 9000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Entra con un perfil ya creado (sin pasar por la prueba de nivel) y la API simulada. */
async function start(page, { ai = true, profile = {}, routes = {} } = {}) {
  await page.addInitScript(p => {
    if (!localStorage.getItem("mision-ingles-v1")) localStorage.setItem("mision-ingles-v1", JSON.stringify({ profile: { onboarded: true, name: "Ana", level: "B1", ...p } }));
  }, profile);
  const seen = {};
  await page.route("**/api/**", async route => {
    const name = new URL(route.request().url()).pathname.replace("/api/", "");
    const json = body => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (name === "health") return json(routes.health ? routes.health(route.request().headers()) : { ok: true, ai, accessCodeRequired: false });
    const body = route.request().postDataJSON();
    (seen[name] = seen[name] || []).push(body);
    if (name === "tts") return route.fulfill({ status: 200, contentType: "audio/wav", body: wav(body.lines ? 2 : 1) });
    if (routes[name]) return json(routes[name](body));
    return json({ text: "ok" });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  return seen;
}
const xp = page => page.getByTestId("xp-chip");
const tab = (page, name) => page.getByRole("tab", { name, exact: true }).click();
const say = async (page, id, text) => { const box = page.getByTestId("saybox-" + id); await box.getByRole("textbox").fill(text); await box.getByRole("textbox").press("Enter"); };

test("acento y tono elegidos en Ajustes llegan a la voz natural", async ({ page }) => {
  const seen = await start(page);
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: /Ajustes/ }).click();
  await expect(page.locator("#stAccent option")).toHaveCount(7);
  await page.locator("#stAccent").selectOption("au");
  await page.locator("#stTone").selectOption("cheerful");
  await page.getByRole("button", { name: "Guardar" }).click();
  await tab(page, "Gramática");
  await page.locator(".examples li").first().getByRole("button").click();
  await expect.poll(() => (seen.tts || []).length).toBe(1);
  expect(seen.tts[0]).toMatchObject({ accent: "au", tone: "cheerful", voice: "Kore" });
});

test("En vivo: cada escenario tiene su personaje, con su voz y su acento", async ({ page }) => {
  const seen = await start(page, { routes: { "live-token": () => ({}) } });
  await tab(page, "En vivo");
  const who = page.getByTestId("character");
  await expect(who).toContainText("Alex");
  const setup = page.getByTestId("live-setup");
  await setup.getByRole("button", { name: /Juego de roles/ }).click();
  await setup.locator("#lvScen").selectOption("doctor");
  await expect(who).toContainText("Dr. Patel");
  await expect(who).toContainText("Indio");
  await who.getByRole("button", { name: "Escuchar" }).click();
  await expect.poll(() => (seen.tts || []).length).toBe(1);
  expect(seen.tts[0]).toMatchObject({ voice: "Iapetus", accent: "in", tone: "calm" });
  await page.getByRole("button", { name: "Iniciar llamada" }).click();
  await expect.poll(() => (seen["live-token"] || []).length).toBe(1);
  expect(seen["live-token"][0]).toMatchObject({ scenario: "doctor", voice: "Iapetus", accent: "in", tone: "calm", cards: true });
});

test("diálogo a dos voces: un solo audio, guion oculto al inicio, preguntas y misión bonus", async ({ page }) => {
  const seen = await start(page);
  await tab(page, "Escuchar y leer");
  await page.getByRole("button", { name: "Diálogos" }).click();
  const dlg = page.getByTestId("dialogue");
  await expect(page.getByTestId("dialogue-cast")).toContainText("Megan");
  await expect(dlg).not.toContainText("sales report");
  const play = page.getByTestId("dialogue-play");
  await play.click();
  await expect(play).toContainText("Detener");
  expect(seen.tts[0].speakers).toEqual([{ name: "Megan", voice: "Sulafat" }, { name: "James", voice: "Alnilam" }]);
  expect(seen.tts[0].lines).toHaveLength(10);
  await expect(dlg.locator(".dl.on")).toHaveCount(1);
  await play.click();
  await page.getByRole("button", { name: "Ver guion" }).click();
  await expect(dlg).toContainText("It's about the sales report.");
  for (const answer of ["Some numbers arrived late", "The parts that are ready", "By Thursday morning"]) await page.getByRole("button", { name: answer }).click();
  await expect(page.locator(".opt.right")).toHaveCount(3);
  await expect(xp(page)).toContainText("15 / 50 XP");
  await tab(page, "Hoy");
  await expect(page.getByTestId("mission-dialogue")).toContainText("Diálogo");
});

test("diálogo nuevo con IA: usa la pareja que elige el servidor", async ({ page }) => {
  const lines = Array.from({ length: 6 }, (_, i) => [i % 2, `Generated line number ${i}.`]);
  const questions = [0, 1, 2].map(i => ({ q: "Question " + i, o: ["a" + i, "b" + i, "c" + i], a: 0 }));
  const seen = await start(page, { routes: { dialogue: () => ({ title: "At the clinic", setting_es: "Una cita.", speakers: ["emma", "patel"], lines, questions }) } });
  await tab(page, "Escuchar y leer");
  await page.getByRole("button", { name: "Diálogos" }).click();
  await page.getByRole("button", { name: "Otro diálogo" }).click();
  await expect(page.getByRole("heading", { name: "At the clinic" })).toBeVisible();
  await expect(page.getByTestId("dialogue-cast")).toContainText("Dr. Patel");
  expect(seen.dialogue[0]).toMatchObject({ level: "B1" });
});

test("shadowing: escucha al nativo, se graba y compara las dos voces", async ({ page }) => {
  await start(page, { routes: { "pron-assess": b => ({ score: 82, transcript: b.target, words: b.target.split(" ").map((w, i) => ({ word: w, ok: i !== 1, issue_es: i === 1 ? "Vocal demasiado larga." : "" })), sounds_to_practice: [], tip_es: "Une las palabras.", method: "gemini" }) } });
  await tab(page, "Hablar");
  await page.getByRole("button", { name: "Shadowing" }).click();
  const card = page.getByTestId("shadowing");
  await expect(card.getByRole("button", { name: /Escuchar al nativo/ })).toBeVisible();
  await card.getByRole("button", { name: /Repetir y grabar/ }).click();
  await page.waitForTimeout(1200);
  await card.getByRole("button", { name: "Detener grabación" }).click();
  const scores = page.getByTestId("shadow-scores");
  await expect(scores).toContainText("Ritmo");
  await expect(scores).toContainText("Entonación");
  await expect(xp(page)).toContainText("4 / 50 XP");
  await card.getByRole("button", { name: /Evaluar pronunciación/ }).click();
  await expect(page.getByTestId("shadow-ai")).toContainText("82/100");
  await expect(page.getByTestId("shadow-text").locator(".w-miss")).toHaveCount(1);
});

test("tarjetas en vivo: aparecen durante la llamada y se guardan en el mazo", async ({ page }) => {
  await page.addInitScript(() => {
    const said = ["I go to work in bus"];
    let n = 0;
    class FakeSR {
      start() { const text = said[n++] || ""; this._t = setTimeout(() => { if (text && this.onresult) this.onresult({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); if (this.onend) this.onend(); }, 300); }
      abort() { clearTimeout(this._t); }
      stop() { this.abort(); }
    }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  });
  const seen = await start(page, { profile: { liveEngine: "economy" }, routes: { "voice-turn": b => (b.turns.length
    ? { reply: "Nice! How long does it take?", cards: [{ type: "correction", original: "in bus", corrected: "by bus", explanation_es: "Transporte con «by»." }, { type: "word", word: "commute", meaning_es: "trayecto al trabajo", example: "My commute is short." }, { type: "challenge", challenge_es: "Usa «usually» en tu respuesta", target: "usually" }] }
    : { reply: "Hi Ana! How do you get to work?", cards: [] }) } });
  await tab(page, "En vivo");
  await page.getByRole("button", { name: "Iniciar llamada" }).click();
  const cards = page.getByTestId("live-cards");
  await expect(cards.locator(".lc")).toHaveCount(3, { timeout: 15000 });
  await expect(cards).toContainText("by bus");
  await expect(cards).toContainText("usually");
  await cards.locator(".lc.word").getByRole("button", { name: "+ Guardar" }).click();
  await expect(cards.locator(".lc.word").getByRole("button")).toHaveText("Guardada");
  await cards.locator(".lc.correction").getByRole("button", { name: "+ Guardar" }).click();
  await page.getByRole("button", { name: "Colgar" }).click();
  expect(seen["voice-turn"][0]).toMatchObject({ cards: true, voice: "Puck", accent: "us" });
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("mision-ingles-v1")));
  expect(state.cards.some(c => c.front === "commute" && c.tag === "en vivo")).toBe(true);
  expect(state.mistakes.some(m => m.wrong === "in bus" && m.right === "by bus")).toBe(true);
});

test("historia sin IA: se juega hasta el final eligiendo con la voz o el teclado", async ({ page }) => {
  await start(page, { ai: false });
  await tab(page, "Jugar");
  const list = page.getByTestId("adventures");
  await expect(list.getByRole("button")).toHaveCount(4);
  await expect(list.getByRole("button", { name: /Misterio en Londres/ })).toBeDisabled();
  await list.getByRole("button", { name: /Perdido en el aeropuerto/ }).click();
  const story = page.getByTestId("story");
  await expect(story).toContainText("baggage belt");
  await say(page, "story", "I like pizza");
  await expect(page.locator(".toast")).toContainText("No coincide");
  await say(page, "story", "excuse me where is the airline desk");
  await expect(story).toContainText("How can I help you today?");
  await page.getByTestId("story-choices").getByRole("button").first().click();
  await expect(story).toContainText("still in Madrid");
  await say(page, "story", "I need my bag today this is unacceptable");
  await expect(story).toContainText("before breakfast");
  await page.getByTestId("story-choices").getByRole("button").first().click();
  await expect(page.getByTestId("story-end")).toContainText("Reportaste la maleta perdida");
  await expect(page.getByTestId("play-xp")).toContainText("16 / 40");
});

test("historia con IA: la escena siguiente depende de lo que dices y trae corrección", async ({ page }) => {
  const seen = await start(page, { routes: { "story-turn": b => (b.history.length >= 2
    ? { narration: "The guard smiles and opens the door.", lines: [[0, "Thank you for your help."]], choices: [], ending: true, ending_es: "Resolviste el misterio.", correction: null }
    : { narration: "The guard writes it down quickly.", lines: [[1, "A black bag, you say? Which way did he go?"]], choices: ["He went to the exit.", "He went upstairs.", "I am not sure."], ending: false, ending_es: "", correction: { corrected: "I saw a man with a big bag.", explanation_es: "Pasado de «see»: saw." } }) } });
  await tab(page, "Jugar");
  await page.getByTestId("adventures").getByRole("button", { name: /Misterio en Londres/ }).click();
  const story = page.getByTestId("story");
  await say(page, "story", "I see a man with big bag");
  await expect(story).toContainText("Which way did he go?");
  await expect(story.locator(".fix")).toContainText("I saw a man with a big bag.");
  expect(seen["story-turn"][0]).toMatchObject({ story: "mystery", say: "I see a man with big bag", level: "B1" });
  expect(seen["story-turn"][0].history).toHaveLength(1);
  await say(page, "story", "He went to the exit");
  await expect(page.getByTestId("story-end")).toContainText("Resolviste el misterio.");
  expect(seen["story-turn"][1].history[0].say).toBe("I see a man with big bag");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("mision-ingles-v1")));
  expect(state.mistakes[0]).toMatchObject({ wrong: "I see a man with big bag", right: "I saw a man with a big bag." });
});

test("juegos de voz: adivina la palabra y contra reloj dan puntos, récord y XP con tope", async ({ page }) => {
  await start(page, { ai: false });
  await tab(page, "Jugar");
  await page.getByRole("button", { name: "Juegos de voz" }).click();
  await expect(page.getByTestId("games").getByRole("button")).toHaveCount(4);
  await page.getByTestId("games").getByRole("button", { name: /Adivina la palabra/ }).click();
  const answers = { taxes: "taxes", mechanic: "a mechanic", "check in": "you check in", deadline: "deadline", interview: "an interview", cheap: "cheap", receipt: "the receipt", tired: "tired" };
  const CLUES = { government: "taxes", repairs: "mechanic", hotel: "check in", "last day": "deadline", "asks you questions": "interview", opposite: "cheap", "piece of paper": "receipt", slept: "tired" };
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: /Ver la pista escrita|Ocultar texto/ }).click();
    const clue = await page.getByTestId("riddle-clue").innerText();
    const key = Object.keys(CLUES).find(k => clue.includes(k));
    await say(page, "riddle", i === 0 ? "I have no idea" : answers[CLUES[key]]);
    if (i < 4) await expect(page.getByText(`Ronda ${i + 2} de 5`)).toBeVisible();
  }
  await expect(page.getByTestId("game-result")).toContainText("80 puntos");
  await expect(page.getByTestId("game-result")).toContainText("Acertaste 4 de 5");
  await expect(page.getByTestId("play-xp")).toContainText("6 / 40");
  await page.getByRole("button", { name: "Otros juegos" }).click();
  await expect(page.getByTestId("games").getByRole("button", { name: /Adivina la palabra/ })).toContainText("Récord: 80");
  await page.getByTestId("games").getByRole("button", { name: /Contra reloj/ }).click();
  await say(page, "clock", "I think the best trip was to Cusco because the mountains were beautiful");
  await expect(page.getByTestId("game-result")).toContainText("13 palabras");
});

test("manos libres: el coach dice, tú repites y los comandos de voz funcionan", async ({ page }) => {
  await page.addInitScript(() => {
    // 1.ª escucha: repite bien · 2.ª: «next» · 3.ª: «stop».
    let n = 0;
    class FakeSR {
      start() {
        const text = n === 0 ? document.querySelector('[data-testid="hf-text"]').innerText : n === 1 ? "next" : "stop";
        n++;
        this._t = setTimeout(() => { if (this.onresult) this.onresult({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); if (this.onend) this.onend(); }, 200);
      }
      abort() { clearTimeout(this._t); }
      stop() { this.abort(); }
    }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  });
  const seen = await start(page);
  await tab(page, "Jugar");
  await page.getByRole("button", { name: "Manos libres" }).click();
  const hf = page.getByTestId("handsfree");
  await hf.getByRole("button", { name: "Empezar" }).click();
  await expect(page.getByTestId("hf-summary")).toContainText("Repetiste 1 frases", { timeout: 25000 });
  await expect(page.getByTestId("hf-summary")).toContainText("100%");
  await expect(hf.getByRole("button", { name: "Empezar otra vez" })).toBeVisible();
  const texts = seen.tts.map(t => t.text);
  expect(texts[0]).toMatch(/Hands-free practice/);
  expect(texts).toContain("Perfect.");
  expect(texts.at(-1)).toMatch(/Well done/);
  await expect(page.getByTestId("play-xp")).toContainText("2 / 40");
});

test("panel: «Lo nuevo» lleva a cada función, marca las vistas y se puede ocultar", async ({ page }) => {
  await start(page);
  const box = page.getByTestId("whats-new");
  await expect(box.getByRole("button")).toHaveCount(9); // 8 funciones + Ocultar
  await expect(box).toContainText("8 de 8 por probar");
  await page.getByTestId("new-shadow").click();
  await expect(page.getByTestId("shadowing")).toBeVisible();
  await tab(page, "Hoy");
  await expect(box).toContainText("7 de 8 por probar");
  await expect(page.getByTestId("new-shadow")).toHaveClass(/seen/);
  await page.getByTestId("new-handsfree").click();
  await expect(page.getByTestId("handsfree")).toBeVisible();
  await tab(page, "Hoy");
  await page.getByTestId("new-accents").click();
  await expect(page.locator("#stAccent")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await box.getByRole("button", { name: "Ocultar" }).click();
  await expect(box).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("whats-new")).toHaveCount(0);
});

test("código de acceso: se pide una vez en el panel, se comprueba y queda guardado", async ({ page }) => {
  const health = h => ({ ok: true, ai: true, accessCodeRequired: true, accessOk: h["x-access-code"] === "lima2026" });
  const seen = await start(page, { routes: { health } });
  const box = page.getByTestId("access-code");
  await expect(box).toContainText("Activa el coach IA en este dispositivo");
  await box.getByRole("textbox").fill("otro");
  await box.getByRole("button", { name: "Activar" }).click();
  await expect(box).toContainText("no es correcto");
  await box.getByRole("textbox").fill(" lima2026 ");
  await box.getByRole("button", { name: "Activar" }).click();
  await expect(box).toHaveCount(0);
  await expect(page.locator(".chips .ai-on")).toContainText("Coach IA activo");
  // Al volver a abrir la app no se pide de nuevo, y las consultas llevan el código.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  await expect(page.locator(".chips .ai-on")).toContainText("Coach IA activo");
  await expect(page.getByTestId("access-code")).toHaveCount(0);
  const req = page.waitForRequest("**/api/tts");
  await tab(page, "Gramática");
  await page.locator(".examples li").first().getByRole("button").click();
  expect((await req).headers()["x-access-code"]).toBe("lima2026");
  expect(seen.tts).toHaveLength(1);
});

test("código de acceso guardado que ya no sirve: avisa y deja corregirlo", async ({ page }) => {
  const health = h => ({ ok: true, ai: true, accessCodeRequired: true, accessOk: h["x-access-code"] === "nuevo" });
  await start(page, { profile: { accessCode: "viejo" }, routes: { health } });
  await expect(page.getByTestId("access-code")).toContainText("ya no es válido");
  await expect(page.locator(".chips .ai-off")).toContainText("Falta código de acceso");
});

test("voz Kokoro descargada: sigue activa después de Guardar y de volver a abrir la app", async ({ page }) => {
  await page.addInitScript(() => {
    const wavBuf = () => { const n = 24000, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf); const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true); return buf; };
    window.__kokoroMsgs = [];
    window.Worker = class {
      postMessage(m) {
        window.__kokoroMsgs.push(m);
        // La carga tarda: sirve para comprobar que el botón espera al modelo en vez de usar otra voz.
        if (m.type === "load") setTimeout(() => this.onmessage({ data: { type: "ready" } }), 1500);
        if (m.type === "speak") setTimeout(() => this.onmessage({ data: { type: "audio", id: m.id, buf: wavBuf() } }), 20);
      }
      terminate() {}
    };
  });
  const seen = await start(page);
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: /Ajustes/ }).click();
  await page.getByRole("button", { name: "Kokoro (en tu equipo)" }).click();
  await page.getByRole("button", { name: "Descargar voz Kokoro" }).click();
  await expect(page.getByTestId("kokoro")).toContainText("Voz Kokoro lista");
  await page.getByRole("button", { name: "Guardar" }).click();
  let profile = await page.evaluate(() => JSON.parse(localStorage.getItem("mision-ingles-v1")).profile);
  expect(profile).toMatchObject({ kokoroEnabled: true, voiceMode: "kokoro" });

  await page.reload();
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  await tab(page, "Gramática");
  const btn = page.locator(".examples li").first().getByRole("button");
  await btn.click(); // el modelo aún se está cargando: espera
  await expect(btn).toHaveClass(/loading/);
  await expect(btn).toHaveAttribute("data-engine", "kokoro", { timeout: 8000 });
  await expect(btn).toHaveClass(/playing/);
  expect(await page.evaluate(() => window.__kokoroMsgs.map(m => m.type))).toEqual(["load", "speak"]);
  expect(seen.tts || []).toHaveLength(0);
  await expect(page.locator(".toast")).toHaveCount(0);
});
