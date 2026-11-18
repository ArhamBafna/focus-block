import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, '..');
const bundleBinsDir = path.join(desktopDir, 'src-tauri', 'bundle_bins');
const releaseDir = path.resolve(desktopDir, '../../target/release');

fs.mkdirSync(bundleBinsDir, { recursive: true });

const binaries = ['focus-service.exe', 'focus-native-host.exe'];

if (process.platform === 'win32') {
  for (const bin of binaries) {
    const src = path.join(releaseDir, bin);
    const dest = path.join(bundleBinsDir, bin);
    if (fs.existsSync(src)) {
      try {
        const stat = fs.statSync(src);
        if (stat.isFile() && stat.size > 1024) {
          fs.copyFileSync(src, dest);
        }
      } catch (err) {
        console.warn(`[prepare-bundle] Failed to copy ${src} to ${dest}:`, err);
      }
    }
  }
}

// Ensure placeholders exist so Tauri resource bundle checks succeed on all platforms
for (const bin of binaries) {
  const dest = path.join(bundleBinsDir, bin);
  if (!fs.existsSync(dest)) {
    try {
      fs.writeFileSync(dest, '');
    } catch (err) {
      console.warn(`[prepare-bundle] Failed to create placeholder for ${dest}:`, err);
    }
  }
}
