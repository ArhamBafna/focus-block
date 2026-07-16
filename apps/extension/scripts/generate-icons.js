/**
 * Simple icon generator — creates PNG icons at 16, 48, 128px
 * using the Canvas API (Node.js via canvas package, or just generate manually).
 *
 * Run: node scripts/generate-icons.js
 *
 * Alternatively, just drop your own PNG files into icons/ named:
 *   icon16.png, icon48.png, icon128.png
 */

import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "icons");
mkdirSync(iconsDir, { recursive: true });

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background circle — fathom (teal)
  ctx.fillStyle = "#034f46";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Shield shape — lumen (cream)
  ctx.fillStyle = "#ffffeb";
  const s = size * 0.55;
  const x = (size - s) / 2;
  const y = (size - s) / 2;

  ctx.beginPath();
  // Simple shield polygon
  ctx.moveTo(x + s / 2, y);
  ctx.lineTo(x + s, y + s * 0.3);
  ctx.lineTo(x + s, y + s * 0.6);
  ctx.quadraticCurveTo(x + s, y + s, x + s / 2, y + s);
  ctx.quadraticCurveTo(x, y + s, x, y + s * 0.6);
  ctx.lineTo(x, y + s * 0.3);
  ctx.closePath();
  ctx.fill();

  writeFileSync(join(iconsDir, `icon${size}.png`), canvas.toBuffer("image/png"));
  console.log(`Generated icon${size}.png`);
}

[16, 48, 128].forEach(generateIcon);
