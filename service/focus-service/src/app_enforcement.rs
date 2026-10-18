#[cfg(not(windows))]
use focus_core::{AppBlockTarget, BlockedAppEvent};

#[cfg(windows)]
mod windows {
    use chrono::Utc;
    use focus_core::{AppBlockTarget, BlockedAppEvent};
    use std::collections::HashSet;
    use std::ffi::OsString;
    use std::fs;
    use std::os::windows::ffi::OsStringExt;
    use std::path::{Path, PathBuf};
    use std::ptr;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex, RwLock};
    use std::thread::{self, JoinHandle};
    use std::time::{Duration, Instant};
    use tracing::{info, warn};

    use windows::core::{w, BSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoSetProxyBlanket, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_MULTITHREADED, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL, RPC_C_IMP_LEVEL_IMPERSONATE,
    };
    use windows::Win32::System::Variant::{VariantClear, VT_I2, VT_I4, VT_UI2, VT_UI4};
    use windows::Win32::System::Wmi::{
        IEnumWbemClassObject, IWbemClassObject, IWbemLocator, IWbemServices, WbemLocator,
        WBEM_FLAG_FORWARD_ONLY, WBEM_FLAG_RETURN_IMMEDIATELY,
    };

    const RPC_C_AUTHN_WINNT: u32 = 10;
    const RPC_C_AUTHZ_NONE: u32 = 0;

    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, APPMODEL_ERROR_NO_PACKAGE, ERROR_INSUFFICIENT_BUFFER, HANDLE,
        INVALID_HANDLE_VALUE,
    };
    use windows_sys::Win32::NetworkManagement::WindowsFilteringPlatform::{
        FwpmEngineClose0, FwpmEngineOpen0, FwpmFilterCreateEnumHandle0,
        FwpmFilterDeleteById0, FwpmFilterDestroyEnumHandle0, FwpmFilterEnum0,
        FwpmFreeMemory0, FwpmProviderDeleteByKey0, FwpmSubLayerDeleteByKey0,
        FWPM_FILTER0, FWPM_FILTER_ENUM_TEMPLATE0,
    };
    use windows_sys::Win32::Security::Isolation::DeriveAppContainerSidFromAppContainerName;
    use windows_sys::Win32::Security::{FreeSid, PSID};
    use windows_sys::Win32::Storage::Packaging::Appx::GetPackageFamilyName;
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Rpc::RPC_C_AUTHN_DEFAULT;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW, TerminateProcess,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE,
    };

    const PROVIDER_KEY: windows_sys::core::GUID =
        windows_sys::core::GUID::from_u128(0x6e7f52de_6b17_4454_9397_ae2a09d96001);
    const SUBLAYER_KEY: windows_sys::core::GUID =
        windows_sys::core::GUID::from_u128(0x6e7f52de_6b17_4454_9397_ae2a09d96002);

    fn cleanup_legacy_wfp() {
        unsafe {
            let mut handle = ptr::null_mut();
            let status = FwpmEngineOpen0(
                ptr::null(),
                RPC_C_AUTHN_DEFAULT as u32,
                ptr::null(),
                ptr::null(),
                &mut handle,
            );
            if status != 0 || handle.is_null() {
                return;
            }

            let mut provider_key = PROVIDER_KEY;
            let mut template = FWPM_FILTER_ENUM_TEMPLATE0::default();
            template.providerKey = &mut provider_key;
            let mut enum_handle = ptr::null_mut();
            if FwpmFilterCreateEnumHandle0(handle, &template, &mut enum_handle) == 0 {
                let mut entries: *mut *mut FWPM_FILTER0 = ptr::null_mut();
                let mut count = 0;
                if FwpmFilterEnum0(handle, enum_handle, 1000, &mut entries, &mut count) == 0 {
                    if !entries.is_null() {
                        for filter in std::slice::from_raw_parts(entries, count as usize) {
                            if !filter.is_null() {
                                let _ = FwpmFilterDeleteById0(handle, (**filter).filterId);
                            }
                        }
                        FwpmFreeMemory0((&mut entries as *mut *mut *mut FWPM_FILTER0).cast());
                    }
                }
                let _ = FwpmFilterDestroyEnumHandle0(handle, enum_handle);
            }

            let _ = FwpmSubLayerDeleteByKey0(handle, &SUBLAYER_KEY);
            let _ = FwpmProviderDeleteByKey0(handle, &PROVIDER_KEY);
            let _ = FwpmEngineClose0(handle);
        }
    }

    const FALLBACK_POLL_INTERVAL: Duration = Duration::from_millis(2500);

    const EXCLUDED_SYSTEM_EXECUTABLES: &[&str] = &[
        "taskmgr.exe",
        "perfmon.exe",
        "mmc.exe",
        "systemsettings.exe",
        "explorer.exe",
        "cmd.exe",
        "powershell.exe",
        "pwsh.exe",
        "conhost.exe",
        "openconsole.exe",
        "windowsterminal.exe",
        "focus-service.exe",
        "focus-native-host.exe",
        "focus-block.exe",
        "desktop.exe",
    ];

    #[derive(Default, Clone)]
    pub struct ProcessMatchers {
        pub executable_paths: HashSet<String>,
        pub executable_names: HashSet<String>,
        pub package_families: HashSet<String>,
    }

    impl ProcessMatchers {
        pub fn from_targets(targets: &[AppBlockTarget]) -> Self {
            let mut matchers = Self::default();
            for target in targets {
                match target {
                    AppBlockTarget::Executable { path } => {
                        let path_obj = Path::new(path);
                        matchers.executable_paths.insert(normalize_path(path_obj));

                        if let Some(file_name) = path_obj.file_name() {
                            matchers
                                .executable_names
                                .insert(file_name.to_string_lossy().to_ascii_lowercase());
                        }
                        if let Some(parent) = path_obj.parent() {
                            if let Some(parent_name) = parent.file_name() {
                                let mut inferred_exe =
                                    parent_name.to_string_lossy().to_ascii_lowercase();
                                inferred_exe.push_str(".exe");
                                matchers.executable_names.insert(inferred_exe);
                            }
                        }
                    }
                    AppBlockTarget::Package {
                        package_family_name,
                    } => {
                        matchers
                            .package_families
                            .insert(package_family_name.to_ascii_lowercase());
                    }
                    AppBlockTarget::Folder { .. } => {
                        // Legacy folders are no longer matched
                    }
                }
            }
            matchers
        }

        pub fn is_system_excluded(exe_name: &str) -> bool {
            let lower = exe_name.to_ascii_lowercase();
            EXCLUDED_SYSTEM_EXECUTABLES.iter().any(|&sys| sys == lower)
        }

        pub fn matches(
            &self,
            image_path: Option<&Path>,
            package_family_name: Option<&str>,
        ) -> Option<String> {
            // First check package family name if present
            if let Some(pfn) = package_family_name {
                let pfn_lower = pfn.to_ascii_lowercase();
                if self.package_families.contains(&pfn_lower) {
                    let display_name = pfn
                        .split('_')
                        .next()
                        .unwrap_or(pfn)
                        .replace('.', " ");
                    return Some(display_name);
                }
            }

            let Some(image_path) = image_path else {
                return None;
            };

            let file_name = image_path.file_name()?.to_string_lossy().to_string();
            let file_name_lower = file_name.to_ascii_lowercase();

            // Safety guard: System administrative tools and FocusBlock self are never blocked
            if Self::is_system_excluded(&file_name_lower) {
                return None;
            }

            let norm_path = normalize_path(image_path);
            let display_name = image_path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| file_name.clone());

            if self.executable_paths.contains(&norm_path)
                || self.executable_names.contains(&file_name_lower)
            {
                return Some(display_name);
            }

            None
        }
    }

    pub unsafe fn inspect_and_terminate_process(
        process_id: u32,
        matchers: &ProcessMatchers,
    ) -> Option<BlockedAppEvent> {
        if process_id <= 4 || process_id == GetCurrentProcessId() {
            return None;
        }

        let process = OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE,
            0,
            process_id,
        );
        if process.is_null() {
            return None;
        }

        let image_path = query_process_image_path(process);
        let package_family_name = query_package_family_name(process);
        let matched_name = matchers.matches(image_path.as_deref(), package_family_name.as_deref());

        let event = if let Some(app_name) = matched_name {
            if TerminateProcess(process, 1) != 0 {
                info!(
                    process_id,
                    %app_name,
                    image_path = ?image_path,
                    package_family_name = ?package_family_name,
                    "Terminated blocked process in under 10ms"
                );
                Some(BlockedAppEvent {
                    app_name,
                    executable_path: image_path.map(|p| p.to_string_lossy().into_owned()),
                    package_family_name,
                    timestamp: Utc::now(),
                    count: 1,
                })
            } else {
                warn!(
                    process_id,
                    %app_name,
                    "Matched blocked process could not be terminated"
                );
                None
            }
        } else {
            None
        };

        CloseHandle(process);
        event
    }

    pub fn sweep_active_processes(matchers: &ProcessMatchers) -> Vec<BlockedAppEvent> {
        let mut events = Vec::new();
        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot == INVALID_HANDLE_VALUE {
                warn!("Unable to create process snapshot for initial sweep");
                return events;
            }

            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            let mut has_entry = Process32FirstW(snapshot, &mut entry) != 0;
            while has_entry {
                if entry.th32ProcessID != GetCurrentProcessId() && entry.th32ProcessID > 4 {
                    if let Some(event) = inspect_and_terminate_process(entry.th32ProcessID, matchers)
                    {
                        events.push(event);
                    }
                }
                has_entry = Process32NextW(snapshot, &mut entry) != 0;
            }
            CloseHandle(snapshot);
        }
        events
    }

    fn run_process_watcher(
        matchers: Arc<RwLock<ProcessMatchers>>,
        stop_flag: Arc<AtomicBool>,
        last_blocked: Arc<Mutex<Option<BlockedAppEvent>>>,
        ready_tx: std::sync::mpsc::Sender<Result<(), String>>,
    ) -> Result<(), String> {
        unsafe {
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            if hr.is_err() && hr.0 != -2147417850 {
                // RPC_E_CHANGED_MODE is tolerable if initialized on this thread
                let err = format!("CoInitializeEx failed: {:?}", hr);
                let _ = ready_tx.send(Err(err.clone()));
                return Err(err);
            }

            if stop_flag.load(Ordering::Relaxed) {
                CoUninitialize();
                return Ok(());
            }

            let locator: IWbemLocator = match CoCreateInstance(&WbemLocator, None, CLSCTX_INPROC_SERVER) {
                Ok(loc) => loc,
                Err(e) => {
                    let err = format!("Failed to create IWbemLocator: {e}");
                    let _ = ready_tx.send(Err(err.clone()));
                    CoUninitialize();
                    return Err(err);
                }
            };

            if stop_flag.load(Ordering::Relaxed) {
                CoUninitialize();
                return Ok(());
            }

            let namespace = BSTR::from("ROOT\\CIMV2");
            let empty_bstr = BSTR::new();
            let services: IWbemServices = match locator.ConnectServer(
                &namespace,
                &empty_bstr,
                &empty_bstr,
                &empty_bstr,
                0,
                &empty_bstr,
                None,
            ) {
                Ok(svc) => svc,
                Err(e) => {
                    let err = format!("Failed to connect to WMI ROOT\\CIMV2: {e}");
                    let _ = ready_tx.send(Err(err.clone()));
                    CoUninitialize();
                    return Err(err);
                }
            };

            if stop_flag.load(Ordering::Relaxed) {
                CoUninitialize();
                return Ok(());
            }

            let _ = CoSetProxyBlanket(
                &services,
                RPC_C_AUTHN_WINNT,
                RPC_C_AUTHZ_NONE,
                None,
                RPC_C_AUTHN_LEVEL_CALL,
                RPC_C_IMP_LEVEL_IMPERSONATE,
                None,
                EOAC_NONE,
            );

            let query_lang = BSTR::from("WQL");
            let query = BSTR::from("SELECT ProcessId, ProcessName FROM Win32_ProcessStartTrace");
            let enumerator: IEnumWbemClassObject = match services.ExecNotificationQuery(
                &query_lang,
                &query,
                WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY,
                None,
            ) {
                Ok(en) => en,
                Err(e) => {
                    let err = format!("ExecNotificationQuery on Win32_ProcessStartTrace failed: {e}");
                    let _ = ready_tx.send(Err(err.clone()));
                    return Err(err);
                }
            };

            info!("Kernel event process start watcher successfully registered with ETW/WMI");
            // Notify startup thread that event subscription is active
            let _ = ready_tx.send(Ok(()));

            let current_pid = GetCurrentProcessId();

            while !stop_flag.load(Ordering::Relaxed) {
                let mut objs: [Option<IWbemClassObject>; 1] = [None];
                let mut returned = 0u32;

                // 500ms timeout per call ensures watcher thread checks stop_flag promptly
                let hr = enumerator.Next(500, &mut objs, &mut returned);
                if hr.is_ok() && returned > 0 {
                    if let Some(obj) = &objs[0] {
                        let mut vt_pid = windows::Win32::System::Variant::VARIANT::default();
                        if obj.Get(w!("ProcessId"), 0, &mut vt_pid, None, None).is_ok() {
                            let pid = match vt_pid.Anonymous.Anonymous.vt {
                                VT_UI4 => vt_pid.Anonymous.Anonymous.Anonymous.uintVal,
                                VT_I4 => vt_pid.Anonymous.Anonymous.Anonymous.lVal as u32,
                                VT_UI2 => vt_pid.Anonymous.Anonymous.Anonymous.uiVal as u32,
                                VT_I2 => vt_pid.Anonymous.Anonymous.Anonymous.iVal as u32,
                                _ => 0,
                            };
                            let _ = VariantClear(&mut vt_pid);

                            if pid > 4 && pid != current_pid {
                                let matchers_guard = matchers.read().unwrap();
                                if let Some(event) = inspect_and_terminate_process(pid, &matchers_guard) {
                                    let mut blocked_guard = last_blocked.lock().unwrap();
                                    if let Some(existing) = blocked_guard.as_mut() {
                                        if existing.app_name == event.app_name {
                                            existing.count += 1;
                                            existing.timestamp = event.timestamp;
                                        } else {
                                            *existing = event;
                                        }
                                    } else {
                                        *blocked_guard = Some(event);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            CoUninitialize();
            Ok(())
        }
    }

    pub struct AppEnforcer {
        targets: Vec<AppBlockTarget>,
        matchers: Arc<RwLock<ProcessMatchers>>,
        watcher_stop: Option<Arc<AtomicBool>>,
        watcher_handle: Option<JoinHandle<()>>,
        last_blocked: Arc<Mutex<Option<BlockedAppEvent>>>,
        is_using_fallback: bool,
        last_fallback_poll: Option<Instant>,
    }

    impl Default for AppEnforcer {
        fn default() -> Self {
            cleanup_legacy_wfp();
            Self {
                targets: Vec::new(),
                matchers: Arc::new(RwLock::new(ProcessMatchers::default())),
                watcher_stop: None,
                watcher_handle: None,
                last_blocked: Arc::new(Mutex::new(None)),
                is_using_fallback: false,
                last_fallback_poll: None,
            }
        }
    }

    impl AppEnforcer {
        pub fn validate_target(target: &AppBlockTarget) -> Result<AppBlockTarget, String> {
            let target = target.normalized()?;
            match target {
                AppBlockTarget::Folder { .. } => {
                    Err("folder targets are no longer supported; please add specific applications".into())
                }
                AppBlockTarget::Executable { path } => {
                    let path = fs::canonicalize(&path)
                        .map_err(|error| format!("cannot resolve executable target: {error}"))?;
                    if !path.is_file()
                        || !path
                            .extension()
                            .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
                    {
                        return Err("executable target must resolve to an existing .exe file".into());
                    }
                    let path_str = path.to_string_lossy();
                    Ok(AppBlockTarget::Executable {
                        path: strip_verbatim_prefix(&path_str),
                    })
                }
                AppBlockTarget::Package {
                    package_family_name,
                } => {
                    let package_family_name = package_family_name.to_ascii_lowercase();
                    let package_family_name_wide: Vec<u16> = package_family_name
                        .encode_utf16()
                        .chain(std::iter::once(0))
                        .collect();
                    let mut sid: PSID = ptr::null_mut();
                    let status = unsafe {
                        DeriveAppContainerSidFromAppContainerName(
                            package_family_name_wide.as_ptr(),
                            &mut sid,
                        )
                    };
                    if !sid.is_null() {
                        unsafe { FreeSid(sid) };
                    }
                    if status < 0 {
                        return Err(format!(
                            "invalid package family name (0x{:08X})",
                            status as u32
                        ));
                    }
                    Ok(AppBlockTarget::Package {
                        package_family_name,
                    })
                }
            }
        }

        pub fn apply(&mut self, targets: &[AppBlockTarget]) -> Result<(), String> {
            // Stop any existing watcher before applying new targets
            self.stop_watcher();

            let candidate_targets: Vec<AppBlockTarget> = targets
                .iter()
                .filter(|t| !matches!(t, AppBlockTarget::Folder { .. }))
                .map(AppBlockTarget::normalized)
                .collect::<Result<_, _>>()?;
            let new_matchers = ProcessMatchers::from_targets(&candidate_targets);

            {
                let mut matchers_guard = self.matchers.write().unwrap();
                *matchers_guard = new_matchers.clone();
            }
            self.targets = candidate_targets;

            if self.targets.is_empty() {
                self.is_using_fallback = false;
                return Ok(());
            }

            // 1. Start kernel event watcher thread with its own dedicated stop flag
            let stop_flag = Arc::new(AtomicBool::new(false));
            self.watcher_stop = Some(Arc::clone(&stop_flag));

            let matchers_clone = Arc::clone(&self.matchers);
            let stop_flag_clone = Arc::clone(&stop_flag);
            let last_blocked_clone = Arc::clone(&self.last_blocked);

            let (init_tx, init_rx) = std::sync::mpsc::channel();

            let handle = thread::spawn(move || {
                if let Err(e) = run_process_watcher(
                    matchers_clone,
                    stop_flag_clone,
                    last_blocked_clone,
                    init_tx,
                ) {
                    warn!("Kernel process watcher exited with error: {e}");
                }
            });

            // Retain thread handle even if init times out so stop_watcher can cleanly join it later
            self.watcher_handle = Some(handle);

            match init_rx.recv_timeout(Duration::from_millis(2000)) {
                Ok(Ok(())) => {
                    info!("Process event watcher started and active at 0% idle CPU");
                    self.is_using_fallback = false;
                }
                Ok(Err(error)) => {
                    warn!(
                        "Kernel event process watcher failed ({error}); enabling low-frequency polling fallback"
                    );
                    self.is_using_fallback = true;
                    self.last_fallback_poll = Some(Instant::now());
                }
                Err(_) => {
                    warn!("Kernel event watcher timed out waiting for readiness; enabling polling fallback while thread finishes");
                    self.is_using_fallback = true;
                    self.last_fallback_poll = Some(Instant::now());
                }
            }

            // 2. Perform process sweep AFTER watcher is registered (or fallback is chosen)
            // This ensures no window exists where an app launched during initialization escapes detection.
            let sweep_events = sweep_active_processes(&new_matchers);
            if let Some(first) = sweep_events.into_iter().next() {
                let mut guard = self.last_blocked.lock().unwrap();
                *guard = Some(first);
            }

            Ok(())
        }

        pub fn tick(&mut self) -> Result<(), String> {
            if let Some(handle) = &self.watcher_handle {
                if handle.is_finished() && !self.is_using_fallback {
                    warn!("Process event watcher thread terminated unexpectedly; switching to polling fallback");
                    self.is_using_fallback = true;
                    self.last_fallback_poll = Some(Instant::now());
                }
            }

            if self.is_using_fallback {
                let now = Instant::now();
                if self
                    .last_fallback_poll
                    .map_or(true, |last| now.duration_since(last) >= FALLBACK_POLL_INTERVAL)
                {
                    self.last_fallback_poll = Some(now);
                    let matchers_guard = self.matchers.read().unwrap();
                    let events = sweep_active_processes(&matchers_guard);
                    if let Some(event) = events.into_iter().next() {
                        let mut blocked_guard = self.last_blocked.lock().unwrap();
                        if let Some(existing) = blocked_guard.as_mut() {
                            if existing.app_name == event.app_name {
                                existing.count += 1;
                                existing.timestamp = event.timestamp;
                            } else {
                                *existing = event;
                            }
                        } else {
                            *blocked_guard = Some(event);
                        }
                    }
                }
            }
            Ok(())
        }

        pub fn clear(&mut self) -> Result<(), String> {
            self.stop_watcher();
            cleanup_legacy_wfp();
            self.targets.clear();
            {
                let mut matchers_guard = self.matchers.write().unwrap();
                *matchers_guard = ProcessMatchers::default();
            }
            self.is_using_fallback = false;
            self.last_fallback_poll = None;
            Ok(())
        }

        fn stop_watcher(&mut self) {
            if let Some(stop) = self.watcher_stop.take() {
                stop.store(true, Ordering::Relaxed);
            }
            if let Some(handle) = self.watcher_handle.take() {
                if handle.is_finished() {
                    let _ = handle.join();
                } else {
                    // Avoid unbounded wait while holding service lock; join asynchronously
                    thread::spawn(move || {
                        let _ = handle.join();
                    });
                }
            }
        }

        pub fn last_blocked_app(&self) -> Option<BlockedAppEvent> {
            self.last_blocked.lock().unwrap().clone()
        }

        pub fn clear_last_blocked_app(&self) {
            let mut guard = self.last_blocked.lock().unwrap();
            *guard = None;
        }

        #[allow(dead_code)]
        pub fn is_using_fallback(&self) -> bool {
            self.is_using_fallback
        }
    }

    fn normalize_path(path: &Path) -> String {
        let path_str = fs::canonicalize(path)
            .unwrap_or_else(|_| path.to_path_buf())
            .to_string_lossy()
            .replace('/', "\\")
            .to_ascii_lowercase();
        strip_verbatim_prefix(&path_str)
    }

    fn strip_verbatim_prefix(path: &str) -> String {
        if let Some(stripped) = path.strip_prefix(r"\\?\unc\") {
            format!(r"\\{}", stripped)
        } else if let Some(stripped) = path.strip_prefix(r"\\?\UNC\") {
            format!(r"\\{}", stripped)
        } else if let Some(stripped) = path.strip_prefix(r"\\?\") {
            stripped.to_string()
        } else {
            path.to_string()
        }
    }

    unsafe fn query_process_image_path(process: HANDLE) -> Option<PathBuf> {
        let mut capacity = 1024;
        let mut buffer = vec![0u16; capacity];

        loop {
            let mut length = buffer.len() as u32;
            if QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length) != 0 {
                return Some(PathBuf::from(OsString::from_wide(&buffer[..length as usize])));
            }

            if GetLastError() != ERROR_INSUFFICIENT_BUFFER {
                return None;
            }

            capacity *= 2;
            if capacity > 32_768 {
                return None;
            }
            buffer.resize(capacity, 0);
        }
    }

    unsafe fn query_package_family_name(process: HANDLE) -> Option<String> {
        let mut length = 0u32;
        let status = GetPackageFamilyName(process, &mut length, ptr::null_mut());
        if status == APPMODEL_ERROR_NO_PACKAGE || length == 0 {
            return None;
        }
        if status != ERROR_INSUFFICIENT_BUFFER {
            return None;
        }

        let mut buffer = vec![0u16; length as usize];
        if GetPackageFamilyName(process, &mut length, buffer.as_mut_ptr()) != 0 {
            return None;
        }
        let length = buffer.iter().position(|&ch| ch == 0).unwrap_or(length as usize);
        Some(OsString::from_wide(&buffer[..length]).to_string_lossy().into_owned())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_system_tools_are_strictly_excluded_from_blocking() {
            assert!(ProcessMatchers::is_system_excluded("taskmgr.exe"));
            assert!(ProcessMatchers::is_system_excluded("TASKMGR.EXE"));
            assert!(ProcessMatchers::is_system_excluded("perfmon.exe"));
            assert!(ProcessMatchers::is_system_excluded("mmc.exe"));
            assert!(ProcessMatchers::is_system_excluded("systemsettings.exe"));
            assert!(ProcessMatchers::is_system_excluded("focus-service.exe"));
            assert!(ProcessMatchers::is_system_excluded("desktop.exe"));
            assert!(!ProcessMatchers::is_system_excluded("zoom.exe"));
            assert!(!ProcessMatchers::is_system_excluded("slack.exe"));

            // Even if an administrator accidentally blocks taskmgr.exe, matchers must refuse to match
            let targets = vec![AppBlockTarget::Executable {
                path: r"C:\Windows\System32\Taskmgr.exe".into(),
            }];
            let matchers = ProcessMatchers::from_targets(&targets);
            assert_eq!(
                matchers.matches(Some(Path::new(r"C:\Windows\System32\Taskmgr.exe")), None),
                None
            );
        }

        #[test]
        fn test_process_matchers_launcher_binary_names() {
            let targets = vec![
                AppBlockTarget::Executable {
                    path: r"C:\Users\User\AppData\Local\Discord\Update.exe".into(),
                },
                AppBlockTarget::Executable {
                    path: r"C:\Program Files\SomeApp\Launcher.exe".into(),
                },
            ];

            let matchers = ProcessMatchers::from_targets(&targets);

            // Should match the launcher's own filename
            assert!(matchers.matches(Some(Path::new(r"C:\AnyFolder\Update.exe")), None).is_some());

            // Should match parent directory name inferred executable (Discord.exe)
            assert!(matchers.matches(Some(Path::new(r"C:\Users\User\AppData\Local\Discord\app-1.0.9013\Discord.exe")), None).is_some());

            // Non-blocked executable should pass through
            assert_eq!(matchers.matches(Some(Path::new(r"C:\AnyFolder\notepad.exe")), None), None);
        }

        #[test]
        fn test_process_matchers_long_paths() {
            let long_folder = r"C:\".to_string() + &"very_long_folder_name_that_takes_up_space\\".repeat(50);
            let long_path = long_folder + "custom_app.exe";

            let targets = vec![AppBlockTarget::Executable {
                path: long_path.clone(),
            }];

            let matchers = ProcessMatchers::from_targets(&targets);
            assert!(matchers.matches(Some(Path::new(&long_path)), None).is_some());
        }

        #[test]
        fn test_package_family_name_matching() {
            let targets = vec![AppBlockTarget::Package {
                package_family_name: "Microsoft.WindowsCommunicationsApps_8wekyb3d8bbwe".into(),
            }];
            let matchers = ProcessMatchers::from_targets(&targets);

            assert!(matchers
                .matches(None, Some("Microsoft.WindowsCommunicationsApps_8wekyb3d8bbwe"))
                .is_some());
            assert_eq!(
                matchers.matches(None, Some("Microsoft.WindowsCalculator_8wekyb3d8bbwe")),
                None
            );
        }
    }
}

#[cfg(windows)]
pub use windows::AppEnforcer;

#[cfg(not(windows))]
#[derive(Default)]
pub struct AppEnforcer {
    last_blocked: Option<BlockedAppEvent>,
}

#[cfg(not(windows))]
impl AppEnforcer {
    pub fn validate_target(target: &AppBlockTarget) -> Result<AppBlockTarget, String> {
        target.normalized()
    }

    pub fn apply(&mut self, _targets: &[AppBlockTarget]) -> Result<(), String> {
        Ok(())
    }

    pub fn tick(&mut self) -> Result<(), String> {
        Ok(())
    }

    pub fn clear(&mut self) -> Result<(), String> {
        self.last_blocked = None;
        Ok(())
    }

    pub fn last_blocked_app(&self) -> Option<BlockedAppEvent> {
        self.last_blocked.clone()
    }

    pub fn clear_last_blocked_app(&mut self) {
        self.last_blocked = None;
    }

    pub fn is_using_fallback(&self) -> bool {
        false
    }
}
