import { useState } from "react";
import { checkCode } from "../lib/api.js";

/**
 * Pide el código de acceso al coach IA una sola vez por dispositivo. Lo comprueba con el servidor
 * antes de guardarlo, así un código mal escrito se nota aquí y no en la primera consulta.
 */
export default function AccessCode({ onOk, wrong = false }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async e => {
    e.preventDefault();
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true); setErr("");
    const ok = await checkCode(c);
    setBusy(false);
    if (ok) onOk(c);
    else setErr(ok === false ? "Ese código no es correcto. Revísalo con quien administra la app." : "Sin conexión con el servidor. Inténtalo otra vez.");
  };
  return (
    <div className="access" data-testid="access-code">
      <b>{wrong ? "El código de acceso guardado ya no es válido" : "Activa el coach IA en este dispositivo"}</b>
      <span className="small muted">Escribe el código una vez: queda guardado aquí y no se vuelve a pedir. Mientras tanto la app funciona en modo básico.</span>
      <form onSubmit={submit}>
        <input type="text" value={code} onChange={e => setCode(e.target.value)} aria-label="Código de acceso" placeholder="Código de acceso" autoComplete="off" autoCapitalize="off" spellCheck="false" />
        <button type="submit" className="btn" disabled={busy || !code.trim()}>{busy ? "Comprobando…" : "Activar"}</button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
