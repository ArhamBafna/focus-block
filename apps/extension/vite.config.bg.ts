import { defineConfig, type Plugin } from "vite";

// Service worker build — outputs to dist/background/service-worker.js
//
// Production builds strip `console.log` calls (debug noise) while keeping
// console.warn/error so operational failures stay visible. Set
// EXT_KEEP_LOGS=1 to keep every log — the dev watcher does this.
const keepLogs = process.env.EXT_KEEP_LOGS === "1";

/** Replace console.log( calls with a no-op function call in rendered output. */
function stripConsoleLog(): Plugin {
  return {
    name: "strip-console-log",
    enforce: "post",
    apply: "build",
    renderChunk(code) {
      if (keepLogs || !code.includes("console.log(")) return null;
      return code.replace(/\bconsole\.log\s*\(/g, "(() => {})(");
    },
  };
}

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
      plugins: keepLogs ? [] : [stripConsoleLog()],
    },
    target: "es2022",
    minify: false, // easier to debug
  },
});
