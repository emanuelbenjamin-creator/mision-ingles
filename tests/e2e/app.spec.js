import { expect, test } from "@playwright/test";
import { GRAMMAR } from "../../src/content/grammar.js";

/* Recorre las 5 misiones con la API de Gemini simulada y comprueba XP, racha, cuaderno y persistencia. */

async function mockApi(page) {
  await page.route("**/api/**", async route => {
    const url = route.request().url();
    const json = body => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.endsWith("/api/health")) return json({ ok: true, ai: true, accessCodeRequired: false });
    if (url.endsWith("/api/speak-evaluate")) return json({ scores: { fluency: 72, grammar: 64, vocabulary: 58, coherence: 70 }, cefr_estimate: "B1", corrections: [{ original: "I have 30 years", corrected: "I am 30 years old", explanation_es: "La edad se dice con to be.", rule: "Edad con to be" }], better_version: "I'm 30 years old and I work at a bank.", vocabulary_upgrades: [{ basic: "good", advanced: "rewarding", example: "My job is rewarding." }], tip_es: "Usa más conectores." });
    if (url.endsWith("/api/chat-turn")) {
      const body = route.request().postDataJSON();
      const last = body.turns.at(-1).content;
      return json({ reply: "That sounds great! Tell me more.", correction: /years/.test(last) ? { corrected: "I am 30 years old.", explanation_es: "Edad con to be.", rule: "Edad con to be" } : null });
    }
    if (url.endsWith("/api/grammar-explain")) return json({ text: "Explicación del profe simulada." });
    return json({ text: "ok", suggestions: ["Sure!"] });
  });
}

async function onboard(page) {
  await page.goto("/");
  await expect(page.getByTestId("onboarding")).toBeVisible();
  await page.getByRole("button", { name: "Inglés para el trabajo" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Contabilidad y tributos" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /^Regular/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Hacer la prueba de nivel" }).click();
  for (let i = 0; i < 8; i++) await page.locator(".opt").first().click();
  await expect(page.getByRole("heading", { name: /Empiezas en/ })).toBeVisible();
  await page.getByLabel(/Cómo te llamas/).fill("Ana");
  await page.getByRole("button", { name: "Empezar mis misiones" }).click();
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
}

const xp = page => page.getByTestId("xp-chip");
async function openSettings(page) {
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: /Ajustes/ }).click();
}

