import { useEffect, useRef } from "react";

/* Barras que se mueven con tu voz (verde) y la del coach (color de acento) durante la llamada. */
export default function LiveVisualizer({ getLevels, status }) {
  const canvas = useRef(null);
  const hist = useRef({ user: Array(32).fill(0), model: Array(32).fill(0) });
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const ctx = c.getContext("2d");
    let raf = 0;
    const css = name => getComputedStyle(c).getPropertyValue(name).trim() || "#0B7A63";
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const lv = getLevels ? getLevels() : { user: 0, model: 0 };
      const hs = hist.current;
      hs.user.push(lv.user); hs.user.shift();
      hs.model.push(lv.model); hs.model.shift();
      const n = hs.user.length, gap = 4, bw = Math.max(2, (w - gap * (n - 1)) / n);
      const accent = css("--accent"), good = css("--good"), line = css("--line");
      for (let i = 0; i < n; i++) {
        const u = hs.user[i], m = hs.model[i];
        const v = Math.max(u, m);
        const bh = Math.max(4, v * (h - 8));
        ctx.fillStyle = v < 0.02 ? line : m >= u ? accent : good;
        const x = i * (bw + gap), y = (h - bh) / 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, Math.min(bw / 2, 4)); else ctx.rect(x, y, bw, bh);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [getLevels, status]);
  return <canvas ref={canvas} className="live-viz" aria-hidden="true" />;
}
