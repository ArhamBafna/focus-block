/**
 * Packages dist/ into a Chrome Web Store upload zip.
 *
 * Run AFTER a fresh `npm run build`. The zip contains only the runtime files
 * already assembled in dist/ (manifest.json at the zip root, popup/,
 * background/, blocked/, icons/, fonts/) — no source, no node_modules,
 * no maps, no repo docs.
 *
 * Output: releases/focus-blocker-v<version>.zip (version read from manifest).
 *
 * Run: npm run package
 */

import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");
const releases = join(root, "releases");

if (!existsSync(join(dist, "manifest.json"))) {
  console.error("dist/manifest.json not found. Run `npm run build` first.");
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
mkdirSync(releases, { recursive: true });
const out = join(releases, `focus-blocker-v${version}.zip`);
rmSync(out, { force: true });

function fileCount(dir) {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) count += fileCount(p);
    else count += 1;
  }
  return count;
}

if (process.platform === "win32") {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path "${dist}\\*" -DestinationPath "${out}" -Force`,
    ],
    { stdio: "inherit" }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  const result = spawnSync("zip", ["-r", out, "."], { cwd: dist, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n✅ Packaged ${fileCount(dist)} files -> ${out}`);
console.log("   Upload this zip in the Chrome Developer Dashboard.");