test("primer uso: prueba de nivel y panel", async ({ page }) => {
  await mockApi(page);
  await onboard(page);
  await expect(page.locator(".mission")).toHaveCount(7);
  await expect(xp(page)).toContainText("0 / 50 XP");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("las 5 misiones suman XP, racha y cuaderno, y todo persiste al recargar", async ({ page }) => {
  await mockApi(page);
  await onboard(page);

  // 1. Habla 60 s
  await page.getByTestId("mission-speak").getByRole("button", { name: "Empezar" }).click();
  await page.locator("#spText").fill("Well, I have 30 years and I work in a bank in Lima. My job is good because I help people every day and I learn new things about money and customers.");
  await page.getByRole("button", { name: "Evaluar mi respuesta" }).click();
  await expect(page.getByTestId("speak-feedback")).toContainText("I am 30 years old");
  await expect(page.getByTestId("speak-feedback")).toContainText("Nivel estimado B1");
  await expect(xp(page)).toContainText("20 / 50 XP");

  // 2. Pronunciación
  await page.getByRole("button", { name: "Pronunciación", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    const sentence = await page.locator(".sent .en").nth(i).innerText();
    await page.locator("#pr" + i).fill(sentence);
    await page.locator(".sent").nth(i).getByRole("button", { name: "Comprobar" }).click();
  }
  await expect(page.locator(".sent .pill.ok")).toHaveCount(3);
  await expect(xp(page)).toContainText("35 / 50 XP");

  // 3. Gramática: falla la primera (va al cuaderno) y acierta el resto
  await page.getByRole("tab", { name: "Hoy" }).click();
  await page.getByTestId("mission-grammar").getByRole("button", { name: "Empezar" }).click();
  const title = await page.locator(".card-head h2").first().innerText();
  const topic = GRAMMAR.find(g => g.name === title);
  for (const [i, q] of topic.qs.entries()) {
    const pick = i === 0 ? q.o[(q.a + 1) % q.o.length] : q.o[q.a];
    await page.locator(".q").nth(i).getByRole("button", { name: pick, exact: true }).click();
  }
  await expect(page.locator(".opt.wrong")).toHaveCount(1);
  await page.locator(".expl").first().getByRole("button", { name: "Explica mi respuesta" }).click();
  await expect(page.locator(".expl").first()).toContainText("Explicación del profe simulada.");
  await expect(xp(page)).toContainText("50 / 50 XP");

  // 4. Conversación: 4 intercambios, uno con error
  await page.getByRole("tab", { name: "Conversar" }).click();
  for (const msg of ["Hi! I have 30 years.", "I work in a bank.", "I like my job.", "Thank you, see you soon."]) {
    await page.locator("#chatIn").fill(msg);
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByTestId("chat").locator(".msg.ai")).toHaveCount(await page.getByTestId("chat").locator(".msg.me").count() + 1);
  }
  await expect(page.locator(".corr").first()).toContainText("I am 30 years old.");
  await expect(page.locator(".pill.ok", { hasText: "4 / 4" })).toBeVisible();

  // 5. Repaso: 10 tarjetas (o todas las de hoy)
  await page.getByRole("tab", { name: "Repaso" }).click();
  for (let i = 0; i < 10; i++) {
    if (!(await page.getByRole("button", { name: "Mostrar respuesta" }).count())) break;
    await page.getByRole("button", { name: "Mostrar respuesta" }).click();
    await page.locator(".grades button").nth(2).click();
  }
  await expect(page.locator(".mk").first()).toBeVisible();

  // Panel: misiones completas y datos persistentes
  await page.getByRole("tab", { name: "Hoy" }).click();
  await expect(page.getByTestId("mission-speak")).toHaveClass(/done/);
  await expect(page.getByTestId("mission-pron")).toHaveClass(/done/);
  await expect(page.getByTestId("mission-grammar")).toHaveClass(/done/);
  await expect(page.getByTestId("mission-review")).toHaveClass(/done/);
  await expect(page.getByTestId("mission-chat")).toHaveClass(/done/);
  await expect(page.locator(".chip.flame")).toContainText("1 días");
  const before = await xp(page).innerText();
  await page.reload();
  await expect(xp(page)).toHaveText(before);
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  await page.getByRole("tab", { name: "Repaso" }).click();
  await expect(page.locator(".mk", { hasText: "I am 30 years old" }).first()).toBeVisible();
});

test("sin IA la app sigue funcionando en modo básico", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ai: false, accessCodeRequired: false }) }));
  await onboard(page);
  await expect(page.getByRole("button", { name: "Modo básico (sin IA)" })).toBeVisible();
  await page.getByRole("tab", { name: "Hablar" }).click();
  await page.locator("#spText").fill("I have 30 years and the people is very friendly in my city, I live here since 3 years and it is more better than my old town.");
  await page.getByRole("button", { name: "Evaluar mi respuesta" }).click();
  await expect(page.getByTestId("speak-feedback")).toContainText("Evaluación básica sin IA");
  await expect(page.getByTestId("speak-feedback")).toContainText("people are");
  await expect(page.getByTestId("speak-feedback")).toContainText("for 3 years");
});

test("el botón de audio cambia a Detener mientras suena y vuelve a Escuchar", async ({ page }) => {
  const pcm = Buffer.alloc(24000 * 2 * 3); // 3 s de silencio
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  let ttsCalls = 0;
  await mockApi(page);
  await page.route("**/api/tts", route => { ttsCalls++; return route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.concat([h, pcm]) }); });
  await onboard(page);
  await page.getByRole("tab", { name: "Gramática" }).click();
  const btn = page.locator(".examples li").first().getByRole("button");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-label", "Detener");
  await expect(btn).toHaveClass(/playing/);
  await btn.click();
  await expect(btn).toHaveAttribute("aria-label", "Escuchar");
  await btn.click(); // segunda vez: sale de la caché, sin llamar otra vez al servidor
  await expect(btn).toHaveAttribute("aria-label", "Detener");
  expect(ttsCalls).toBe(1);
});

