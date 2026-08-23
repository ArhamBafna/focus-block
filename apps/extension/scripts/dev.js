/**
 * Windows-safe dev watcher: runs the popup and service-worker builds
 * concurrently. `cmd` cannot background processes with a bare `&`, so this
 * Node script owns both child processes, pipes their output, and tears both
 * down on Ctrl+C.
 *
 * Sets EXT_KEEP_LOGS=1 for the children so dev bundles keep console logging.
 *
 * Run: npm run dev
 */

import { spawn } from "child_process";

const children = [];

function start(label, args) {
  const child = spawn("npx", args, {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, EXT_KEEP_LOGS: "1" },
  });

  const tag = (chunk) =>
    chunk
      .toString()
      .split("\n")
      .filter(Boolean)
      .map((line) => `[${label}] ${line}`)
      .join("\n");

  child.stdout.on("data", (chunk) => process.stdout.write(tag(chunk) + "\n"));
  child.stderr.on("data", (chunk) => process.stderr.write(tag(chunk) + "\n"));
  child.on("exit", (code) => {
    if (code !== null && code !== 0 && !shuttingDown) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });

  children.push(child);
  return child;
}

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      if (process.platform === "win32") {
        // child.pid is the cmd.exe wrapper; /T takes down vite with it.
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill();
      }
    } catch {
      // already gone
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start("popup", ["vite", "build", "--config", "vite.config.ts", "--watch"]);
start("worker", ["vite", "build", "--config", "vite.config.bg.ts", "--watch"]);

console.log("Dev watchers running (popup + worker). Press Ctrl+C to stop.");
