//! Packages the helper executables (service + native messaging host) so Tauri's
//! bundler can copy them next to the app.
//!
//! Important: Tauri copies every `bundle_bins/*` file over `target/<profile>/*`
//! on *every* build. If we only ever left an empty placeholder here, a dev build
//! would replace a perfectly good `focus-native-host.exe` with a 0-byte file and
//! Chrome's native messaging bridge would silently stop working. So we mirror the
//! real binary for the profile being built whenever one exists.

use std::path::{Path, PathBuf};

fn looks_like_windows_exe(path: &Path) -> bool {
    let Ok(meta) = path.metadata() else {
        return false;
    };
    if !meta.is_file() || meta.len() <= 1024 {
        return false;
    }
    let Ok(mut file) = std::fs::File::open(path) else {
        return false;
    };
    use std::io::Read;
    let mut header = [0u8; 2];
    file.read_exact(&mut header).is_ok() && header == *b"MZ"
}

fn copy_over(source: &Path, dest: &Path) -> bool {
    // Best effort: a running binary may be locked. Never fail the build for it.
    std::fs::copy(source, dest).is_ok()
}

fn main() {
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let manifest_dir = PathBuf::from(manifest_dir);
        let bundle_bins = manifest_dir.join("bundle_bins");
        let target_dir = manifest_dir.join("../../../target");
        let _ = std::fs::create_dir_all(&bundle_bins);

        // Dev builds should ship the debug helpers, release builds the release
        // ones, so the files Tauri writes back into target/<profile> stay in
        // sync with the binaries that were just compiled.
        let is_release = std::env::var("PROFILE")
            .map(|profile| profile == "release")
            .unwrap_or(false);
        let (preferred_dir, fallback_dir) = if is_release {
            (target_dir.join("release"), target_dir.join("debug"))
        } else {
            (target_dir.join("debug"), target_dir.join("release"))
        };

        for name in ["focus-service.exe", "focus-native-host.exe"] {
            let bundle_file = bundle_bins.join(name);
            let preferred = preferred_dir.join(name);
            let fallback = fallback_dir.join(name);

            println!("cargo:rerun-if-changed={}", preferred.display());
            println!("cargo:rerun-if-changed={}", fallback.display());

            if looks_like_windows_exe(&preferred) {
                copy_over(&preferred, &bundle_file);
            } else if !looks_like_windows_exe(&bundle_file) && looks_like_windows_exe(&fallback) {
                copy_over(&fallback, &bundle_file);
            } else if !bundle_file.exists() {
                // Last resort on non-Windows hosts / clean checkouts: Tauri only
                // requires the resource path to exist.
                let _ = std::fs::write(&bundle_file, b"");
            }
        }
    }
    tauri_build::build()
}