test("voz en vivo: muestra la llamada, el examinador IELTS y los errores del servidor", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/live-token", route => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ code: "rate_limited", error: "Llegaste al límite de uso de hoy. Vuelve mañana." }) }));
  await onboard(page);
  await page.getByRole("tab", { name: "Conversar" }).click();
  await page.getByRole("button", { name: "Voz en vivo" }).click();
  await expect(page.getByTestId("live")).toContainText("Listo para llamar");
  await page.getByRole("button", { name: "Examinador IELTS" }).click();
  await expect(page.getByTestId("live")).toContainText("Examinador IELTS");
  await page.getByRole("button", { name: "Iniciar llamada" }).click();
  await expect(page.locator(".err")).toContainText("límite de uso de hoy");
  await expect(page.getByRole("button", { name: "Iniciar llamada" })).toBeVisible();
});

test("pronunciación: grábate, escúchate y Gemini marca las palabras", async ({ page }) => {
  let sent;
  await mockApi(page);
  await page.route("**/api/pron-assess", route => {
    sent = route.request().postDataJSON();
    const words = sent.target.split(/\s+/).map((w, i) => ({ word: w, ok: i !== 1, issue_es: i === 1 ? "Pon la lengua entre los dientes para /θ/." : "" }));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ score: 82, transcript: sent.target, words, sounds_to_practice: ["/θ/"], tip_es: "Más despacio." }) });
  });
  await onboard(page);
  await page.getByTestId("mission-pron").getByRole("button", { name: "Empezar" }).click();
  const first = page.locator(".sent").first();
  await first.getByRole("button", { name: "Grábate" }).click();
  await page.waitForTimeout(1200);
  await first.getByRole("button", { name: "Detener grabación" }).click();
  await expect(first.getByRole("button", { name: "Tu voz" })).toBeVisible();
  await first.getByRole("button", { name: "Evaluar con IA" }).click();
  await expect(page.getByTestId("pron-ai-0")).toContainText("Pon la lengua entre los dientes");
  await expect(first.locator(".pill")).toHaveText("82%");
  await expect(first.locator(".w-miss")).toHaveCount(1);
  expect(sent.audio.length).toBeGreaterThan(2000);
  expect(Buffer.from(sent.audio, "base64").toString("ascii", 0, 4)).toBe("RIFF");
});

test("escuchar y leer: dictado y lectura completan sus misiones; tocar una palabra la agrega al mazo", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/reading", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    title: "The Audit", text: "Ana prepared the audit report on Monday. Her manager reviewed every invoice carefully before lunch.\n\nThe client was happy because the report arrived early and had no mistakes at all.",
    glossary: [["audit", "auditoría"]], questions: [{ q: "When?", o: ["Monday", "Friday"], a: 0 }, { q: "Who reviewed?", o: ["Ana", "Her manager"], a: 1 }, { q: "Client?", o: ["Happy", "Angry"], a: 0 }] }) }));
  await page.route("**/api/word", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ es: "factura", ipa: "/ˈɪn.vɔɪs/", example: "Send the invoice." }) }));
  await onboard(page);

  await page.getByTestId("mission-dictation").getByRole("button", { name: "Empezar" }).click();
  const sents = page.locator(".sent");
  for (let i = 0; i < 5; i++) {
    await page.locator("#dict" + i).fill(i === 0 ? "wrong words here" : "I think it was this");
    await sents.nth(i).getByRole("button", { name: "Comprobar" }).click();
  }
  await expect(page.getByTestId("dict-res-0").locator(".w-miss").first()).toBeVisible();

  await page.getByRole("button", { name: "Lectura" }).click();
  await expect(page.getByTestId("reading")).toContainText("Ana prepared the audit report");
  await page.getByTestId("reading").getByRole("button", { name: "invoice", exact: true }).click();
  await expect(page.getByTestId("word-card")).toContainText("factura");
  await page.getByRole("button", { name: "+ Agregar a mis tarjetas" }).click();
  await expect(page.locator(".toast")).toContainText("ya estaba en tus tarjetas", { timeout: 15000 }); // los avisos salen en cola
  await page.getByTestId("reading").getByRole("button", { name: "audit", exact: true }).click();
  await expect(page.getByTestId("word-card")).toContainText("auditoría");
  for (const [i, opt] of [[0, "Monday"], [1, "Her manager"], [2, "Happy"]]) await page.locator(".q").nth(i).getByRole("button", { name: opt }).click();
  await expect(page.locator(".opt.right")).toHaveCount(3);

  await page.getByRole("tab", { name: "Hoy" }).click();
  await expect(page.getByTestId("mission-dictation")).toHaveClass(/done/);
  await expect(page.getByTestId("mission-reading")).toHaveClass(/done/);
  await page.getByRole("tab", { name: "Repaso" }).click();
  await expect(page.locator(".tile", { hasText: "nuevas" })).toContainText("42"); // 30 base + 12 de contabilidad («invoice» ya estaba: no se duplica)
});

