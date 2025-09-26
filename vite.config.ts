import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  plugins: [react()],
  // важливо для WebLLM: не предбандлити пакет, щоб уникнути дублю класів у воркері
  optimizeDeps: {
    exclude: ["@mlc-ai/web-llm"],
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    target: "esnext", // сучасні браузери, ок для WebGPU/wasm
  },
});


