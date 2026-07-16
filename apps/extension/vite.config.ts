import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Popup build — outputs to dist/popup/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  root: "popup",
  build: {
    outDir: "../dist/popup",
    emptyOutDir: true,
  },
});
