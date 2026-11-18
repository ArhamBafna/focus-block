fn main() {
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let bundle_bins = std::path::Path::new(&manifest_dir).join("bundle_bins");
        let release_dir = std::path::Path::new(&manifest_dir).join("../../../target/release");
        let _ = std::fs::create_dir_all(&bundle_bins);

        for name in ["focus-service.exe", "focus-native-host.exe"] {
            let bundle_file = bundle_bins.join(name);
            let release_file = release_dir.join(name);

            println!("cargo:rerun-if-changed={}", release_file.display());

            // If real release binary exists, sync it to bundle_bins
            if let Ok(meta) = release_file.metadata() {
                if meta.is_file() && meta.len() > 1024 {
                    let _ = std::fs::copy(&release_file, &bundle_file);
                    continue;
                }
            }

            // Otherwise ensure a placeholder exists inside bundle_bins ONLY (never touching target/release)
            if !bundle_file.exists() {
                let _ = std::fs::write(&bundle_file, b"");
            }
        }
    }
    tauri_build::build()
}
