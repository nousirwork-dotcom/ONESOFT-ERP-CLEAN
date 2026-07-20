import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

const BUILD_DATE      = new Date().toISOString().slice(0, 10);              // YYYY-MM-DD
const BUILD_DATE_ID   = BUILD_DATE.replace(/-/g, '');                       // YYYYMMDD
const BUILD_TIMESTAMP = String(Date.now());

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  root: __dirname,
  define: {
    __VITE_BUILD_DATE__:      JSON.stringify(BUILD_DATE),
    __VITE_BUILD_DATE_ID__:   JSON.stringify(BUILD_DATE_ID),
    __VITE_BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
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
