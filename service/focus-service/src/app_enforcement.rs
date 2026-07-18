#[cfg(not(windows))]
use focus_core::AppBlockTarget;

#[cfg(windows)]
mod windows {
    use focus_core::AppBlockTarget;
    use std::collections::{BTreeSet, HashSet};
    use std::ffi::OsString;
    use std::fs;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::path::{Path, PathBuf};
    use std::ptr;
    use std::time::{Duration, Instant};
    use tracing::warn;
    use uuid::Uuid;
    use windows_sys::core::GUID;
    use windows_sys::Win32::Foundation::{
        CloseHandle, APPMODEL_ERROR_NO_PACKAGE, ERROR_INSUFFICIENT_BUFFER, HANDLE,
        INVALID_HANDLE_VALUE,
    };
    use windows_sys::Win32::NetworkManagement::WindowsFilteringPlatform::{
        FwpmEngineClose0, FwpmEngineOpen0, FwpmFilterAdd0, FwpmFilterCreateEnumHandle0,
        FwpmFilterDeleteById0, FwpmFilterDestroyEnumHandle0, FwpmFilterEnum0, FwpmFreeMemory0,
        FwpmGetAppIdFromFileName0, FwpmProviderAdd0, FwpmProviderGetByKey0,
        FwpmSubLayerAdd0, FwpmSubLayerGetByKey0, FwpmTransactionAbort0,
        FwpmTransactionBegin0, FwpmTransactionCommit0, FWP_ACTION_BLOCK,
        FWP_BYTE_BLOB_TYPE, FWP_EMPTY, FWP_MATCH_EQUAL, FWP_SID,
        FWPM_CONDITION_ALE_APP_ID, FWPM_CONDITION_ALE_PACKAGE_ID,
        FWPM_FILTER_CONDITION0, FWPM_FILTER_ENUM_TEMPLATE0, FWPM_FILTER_FLAG_PERSISTENT,
        FWPM_FILTER0, FWPM_LAYER_ALE_AUTH_CONNECT_V4, FWPM_LAYER_ALE_AUTH_CONNECT_V6,
        FWPM_PROVIDER_FLAG_PERSISTENT, FWPM_PROVIDER0, FWPM_SUBLAYER_FLAG_PERSISTENT,
        FWPM_SUBLAYER0,
    };
    use windows_sys::Win32::Security::{FreeSid, PSID};
    use windows_sys::Win32::Security::Isolation::DeriveAppContainerSidFromAppContainerName;
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

    // Stable ownership IDs. No system firewall object outside this provider/sublayer is changed.
    const PROVIDER_KEY: GUID = GUID::from_u128(0x6e7f52de_6b17_4454_9397_ae2a09d96001);
    const SUBLAYER_KEY: GUID = GUID::from_u128(0x6e7f52de_6b17_4454_9397_ae2a09d96002);
    const NETWORK_REFRESH_INTERVAL: Duration = Duration::from_secs(2);
    const FWP_E_PROVIDER_NOT_FOUND: u32 = 0x8032_0005;
    const FWP_E_SUBLAYER_NOT_FOUND: u32 = 0x8032_0007;
    const FWP_E_NEVER_MATCH: u32 = 0x8032_0033;

    #[derive(Default)]
    struct ProcessMatchers {
        executable_paths: HashSet<String>,
        folder_prefixes: Vec<String>,
        package_families: HashSet<String>,
    }

    impl ProcessMatchers {
        fn from_targets(targets: &[AppBlockTarget]) -> Self {
            let mut matchers = Self::default();
            for target in targets {
                match target {
                    AppBlockTarget::Executable { path } => {
                        matchers.executable_paths.insert(normalize_path(Path::new(path)));
                    }
                    AppBlockTarget::Folder { path } => {
                        let mut prefix = normalize_path(Path::new(path));
                        if !prefix.ends_with('\\') {
                            prefix.push('\\');
                        }
                        matchers.folder_prefixes.push(prefix);
                    }
                    AppBlockTarget::Package { package_family_name } => {
                        matchers
                            .package_families
                            .insert(package_family_name.to_ascii_lowercase());
                    }
                }
            }
            matchers
        }

