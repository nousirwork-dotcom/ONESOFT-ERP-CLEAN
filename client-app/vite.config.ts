import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ── Build metadata — computed ONCE at Vite startup (dev) or build time (prod) ──
const BUILD_DATE      = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
const BUILD_DATE_ID   = BUILD_DATE.replace(/-/g, "");            // YYYYMMDD
const BUILD_TIMESTAMP = String(Date.now());

function getCommitSha(): string {
  try { return execSync("git rev-parse --short HEAD", { encoding: "utf8", timeout: 5000 }).trim(); }
  catch { return "unknown"; }
}
const BUILD_COMMIT     = getCommitSha();
// Include the build timestamp so a dev restart cannot reuse a Service Worker
// cache created by an older uncommitted frontend source tree.
const BUILD_CACHE_NAME = `onesoft-erp-${BUILD_DATE_ID}-${BUILD_COMMIT}-${BUILD_TIMESTAMP}`;

// ── Plugin: inject SW cache name into public/sw.js ────────────────────────────
const swCachePlugin = {
  name: "sw-cache-name",

  // Dev mode: intercept /sw.js requests and inject cache name
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url: string = (req.url ?? "").split("?")[0];
      if (url === "/sw.js") {
        const swPath = path.join(__dirname, "public", "sw.js");
        if (existsSync(swPath)) {
          const content = readFileSync(swPath, "utf-8").replace("__SW_CACHE_NAME__", BUILD_CACHE_NAME);
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.end(content);
          return;
        }
      }
      next();
    });
  },

  // Build mode: replace placeholder in dist/sw.js after bundle is written
  closeBundle() {
    const swPath = path.join(__dirname, "dist", "sw.js");
    if (existsSync(swPath)) {
      const content = readFileSync(swPath, "utf-8");
      writeFileSync(swPath, content.replace("__SW_CACHE_NAME__", BUILD_CACHE_NAME));
      console.log(`\n[sw-cache-name] ✅ Cache name injected: ${BUILD_CACHE_NAME}`);
    }
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), swCachePlugin],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  root: __dirname,
  define: {
    __VITE_BUILD_DATE__:       JSON.stringify(BUILD_DATE),
    __VITE_BUILD_DATE_ID__:    JSON.stringify(BUILD_DATE_ID),
    __VITE_BUILD_TIMESTAMP__:  JSON.stringify(BUILD_TIMESTAMP),
    __VITE_BUILD_COMMIT__:     JSON.stringify(BUILD_COMMIT),
    __VITE_BUILD_CACHE_NAME__: JSON.stringify(BUILD_CACHE_NAME),
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
  },
  server: {
    port: 5000,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        secure: false,
        changeOrigin: true,
      },
      "/download": {
        target: "http://localhost:3000",
        secure: false,
        changeOrigin: true,
      },
    },
  },
});
