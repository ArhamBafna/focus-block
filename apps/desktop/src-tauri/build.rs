fn main() {
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let release_dir = std::path::Path::new(&manifest_dir).join("../../../target/release");
        let _ = std::fs::create_dir_all(&release_dir);
        for name in ["focus-service.exe", "focus-native-host.exe"] {
            let file = release_dir.join(name);
            if !file.exists() {
                let _ = std::fs::write(&file, b"");
            }
        }
    }
    tauri_build::build()
}