        fn matches(&self, image_path: Option<&Path>, package_family_name: Option<&str>) -> bool {
            if let Some(package_family_name) = package_family_name {
                if self
                    .package_families
                    .contains(&package_family_name.to_ascii_lowercase())
                {
                    return true;
                }
            }

            let Some(image_path) = image_path else {
                return false;
            };
            let image_path = normalize_path(image_path);
            self.executable_paths.contains(&image_path)
                || self
                    .folder_prefixes
                    .iter()
                    .any(|prefix| image_path.starts_with(prefix))
        }
    }

    /// User-mode enforcement. WFP denies network access for known identities;
    /// the process loop repeatedly terminates matching processes after launch.
    pub struct AppEnforcer {
        targets: Vec<AppBlockTarget>,
        matchers: ProcessMatchers,
        applied_network_identities: BTreeSet<String>,
        last_network_refresh: Option<Instant>,
    }

    impl Default for AppEnforcer {
        fn default() -> Self {
            Self {
                targets: Vec::new(),
                matchers: ProcessMatchers::default(),
                applied_network_identities: BTreeSet::new(),
                last_network_refresh: None,
            }
        }
    }

    impl AppEnforcer {
        /// Called before a target is persisted. Win32 paths are made absolute
        /// and canonical so later process matching cannot be escaped by a
        /// relative path, casing, or `..` components.
        pub fn validate_target(target: &AppBlockTarget) -> Result<AppBlockTarget, String> {
            let target = target.normalized()?;
            match target {
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
                    Ok(AppBlockTarget::Executable {
                        path: path.to_string_lossy().into_owned(),
                    })
                }
                AppBlockTarget::Folder { path } => {
                    let path = fs::canonicalize(&path)
                        .map_err(|error| format!("cannot resolve folder target: {error}"))?;
                    if !path.is_dir() {
                        return Err("folder target must resolve to an existing directory".into());
                    }
                    Ok(AppBlockTarget::Folder {
                        path: path.to_string_lossy().into_owned(),
                    })
                }
                AppBlockTarget::Package { package_family_name } => {
                    let package_family_name = package_family_name.to_ascii_lowercase();
                    let package_family_name_wide = wide(&package_family_name);
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
            let candidate_targets: Vec<AppBlockTarget> = targets
                .iter()
                .map(AppBlockTarget::normalized)
                .collect::<Result<_, _>>()?;
            let candidate_matchers = ProcessMatchers::from_targets(&candidate_targets);
            let candidate_identities = network_identities(&candidate_targets)?;

            // WFP replacement is atomic. Keep current in-memory matchers until it
            // commits so a failure cannot split kill-loop state from filters.
            replace_focusblock_filters(&candidate_identities)?;
            self.targets = candidate_targets;
            self.matchers = candidate_matchers;
            self.applied_network_identities = candidate_identities;
            self.last_network_refresh = Some(Instant::now());
            self.terminate_matching_processes();
            Ok(())
        }

        pub fn tick(&mut self) -> Result<(), String> {
            self.terminate_matching_processes();
            if self
                .last_network_refresh
                .map_or(true, |last| last.elapsed() >= NETWORK_REFRESH_INTERVAL)
            {
                self.refresh_network_policy(false)?;
            }
            Ok(())
        }

        pub fn clear(&mut self) -> Result<(), String> {
            clear_focusblock_filters()?;
            self.targets.clear();
            self.matchers = ProcessMatchers::default();
            self.applied_network_identities.clear();
            self.last_network_refresh = None;
            Ok(())
        }

        fn refresh_network_policy(&mut self, force: bool) -> Result<(), String> {
            let identities = network_identities(&self.targets)?;
            if !force && identities == self.applied_network_identities {
                self.last_network_refresh = Some(Instant::now());
                return Ok(());
            }

            replace_focusblock_filters(&identities)?;
            self.applied_network_identities = identities;
            self.last_network_refresh = Some(Instant::now());
            Ok(())
        }

        fn terminate_matching_processes(&self) {
            unsafe {
                let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
                if snapshot == INVALID_HANDLE_VALUE {
                    warn!("unable to enumerate processes for app enforcement");
                    return;
                }

                let mut entry = PROCESSENTRY32W {
                    dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                    ..Default::default()
                };
                let mut has_entry = Process32FirstW(snapshot, &mut entry) != 0;
                while has_entry {
                    if entry.th32ProcessID != GetCurrentProcessId() {
                        self.inspect_and_terminate(entry.th32ProcessID);
                    }
                    has_entry = Process32NextW(snapshot, &mut entry) != 0;
                }
                let _ = CloseHandle(snapshot);
            }
        }

        unsafe fn inspect_and_terminate(&self, process_id: u32) {
            let process = OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE,
                0,
                process_id,
            );
            if process.is_null() {
                warn!(process_id, "unable to inspect process for app enforcement");
                return;
            }

            let image_path = query_process_image_path(process);
            let package_family_name = query_package_family_name(process);
            if self
                .matchers
                .matches(image_path.as_deref(), package_family_name.as_deref())
                && TerminateProcess(process, 1) == 0
            {
                warn!(process_id, "matched blocked process could not be terminated");
            }
            let _ = CloseHandle(process);
        }
    }

