/**
 * Post-build script: assembles the final extension dist/ folder.
 *
 * After running:
 *   npm run build:popup  → dist/popup/
 *   npm run build:bg     → dist/background/
 *
 * This script copies static files (manifest, blocked/, icons/) into dist/
 * so the final dist/ is a complete, loadable Chrome extension.
 *
 * Run: node scripts/assemble.js
 */

import { cpSync, mkdirSync, copyFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy manifest.json to dist root
copyFileSync(join(root, "manifest.json"), join(dist, "manifest.json"));
console.log("✓ manifest.json");

// 2. Copy blocked/ page
copyDir(join(root, "blocked"), join(dist, "blocked"));
console.log("✓ blocked/");

// 3. Copy icons/
try {
  copyDir(join(root, "icons"), join(dist, "icons"));
  console.log("✓ icons/");
} catch {
  console.warn("⚠ icons/ not found — run scripts/generate-icons.js or add PNGs manually");
}

console.log("\n✅ Extension assembled at dist/");
console.log("   Load dist/ as an unpacked extension in chrome://extensions");