test("reporte semanal y lección con tus errores", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/mistakes-lesson", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    summary_es: "Confundes have y be.", patterns: [{ rule: "Edad con to be", explanation_es: "Usa be para la edad.", examples: ["I am 30 years old."] }],
    exercises: [{ s: "She ___ 25.", o: ["is", "has"], a: 0, why: "be" }, { s: "I ___ hungry.", o: ["am", "have"], a: 0, why: "be" }, { s: "We ___ right.", o: ["are", "have"], a: 0, why: "be" }] }) }));
  await onboard(page);
  await expect(page.getByTestId("weekly-report")).toContainText("Reporte semanal");
  await page.getByTestId("weekly-report").getByRole("button", { name: "Anterior" }).click();
  await expect(page.getByTestId("weekly-report")).toContainText("Desde el lunes");
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("mision-ingles-v1"));
    st.mistakes = [1, 2, 3, 4, 5].map(i => ({ d: "2026-10-01", wrong: "I have " + i + " years", right: "I am " + i + " years old", why: "", rule: "Edad con to be", src: "habla" }));
    localStorage.setItem("mision-ingles-v1", JSON.stringify(st));
  });
  await page.reload();
  await page.getByRole("tab", { name: "Repaso" }).click();
  await page.getByRole("button", { name: "Crear mi lección de la semana" }).click();
  await expect(page.getByTestId("lesson")).toContainText("Confundes have y be.");
  for (let i = 0; i < 3; i++) await page.getByTestId("lesson").locator(".q").nth(i).locator(".opt").first().click();
  await expect(page.getByTestId("lesson").locator(".opt.right")).toHaveCount(3);
  await expect(page.getByTestId("xp-chip")).toContainText("15 /");
});

test("simulacro IELTS completo: graba la Part 2 y muestra las bandas", async ({ page }) => {
  let sent;
  await mockApi(page);
  await page.route("**/api/ielts-evaluate", route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      bands: { fc: 6, lr: 6.5, gra: 6, p: 6.5 }, overall: 6.5, pronunciationFromAudio: true,
      criteria_es: { fc: "Hablas con fluidez razonable.", lr: "Buen vocabulario.", gra: "Algunos errores.", p: "Clara." },
      corrections: [{ original: "people is", corrected: "people are", explanation_es: "plural", rule: "People es plural" }], better_phrases: [{ instead: "very good", try: "outstanding" }], next_steps_es: ["Usa más conectores."] }) });
  });
  await onboard(page);
  await page.getByRole("tab", { name: "Hablar" }).click();
  await page.getByRole("button", { name: "Simulacro IELTS" }).click();
  await page.getByRole("button", { name: "Empezar Part 1" }).click();
  const answer = "Well, I live in an apartment in Lima with my family and I really like it because it is close to my work.";
  for (let i = 0; i < 4; i++) {
    await page.locator("#ieltsAns").fill(answer);
    await page.getByRole("button", { name: i < 3 ? "Siguiente" : "Ir a la Part 2" }).click();
  }
  await expect(page.locator(".cue")).toBeVisible();
  await page.getByRole("button", { name: "Estoy listo" }).click();
  await expect(page.locator(".pill", { hasText: "Grabando" })).toBeVisible();
  await page.locator("#ieltsP2").fill(answer + " " + answer);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Terminar Part 2" }).click();
  for (let i = 0; i < 3; i++) {
    await page.locator("#ieltsAns").fill(answer);
    await page.getByRole("button", { name: i < 2 ? "Siguiente" : "Terminar examen" }).click();
  }
  await page.getByRole("button", { name: "Ver mi banda IELTS" }).click();
  await expect(page.getByTestId("ielts-result")).toContainText("6.5");
  await expect(page.getByTestId("ielts-result")).toContainText("Lexical Resource");
  expect(sent.part1).toHaveLength(4);
  expect(sent.part3).toHaveLength(3);
  expect(sent.part2.a).toContain("apartment");
  expect(Buffer.from(sent.audio, "base64").toString("ascii", 0, 4)).toBe("RIFF");
  await page.getByRole("tab", { name: "Hoy" }).click();
  await expect(page.locator(".ielts-chip")).toContainText("6.5");
});