    fn normalize_path(path: &Path) -> String {
        fs::canonicalize(path)
            .unwrap_or_else(|_| path.to_path_buf())
            .to_string_lossy()
            .replace('/', "\\")
            .to_ascii_lowercase()
    }

    fn network_identities(targets: &[AppBlockTarget]) -> Result<BTreeSet<String>, String> {
        let mut identities = BTreeSet::new();
        for target in targets {
            match target {
                AppBlockTarget::Executable { path } => {
                    let path = PathBuf::from(path);
                    if !path.is_file() {
                        return Err(format!("blocked executable no longer exists: {}", path.display()));
                    }
                    identities.insert(format!("exe:{}", normalize_path(&path)));
                }
                AppBlockTarget::Folder { path } => {
                    for executable in executables_in_folder(Path::new(path))? {
                        identities.insert(format!("exe:{}", normalize_path(&executable)));
                    }
                }
                AppBlockTarget::Package { package_family_name } => {
                    identities.insert(format!("package:{}", package_family_name.to_ascii_lowercase()));
                }
            }
        }
        Ok(identities)
    }

    fn executables_in_folder(folder: &Path) -> Result<Vec<PathBuf>, String> {
        let mut executables = Vec::new();
        collect_executables(folder, &mut executables)?;
        Ok(executables)
    }

    fn collect_executables(folder: &Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
        let entries = fs::read_dir(folder)
            .map_err(|error| format!("cannot scan blocked folder {}: {error}", folder.display()))?;

        for entry in entries {
            let entry = entry.map_err(|error| {
                format!("cannot enumerate blocked folder {}: {error}", folder.display())
            })?;
            let file_type = entry.file_type().map_err(|error| {
                format!("cannot inspect blocked folder entry {}: {error}", entry.path().display())
            })?;
            // Do not follow links outside selected folder.
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            if file_type.is_dir() {
                collect_executables(&path, output)?;
            } else if file_type.is_file()
                && path
                    .extension()
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
            {
                output.push(path);
            }
        }
        Ok(())
    }

    unsafe fn query_process_image_path(process: HANDLE) -> Option<PathBuf> {
        let mut buffer = vec![0u16; 32_768];
        let mut length = buffer.len() as u32;
        if QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length) == 0 {
            return None;
        }
        Some(PathBuf::from(OsString::from_wide(&buffer[..length as usize])))
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

