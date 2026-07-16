To run the app, you will need to start the frontend and backend.
You should first build the Rust service and run it as an Administrator (cargo run --bin focus-service -- --console).
Then, you can run the Tauri desktop app in dev mode (cd apps/desktop; npm run tauri dev).
Installer Integration: The plan mentions a WiX installer for the service. A typical approach for Tauri is to include a WiX fragment in src-tauri/wix that registers the .exe of the focus-service as a Windows Service during installation. For v1, manually launching the service (as mentioned above) is sufficient for testing.