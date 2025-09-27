import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  // якщо деплоїш на GitHub Pages, лишай base з назвою репо; локально — не критично
  // base: "/admin-buddy-dk/",
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@mlc-ai/web-llm"],
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { target: "esnext" },
});