    fn replace_focusblock_filters(identities: &BTreeSet<String>) -> Result<(), String> {
        unsafe {
            let engine = WfpEngine::open()?;
            // The provider/sublayer must exist before the provider-scoped
            // enumeration. Otherwise WFP returns FWP_E_NEVER_MATCH.
            ensure_provider_and_sublayer(engine.handle)?;
            let filter_ids = enumerate_focusblock_filter_ids(engine.handle)?;
            let transaction = WfpTransaction::begin(engine.handle)?;
            let result = (|| {
                delete_focusblock_filters(engine.handle, &filter_ids)?;

                for identity in identities {
                    if let Some(path) = identity.strip_prefix("exe:") {
                        add_executable_filters(engine.handle, Path::new(path))?;
                    } else if let Some(package) = identity.strip_prefix("package:") {
                        add_package_filters(engine.handle, package)?;
                    }
                }
                Ok(())
            })();

            match result {
                Ok(()) => transaction.commit(),
                Err(error) => {
                    transaction.abort();
                    Err(error)
                }
            }
        }
    }

    fn clear_focusblock_filters() -> Result<(), String> {
        unsafe {
            let engine = WfpEngine::open()?;
            let filter_ids = enumerate_focusblock_filter_ids(engine.handle)?;
            let transaction = WfpTransaction::begin(engine.handle)?;
            let result = delete_focusblock_filters(engine.handle, &filter_ids);
            match result {
                Ok(()) => transaction.commit(),
                Err(error) => {
                    transaction.abort();
                    Err(error)
                }
            }
        }
    }

    struct WfpEngine {
        handle: HANDLE,
    }

    impl WfpEngine {
        unsafe fn open() -> Result<Self, String> {
            let mut handle = ptr::null_mut();
            check_wfp(
                FwpmEngineOpen0(
                    ptr::null(),
                    RPC_C_AUTHN_DEFAULT as u32,
                    ptr::null(),
                    ptr::null(),
                    &mut handle,
                ),
                "FwpmEngineOpen0",
            )?;
            Ok(Self { handle })
        }
    }

    impl Drop for WfpEngine {
        fn drop(&mut self) {
            unsafe {
                if !self.handle.is_null() {
                    let _ = FwpmEngineClose0(self.handle);
                }
            }
        }
    }

    struct WfpTransaction {
        engine: HANDLE,
        finished: bool,
    }

    impl WfpTransaction {
        unsafe fn begin(engine: HANDLE) -> Result<Self, String> {
            check_wfp(FwpmTransactionBegin0(engine, 0), "FwpmTransactionBegin0")?;
            Ok(Self {
                engine,
                finished: false,
            })
        }

        unsafe fn commit(mut self) -> Result<(), String> {
            let result = check_wfp(FwpmTransactionCommit0(self.engine), "FwpmTransactionCommit0");
            self.finished = true;
            result
        }

        unsafe fn abort(mut self) {
            let _ = FwpmTransactionAbort0(self.engine);
            self.finished = true;
        }
    }

    impl Drop for WfpTransaction {
        fn drop(&mut self) {
            unsafe {
                if !self.finished {
                    let _ = FwpmTransactionAbort0(self.engine);
                }
            }
        }
    }

