import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Popup build — outputs to dist/popup/
//
// Like the service worker build, `console.log` is stripped from production
// output; EXT_KEEP_LOGS=1 keeps it (set by the dev watcher).
const keepLogs = process.env.EXT_KEEP_LOGS === "1";

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
  base: './',
  plugins: [react(), tailwindcss(), ...(keepLogs ? [] : [stripConsoleLog()])],
  root: "popup",
  build: {
    outDir: "../dist/popup",
    emptyOutDir: true,
  },
});

