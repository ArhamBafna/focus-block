import { defineConfig } from "vite";

// Service worker build — outputs to dist/background/service-worker.js
export default defineConfig({
  build: {
    outDir: "dist/background",
    emptyOutDir: true,
    lib: {
      entry: "background/service-worker.ts",
      name: "ServiceWorker",
      fileName: "service-worker",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "service-worker.js",
      },
    },
    target: "es2022",
    minify: false, // easier to debug
  },
});
