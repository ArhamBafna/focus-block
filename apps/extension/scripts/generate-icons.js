/**
 * Icon generator — creates the Focus Blocker brand icons at 16/48/128 px
 * from the Wispr Flow design tokens (see DESIGN.md and popup/App.css):
 *   fathom #034f46 (teal) background, lumen #ffffeb (cream) shield,
 *   dawn #f0d7ff accent check.
 *
 * Requires the `canvas` devDependency (declared in package.json):
 *   npm install
 *   npm run icons
 *
 * Output overwrites icons/icon16.png, icon48.png, icon128.png — commit them.
 */

import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "icons");
mkdirSync(iconsDir, { recursive: true });

// ── Design tokens ─────────────────────────────────────────────────────────────
const COLOR_BG = "#034f46"; // fathom — teal surface
const COLOR_SHIELD = "#ffffeb"; // lumen — cream silhouette
const COLOR_CHECK = "#034f46"; // fathom again, punched into the shield

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const u = size / 128; // design grid unit

  // Background: full-bleed rounded square (crisper than a circle at tiny sizes)
  const radius = 28 * u;
  ctx.fillStyle = COLOR_BG;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fill();

  // Shield silhouette — oversized for legibility at 16px
  const s = 84 * u; // shield bounding box
  const x = (size - s) / 2;
  const y = 22 * u;

  ctx.fillStyle = COLOR_SHIELD;
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y);
  ctx.lineTo(x + s, y + s * 0.26);
  ctx.lineTo(x + s, y + s * 0.58);
  ctx.quadraticCurveTo(x + s, y + s * 0.86, x + s / 2, y + s);
  ctx.quadraticCurveTo(x, y + s * 0.86, x, y + s * 0.58);
  ctx.lineTo(x, y + s * 0.26);
  ctx.closePath();
  ctx.fill();

  // Check mark inside the shield
  ctx.strokeStyle = COLOR_CHECK;
  ctx.lineWidth = Math.max(1.5, 11 * u);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + s * 0.28, y + s * 0.5);
  ctx.lineTo(x + s * 0.45, y + s * 0.66);
  ctx.lineTo(x + s * 0.74, y + s * 0.32);
  ctx.stroke();

  return canvas;
}

for (const size of [16, 48, 128]) {
  const file = join(iconsDir, `icon${size}.png`);
  writeFileSync(file, drawIcon(size).toBuffer("image/png"));
  console.log(`Generated icon${size}.png`);
}
