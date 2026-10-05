/* Reglas de bandas IELTS (compartidas por la app y el servidor). */

/** Una banda de criterio: entre 0 y 9, en pasos de 0.5. */
export const clampBand = x => { const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(9, Math.round(n * 2) / 2)) : null; };

/**
 * Banda global oficial: promedio de los 4 criterios redondeado a la media banda más cercana;
 * .25 sube a .5 y .75 sube al entero siguiente (6.25 → 6.5, 6.75 → 7, 6.125 → 6).
 */
export function ieltsOverall({ fc, lr, gra, p }) {
  const vals = [fc, lr, gra, p].map(clampBand);
  if (vals.some(v => v == null)) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / 4;
  return Math.round(mean * 2 + 1e-9) / 2;
}
