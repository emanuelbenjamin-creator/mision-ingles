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

test("primer uso: prueba de nivel y panel", async ({ page }) => {
  await mockApi(page);
  await onboard(page);
  await expect(page.locator(".mission")).toHaveCount(5);
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
