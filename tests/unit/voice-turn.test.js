import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import voiceTurn from "../../api/_routes/voice-turn.js";
import { _setGenerator } from "../../api/_lib/gemini.js";
import { _resetRateLimit } from "../../api/_lib/http.js";

function call(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST"; req.headers = { "x-forwarded-for": "10.0.0.7" };
  return new Promise(resolve => {
    const res = { statusCode: 200, setHeader() {}, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}

let seen;
beforeEach(() => { _resetRateLimit(); seen = null; _setGenerator(async x => { seen = x; return "**Great!** 😀 What did you do on Saturday?"; }); });
afterEach(() => _setGenerator(null));

describe("/api/voice-turn (modo de voz económico)", () => {
  it("el coach abre la llamada sin turnos y responde texto limpio para leer en voz alta", async () => {
    const r = await call(voiceTurn, { scenario: "free", topic: "My weekend", level: "A2" });
    expect(r.status).toBe(200);
    expect(r.body.reply).not.toMatch(/\*|😀/);
    expect(r.body.reply).toContain("What did you do on Saturday?");
    expect(seen.json).toBe(false);
    expect(seen.system).toMatch(/spoken conversation/);
    expect(seen.contents).toHaveLength(1);
  });

  it("envía el historial y exige que el último turno sea del alumno", async () => {
    const turns = [{ role: "model", text: "Hi! How are you?" }, { role: "user", text: "Yo estoy bien, gracias" }];
    const r = await call(voiceTurn, { scenario: "tutor", level: "B1", turns });
    expect(r.status).toBe(200);
    expect(seen.contents.map(c => c.role)).toEqual(["user", "model", "user"]);
    expect(seen.contents.at(-1).text).toBe("Yo estoy bien, gracias");
    const bad = await call(voiceTurn, { scenario: "free", turns: [{ role: "model", text: "Hi" }] });
    expect(bad.status).toBe(400);
  });
});
