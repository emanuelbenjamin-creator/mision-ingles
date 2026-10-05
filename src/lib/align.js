export const words = t => (String(t || "").toLowerCase().match(/[a-z']+/g) || []);

/**
 * Compara la frase objetivo con lo que reconoció el dictado (LCS por palabras).
 * Devuelve el % de palabras reconocidas y cada palabra marcada como ok / miss.
 */
export function alignWords(target, said) {
  const t = words(target), s = words(said);
  const dp = Array.from({ length: t.length + 1 }, () => Array(s.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--)
    for (let j = s.length - 1; j >= 0; j--)
      dp[i][j] = t[i] === s[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Set();
  let i = 0, j = 0;
  while (i < t.length && j < s.length) {
    if (t[i] === s[j]) { ok.add(i); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  let wi = 0;
  const tokens = String(target).split(/\s+/).filter(Boolean).map(text => {
    if (!/[a-z]/i.test(text)) return { text, status: "plain" };
    const status = ok.has(wi) ? "ok" : "miss";
    wi++;
    return { text, status };
  });
  return { score: t.length ? Math.round(ok.size / t.length * 100) : 0, tokens };
}
