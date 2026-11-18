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
          const buffer = Buffer.alloc(2);
          const fd = fs.openSync(src, 'r');
          try {
            fs.readSync(fd, buffer, 0, 2, 0);
            if (buffer[0] === 0x4d && buffer[1] === 0x5a) { // 'MZ'
              fs.copyFileSync(src, dest);
            } else {
              console.warn(`[prepare-bundle] ${src} does not appear to be a valid PE executable`);
            }
          } finally {
            fs.closeSync(fd);
          }
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