test("liga: unirse con apodo y ver la clasificación", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/health", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ai: true, accessCodeRequired: false, leagues: true }) }));
  const view = me => ({ division: "Plata", divIndex: 1, week: "2026-10-05", nick: "Ana_Lima", last: "up", myRank: 2,
    rows: [{ rank: 1, nick: "Leo", xp: 120, me: false, zone: "up" }, { rank: 2, nick: "Ana_Lima", xp: me, me: true, zone: "up" }, { rank: 3, nick: "Sol", xp: 10, me: false, zone: "" }] });
  const calls = [];
  await page.route("**/api/league", route => {
    const b = route.request().postDataJSON();
    calls.push(b);
    if (b.action === "join") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ playerId: "abcdefabcdef", secret: "s3cr3t", ...view(0) }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(view(b.weekXP)) });
  });
  await onboard(page);
  await expect(page.getByTestId("league-chip")).toContainText("Únete a la liga semanal");
  await page.getByTestId("league-chip").click();
  await page.getByLabel("Tu apodo en la liga").fill("Ana_Lima");
  await page.getByRole("button", { name: "Unirme a la liga" }).click();
  await expect(page.getByTestId("league")).toContainText("Plata");
  await expect(page.getByTestId("league")).toContainText("Puesto 2 de 3");
  await expect(page.getByTestId("league")).toContainText("¡Subiste de división");
  await expect(page.locator(".board li.me")).toContainText("Ana_Lima (tú)");
  expect(calls[0]).toMatchObject({ action: "join", nickname: "Ana_Lima" });
  await page.getByRole("tab", { name: "Hoy" }).click();
  await expect(page.getByTestId("league-chip")).toContainText("Liga Plata");
  await expect(page.getByTestId("league-chip")).toContainText("Zona de ascenso");
});

test("recordatorios: activar desde Ajustes registra la suscripción", async ({ page }) => {
  await page.addInitScript(() => {
    const fakeSub = { toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } }), unsubscribe: async () => true };
    const reg = { pushManager: { getSubscription: async () => null, subscribe: async () => fakeSub } };
    Object.defineProperty(navigator, "serviceWorker", { value: { ready: Promise.resolve(reg), register: async () => reg, addEventListener() {}, controller: null }, configurable: true });
    window.PushManager = window.PushManager || function () {};
    window.Notification = Object.assign(function () {}, { permission: "default", requestPermission: async () => "granted" });
  });
  await mockApi(page);
  await page.route("**/api/health", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ai: true, accessCodeRequired: false, leagues: true, push: true, vapidPublicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" }) }));
  let sub;
  await page.route("**/api/push-subscribe", route => { sub = route.request().postDataJSON(); return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
  await onboard(page);
  await openSettings(page);
  await page.getByTestId("reminders").locator("select").selectOption("20");
  await page.getByTestId("reminders").getByRole("button", { name: "Activar" }).click();
  await expect(page.getByTestId("reminders")).toContainText("a las 20:00");
  expect(sub).toMatchObject({ action: "subscribe", hour: 20, subscription: { endpoint: "https://push.example/abc" } });
  expect(sub.tz).toBeTruthy();
});

test("una lectura con formato inválido no rompe la pantalla (usa la lectura base)", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/reading", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await onboard(page);
  await page.getByRole("tab", { name: "Escuchar y leer" }).click();
  await page.getByRole("button", { name: "Lectura" }).click();
  await expect(page.getByTestId("reading").locator(".para").first()).toBeVisible(); // lectura base del nivel
  await expect(page.getByText("Algo salió mal")).toHaveCount(0);
});