    unsafe fn ensure_provider_and_sublayer(engine: HANDLE) -> Result<(), String> {
        let mut existing_provider = ptr::null_mut();
        let provider_status = FwpmProviderGetByKey0(engine, &PROVIDER_KEY, &mut existing_provider);
        if provider_status == FWP_E_PROVIDER_NOT_FOUND {
            let mut name = wide("FocusBlock");
            let mut provider = FWPM_PROVIDER0::default();
            provider.providerKey = PROVIDER_KEY;
            provider.flags = FWPM_PROVIDER_FLAG_PERSISTENT;
            provider.displayData.name = name.as_mut_ptr();
            check_wfp(
                FwpmProviderAdd0(engine, &provider, ptr::null_mut()),
                "FwpmProviderAdd0",
            )?;
        } else if provider_status == 0 {
            free_wfp_memory(&mut existing_provider);
        } else {
            return Err(format!(
                "FwpmProviderGetByKey0 failed (0x{provider_status:08X})"
            ));
        }

        let mut existing_sublayer = ptr::null_mut();
        let sublayer_status = FwpmSubLayerGetByKey0(engine, &SUBLAYER_KEY, &mut existing_sublayer);
        if sublayer_status == FWP_E_SUBLAYER_NOT_FOUND {
            let mut name = wide("FocusBlock application blocking");
            let mut provider_key = PROVIDER_KEY;
            let mut sublayer = FWPM_SUBLAYER0::default();
            sublayer.subLayerKey = SUBLAYER_KEY;
            sublayer.flags = FWPM_SUBLAYER_FLAG_PERSISTENT;
            sublayer.providerKey = &mut provider_key;
            sublayer.weight = 0x7fff;
            sublayer.displayData.name = name.as_mut_ptr();
            check_wfp(
                FwpmSubLayerAdd0(engine, &sublayer, ptr::null_mut()),
                "FwpmSubLayerAdd0",
            )?;
        } else if sublayer_status == 0 {
            free_wfp_memory(&mut existing_sublayer);
        } else {
            return Err(format!(
                "FwpmSubLayerGetByKey0 failed (0x{sublayer_status:08X})"
            ));
        }
        Ok(())
    }

    unsafe fn enumerate_focusblock_filter_ids(engine: HANDLE) -> Result<Vec<u64>, String> {
        let mut provider_key = PROVIDER_KEY;
        let mut template = FWPM_FILTER_ENUM_TEMPLATE0::default();
        template.providerKey = &mut provider_key;
        let mut enum_handle = ptr::null_mut();
        let status = FwpmFilterCreateEnumHandle0(engine, &template, &mut enum_handle);
        if status == FWP_E_NEVER_MATCH {
            return Ok(Vec::new());
        }
        check_wfp(status, "FwpmFilterCreateEnumHandle0")?;

        let mut filter_ids = Vec::new();
        let result: Result<(), String> = (|| {
            loop {
                let mut filters: *mut *mut FWPM_FILTER0 = ptr::null_mut();
                let mut count = 0u32;
                check_wfp(
                    FwpmFilterEnum0(engine, enum_handle, 64, &mut filters, &mut count),
                    "FwpmFilterEnum0",
                )?;
                if count == 0 {
                    break;
                }
                for filter in std::slice::from_raw_parts(filters, count as usize) {
                    if !filter.is_null() && guid_eq(&(**filter).subLayerKey, &SUBLAYER_KEY) {
                        filter_ids.push((**filter).filterId);
                    }
                }
                free_wfp_memory(&mut filters);
            }
            Ok(())
        })();
        let _ = FwpmFilterDestroyEnumHandle0(engine, enum_handle);
        result?;
        Ok(filter_ids)
    }

    unsafe fn delete_focusblock_filters(engine: HANDLE, filter_ids: &[u64]) -> Result<(), String> {

        for filter_id in filter_ids {
            check_wfp(
                FwpmFilterDeleteById0(engine, *filter_id),
                "FwpmFilterDeleteById0",
            )?;
        }
        Ok(())
    }

    unsafe fn add_executable_filters(engine: HANDLE, path: &Path) -> Result<(), String> {
        let path = wide(&path.to_string_lossy());
        let mut app_id = ptr::null_mut();
        check_wfp(
            FwpmGetAppIdFromFileName0(path.as_ptr(), &mut app_id),
            "FwpmGetAppIdFromFileName0",
        )?;

        let result = add_identity_filters(engine, IdentityCondition::AppId(app_id));
        free_wfp_memory(&mut app_id);
        result
    }

