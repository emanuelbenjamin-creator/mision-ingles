import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/* En desarrollo, sirve las funciones de api/ igual que Vercel (lee GEMINI_API_KEY de .env). */
function devApi() {
  return {
    name: "dev-api",
    configureServer(server) {
      Object.assign(process.env, loadEnv("development", process.cwd(), ""));
      server.middlewares.use(async (req, res, next) => {
        const m = req.url && req.url.match(/^\/api\/([a-z-]+)(?:\?.*)?$/);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule("/api/[route].js");
          req.query = { route: m[1] };
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 404;
          res.end(JSON.stringify({ code: "not_found", error: String(e.message) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devApi(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Misión Inglés",
        short_name: "Misión Inglés",
        description: "Coach de inglés para hispanohablantes: misiones diarias, habla, pronunciación, conversación, gramática y repaso.",
        lang: "es",
        theme_color: "#0B7A63",
        background_color: "#F3F5F8",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: "CacheFirst", options: { cacheName: "fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
        ],
      },
    }),
  ],
  test: { include: ["tests/unit/**/*.test.js"], environment: "node" },
});