function wav(seconds) {
  const pcm = Buffer.alloc(24000 * 2 * seconds);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

test("botón de audio: se pone verde con barra de avance y usa la voz natural", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/tts", route => route.fulfill({ status: 200, contentType: "audio/wav", body: wav(3) }));
  await onboard(page);
  await page.getByRole("tab", { name: "Gramática" }).click();
  const btn = page.locator(".examples li").first().getByRole("button");
  await btn.click();
  await expect(btn).toHaveClass(/playing/);
  await expect(btn).toHaveAttribute("data-engine", "natural");
  await page.waitForTimeout(900);
  const p = await btn.evaluate(el => Number(getComputedStyle(el).getPropertyValue("--p")));
  expect(p).toBeGreaterThan(0.1);
  expect(await btn.evaluate(el => getComputedStyle(el).borderTopColor)).not.toBe(await page.locator(".examples li").nth(1).getByRole("button").evaluate(el => getComputedStyle(el).borderTopColor));
});

test("si la voz natural falla, avisa el motivo y Ajustes lo muestra", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/tts", route => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ code: "quota", error: "Se acabó la cuota gratuita de hoy del coach IA." }) }));
  await onboard(page);
  await page.getByRole("tab", { name: "Gramática" }).click();
  await page.locator(".examples li").first().getByRole("button").click();
  await expect(page.locator(".toast")).toContainText("Voz natural no disponible", { timeout: 15000 });
  await openSettings(page);
  await expect(page.getByRole("dialog")).toContainText("Se acabó la cuota gratuita");
});

test("En vivo: panel dedicado con modos, tema, voz y llamada", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/tts", route => route.fulfill({ status: 200, contentType: "audio/wav", body: wav(2) }));
  let tokenReq;
  await page.route("**/api/live-token", route => { tokenReq = route.request().postDataJSON(); return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "no_ai", error: "Prueba sin servidor real." }) }); });
  await onboard(page);
  await page.getByTestId("live-cta").click();
  await expect(page.getByRole("heading", { name: "Habla en vivo" })).toBeVisible();
  const setup = page.getByTestId("live-setup");
  await setup.getByRole("button", { name: /Profesor de speaking/ }).click();
  await setup.getByRole("button", { name: "Football" }).click();
  await setup.getByRole("button", { name: "Lento y claro" }).click();
  await setup.getByRole("button", { name: "Masculinas" }).click();
  await setup.getByRole("radio", { name: /Charon/ }).click();
  await expect(setup).toContainText("Charon · Informativo");
  const prev = setup.getByRole("button", { name: "Escuchar Charon" });
  await prev.click();
  await expect(setup.getByRole("button", { name: "Detener Charon" })).toHaveClass(/playing/);
  await page.getByRole("button", { name: "Iniciar llamada" }).click();
  await expect(page.locator(".err")).toContainText("Prueba sin servidor real.");
  expect(tokenReq).toMatchObject({ scenario: "tutor", topic: "Football", pace: "slow", correction: "now", voice: "Charon", level: expect.any(String) });
});

test("tema oscuro con selector y menú de usuario", async ({ page }) => {
  await mockApi(page);
  await onboard(page);
  const root = page.locator("html");
  await page.getByTestId("theme-toggle").click();
  await expect(root).toHaveAttribute("data-theme", /dark|light/);
  const first = await root.getAttribute("data-theme");
  const bg1 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByTestId("theme-toggle").click();
  await expect(root).not.toHaveAttribute("data-theme", first);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(bg1);
  // Menú de usuario: tema, uso, ayuda, cerrar sesión deshabilitado hasta tener cuentas
  await page.getByTestId("user-menu").click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByTestId("user-menu")).toContainText("A");
  await page.getByRole("menuitem", { name: /Tema/ }).click();
  await page.getByRole("menuitemradio", { name: "Oscuro" }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("logout")).toBeDisabled();
  await page.getByRole("menuitem", { name: /Mi uso/ }).click();
  await expect(page.getByTestId("usage")).toContainText("Consultas al coach");
  await page.getByTestId("usage").getByRole("button", { name: "Cerrar" }).click();
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: /Ayuda/ }).click();
  await expect(page.getByTestId("help")).toContainText("¿Puedo responder en español?");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+,");
  await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
});