    unsafe fn add_package_filters(engine: HANDLE, package_family_name: &str) -> Result<(), String> {
        let package_family_name = wide(package_family_name);
        let mut sid: PSID = ptr::null_mut();
        let status = DeriveAppContainerSidFromAppContainerName(package_family_name.as_ptr(), &mut sid);
        if status < 0 {
            return Err(format!(
                "DeriveAppContainerSidFromAppContainerName failed (0x{:08X})",
                status as u32
            ));
        }

        let result = add_identity_filters(engine, IdentityCondition::PackageSid(sid));
        let _ = FreeSid(sid);
        result
    }

    enum IdentityCondition {
        AppId(*mut windows_sys::Win32::NetworkManagement::WindowsFilteringPlatform::FWP_BYTE_BLOB),
        PackageSid(PSID),
    }

    unsafe fn add_identity_filters(engine: HANDLE, identity: IdentityCondition) -> Result<(), String> {
        add_identity_filter(engine, &identity, FWPM_LAYER_ALE_AUTH_CONNECT_V4)?;
        add_identity_filter(engine, &identity, FWPM_LAYER_ALE_AUTH_CONNECT_V6)
    }

    unsafe fn add_identity_filter(
        engine: HANDLE,
        identity: &IdentityCondition,
        layer: GUID,
    ) -> Result<(), String> {
        let mut condition = FWPM_FILTER_CONDITION0::default();
        condition.matchType = FWP_MATCH_EQUAL;
        match identity {
            IdentityCondition::AppId(app_id) => {
                condition.fieldKey = FWPM_CONDITION_ALE_APP_ID;
                condition.conditionValue.r#type = FWP_BYTE_BLOB_TYPE;
                condition.conditionValue.Anonymous.byteBlob = *app_id;
            }
            IdentityCondition::PackageSid(sid) => {
                condition.fieldKey = FWPM_CONDITION_ALE_PACKAGE_ID;
                condition.conditionValue.r#type = FWP_SID;
                condition.conditionValue.Anonymous.sid = (*sid).cast();
            }
        }

        let mut provider_key = PROVIDER_KEY;
        let mut name = wide("FocusBlock blocked application network");
        let mut filter = FWPM_FILTER0::default();
        filter.filterKey = GUID::from_u128(Uuid::new_v4().as_u128());
        filter.flags = FWPM_FILTER_FLAG_PERSISTENT;
        filter.providerKey = &mut provider_key;
        filter.layerKey = layer;
        filter.subLayerKey = SUBLAYER_KEY;
        filter.weight.r#type = FWP_EMPTY;
        filter.numFilterConditions = 1;
        filter.filterCondition = &mut condition;
        filter.action.r#type = FWP_ACTION_BLOCK;
        filter.displayData.name = name.as_mut_ptr();
        check_wfp(
            FwpmFilterAdd0(engine, &filter, ptr::null_mut(), ptr::null_mut()),
            "FwpmFilterAdd0",
        )
    }

    unsafe fn free_wfp_memory<T>(value: &mut *mut T) {
        FwpmFreeMemory0(value.cast());
    }

    fn wide(value: &str) -> Vec<u16> {
        OsString::from(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn guid_eq(left: &GUID, right: &GUID) -> bool {
        left.data1 == right.data1
            && left.data2 == right.data2
            && left.data3 == right.data3
            && left.data4 == right.data4
    }

    fn check_wfp(status: u32, operation: &str) -> Result<(), String> {
        if status == 0 {
            Ok(())
        } else {
            Err(format!("{operation} failed (0x{status:08X})"))
        }
    }
}

#[cfg(windows)]
pub use windows::AppEnforcer;

#[cfg(not(windows))]
#[derive(Default)]
pub struct AppEnforcer;

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
        Ok(())
    }
}
