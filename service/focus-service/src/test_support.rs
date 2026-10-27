//! Test-only support for the app-blocking suites.
//!
//! Two jobs:
//!
//! 1. A recorder that satisfies [`Enforcement`] without touching the machine, so
//!    ordinary tests can exercise session start/stop/expiry/recovery.
//! 2. A guarded harness for the few checks that must be real. Those are never
//!    reached by a plain `cargo test`: they need `FOCUS_REAL_ENFORCEMENT`, a
//!    disposable-machine acknowledgement, a lock, and a prerequisite probe.
//!
//! Nothing here is compiled into a shipped service.

use crate::app_enforcement::{process_running, AppEnforcer};
use crate::enforcement::Enforcement;
use crate::session_manager::default_db_path;
use focus_core::{
    AppBlockTarget, BlockedAppEvent, EnforcementMode, IpcRequest, IpcResponse, ResponseData,
    ServiceStatus,
};
use focus_ipc::IpcClient;
use focus_store::FocusStore;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Output, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use uuid::Uuid;

pub const OPT_IN_ENV: &str = "FOCUS_REAL_ENFORCEMENT";
pub const ACK_ENV: &str = "FOCUS_DISPOSABLE_WINDOWS_ACK";
pub const SERVICE_NAME: &str = "FocusBlockService";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tier {
    /// One real check on any dev PC: a launch of the dummy executable dies.
    A,
    /// Service lifecycle checks, only where the test installed the service.
    B,
}

/// `None` means "this run was not requested"; that is the only silent path.
/// Anything inconsistent — a requested run without its acknowledgement, an
/// unknown tier, a missing prerequisite — is a loud failure.
pub fn requested_tier() -> Option<Tier> {
    let raw = std::env::var(OPT_IN_ENV).ok()?;
    match raw.trim().to_ascii_lowercase().as_str() {
        "" => None,
        "tier-a" | "a" => Some(Tier::A),
        "tier-b" | "b" => Some(Tier::B),
        other => panic!(
            "{OPT_IN_ENV}={other:?} is not a tier; use \"tier-a\" or \"tier-b\""
        ),
    }
}

fn require_acknowledgement() {
    let acknowledged = std::env::var(ACK_ENV)
        .map(|value| value == "1" || value.eq_ignore_ascii_case("yes"))
        .unwrap_or(false);
    assert!(
        acknowledged,
        "Real enforcement was requested but not acknowledged.\n\
         Set {ACK_ENV}=1 only on a machine you are willing to lose.\n\
         Tier A kills processes it owns; Tier B installs, starts, and deletes a Windows service."
    );
}

// ---------------------------------------------------------------------------
// Fake enforcement
// ---------------------------------------------------------------------------

#[derive(Debug, Default)]
pub struct FakeLog {
    /// Ordered record, e.g. `apply:1`, `tick`, `clear`. Ordering is what catches
    /// overlapping enforcement.
    pub events: Vec<String>,
    pub applied: Vec<Vec<AppBlockTarget>>,
}

pub struct FakeEnforcer {
    log: Arc<Mutex<FakeLog>>,
    mode: EnforcementMode,
    applying: bool,
    apply_error: Option<String>,
    clear_error: Option<String>,
    last_blocked: Option<BlockedAppEvent>,
}

impl FakeEnforcer {
    pub fn new(mode: EnforcementMode) -> (Self, Arc<Mutex<FakeLog>>) {
        let log = Arc::new(Mutex::new(FakeLog::default()));
        (
            Self {
                log: Arc::clone(&log),
                mode,
                applying: false,
                apply_error: None,
                clear_error: None,
                last_blocked: None,
            },
            log,
        )
    }

    pub fn failing_apply(message: &str) -> (Self, Arc<Mutex<FakeLog>>) {
        let (mut fake, log) = Self::new(EnforcementMode::KernelEvents);
        fake.apply_error = Some(message.to_string());
        (fake, log)
    }

    pub fn failing_clear(message: &str) -> (Self, Arc<Mutex<FakeLog>>) {
        let (mut fake, log) = Self::new(EnforcementMode::KernelEvents);
        fake.clear_error = Some(message.to_string());
        (fake, log)
    }

    /// Simulates an enforcer that reports the degraded polling fallback.
    pub fn in_fallback_mode() -> (Self, Arc<Mutex<FakeLog>>) {
        Self::new(EnforcementMode::PollingFallback)
    }
}

impl Enforcement for FakeEnforcer {
    fn apply(&mut self, targets: &[AppBlockTarget]) -> Result<(), String> {
        if let Some(error) = &self.apply_error {
            self.log.lock().unwrap().events.push("apply-failed".into());
            return Err(error.clone());
        }
        self.applying = !targets.is_empty();
        let mut log = self.log.lock().unwrap();
        log.events.push(format!("apply:{}", targets.len()));
        log.applied.push(targets.to_vec());
        Ok(())
    }

    fn tick(&mut self) -> Result<(), String> {
        self.log.lock().unwrap().events.push("tick".into());
        Ok(())
    }

    fn clear(&mut self) -> Result<(), String> {
        if let Some(error) = &self.clear_error {
            self.log.lock().unwrap().events.push("clear-failed".into());
            return Err(error.clone());
        }
        self.applying = false;
        self.log.lock().unwrap().events.push("clear".into());
        Ok(())
    }

    fn last_blocked_app(&self) -> Option<BlockedAppEvent> {
        self.last_blocked.clone()
    }

    fn clear_last_blocked_app(&mut self) {
        self.last_blocked = None;
    }

    fn mode(&self) -> EnforcementMode {
        if self.applying {
            self.mode
        } else {
            EnforcementMode::Inactive
        }
    }
}

// ---------------------------------------------------------------------------
// Isolated database
// ---------------------------------------------------------------------------

/// A store in the temp directory, never `ProgramData`. Dropped before the file
/// is removed, so an open SQLite handle cannot leak into the shared database.
pub struct TempDb {
    path: PathBuf,
}

impl TempDb {
    pub fn new() -> Self {
        let path = std::env::temp_dir().join(format!("focus-block-test-{}.db", Uuid::new_v4()));
        Self { path }
    }

    pub fn open(&self) -> FocusStore {
        FocusStore::open(&self.path).expect("open temp store")
    }
}

impl Default for TempDb {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for TempDb {
    fn drop(&mut self) {
        for path in sidecar_paths(&self.path) {
            match fs::remove_file(&path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => eprintln!("cleanup: could not remove {}: {error}", path.display()),
            }
        }
    }
}

fn sidecar_paths(path: &Path) -> Vec<PathBuf> {
    let mut paths = vec![path.to_path_buf()];
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    for suffix in ["-wal", "-shm"] {
        paths.push(path.with_file_name(format!("{name}{suffix}")));
    }
    paths
}

// ---------------------------------------------------------------------------
// Dummy executable
// ---------------------------------------------------------------------------

pub fn dummy_exe() -> PathBuf {
    let current = std::env::current_exe().expect("locate test executable");
    let deps = current.parent().expect("test executable directory");
    let name = format!("focus-test-dummy{}", std::env::consts::EXE_SUFFIX);
    let mut candidates = Vec::new();
    for dir in [Some(deps), deps.parent()] {
        let Some(dir) = dir else { continue };
        candidates.push(dir.join(&name));
        candidates.push(dir.join("examples").join(&name));
    }
    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .unwrap_or_else(|| {
            panic!(
                "dedicated test executable {name} not found; it is built by `cargo test` \
                 (see service/focus-service/examples/)"
            )
        })
}

pub struct ChildGuard {
    child: Child,
    cleanup_kills: usize,
}

impl ChildGuard {
    pub fn spawn_dummy() -> Self {
        let child = Command::new(dummy_exe())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn dedicated test executable");
        Self {
            child,
            cleanup_kills: 0,
        }
    }

    /// Polls until the child exits. `None` means it was still alive at the
    /// deadline, which is a test failure for a "should be blocked" assertion.
    pub fn wait_for_exit(&mut self, timeout: Duration) -> Option<ExitStatus> {
        let deadline = Instant::now() + timeout;
        loop {
            match self.child.try_wait() {
                Ok(Some(status)) => return Some(status),
                Ok(None) if Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(25));
                }
                Ok(None) => return None,
                Err(error) => panic!("waiting for test child failed: {error}"),
            }
        }
    }

    /// Asserts the child is still alive after `duration`. Blocked-app releases
    /// are proven this way, not by "the process is not there yet".
    pub fn assert_alive_for(&mut self, duration: Duration, context: &str) {
        let deadline = Instant::now() + duration;
        while Instant::now() < deadline {
            match self.child.try_wait() {
                Ok(Some(status)) => panic!(
                    "{context}: test child exited unexpectedly with {status} after \
                     {:?} (a blocked app must survive once enforcement is released)",
                    duration
                ),
                Ok(None) => std::thread::sleep(Duration::from_millis(50)),
                Err(error) => panic!("{context}: polling test child failed: {error}"),
            }
        }
    }

    pub fn cleanup_kills(&self) -> usize {
        self.cleanup_kills
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        if let Ok(None) = self.child.try_wait() {
            self.cleanup_kills += 1;
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}

// ---------------------------------------------------------------------------
// Cross-process exclusion
// ---------------------------------------------------------------------------

/// Held for the whole guarded run: setup, execution, cleanup. A second
/// invocation — another test, another executable, another terminal — waits.
pub struct OutOfProcessLock {
    path: PathBuf,
}

impl OutOfProcessLock {
    pub fn acquire() -> Self {
        let path = std::env::temp_dir().join("focus-block-real-enforcement.lock");
        let deadline = Instant::now() + Duration::from_secs(180);
        loop {
            match fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
            {
                Ok(mut file) => {
                    use std::io::Write;
                    let _ = writeln!(file, "pid={}", std::process::id());
                    return Self { path };
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                    if Instant::now() >= deadline {
                        let owner = fs::read_to_string(&path).unwrap_or_default();
                        panic!(
                            "another real-enforcement run holds {} ({})\n\
                             If no such run is alive, delete that file and retry.",
                            path.display(),
                            owner.trim()
                        );
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
                Err(error) => panic!("could not create exclusion lock: {error}"),
            }
        }
    }
}

impl Drop for OutOfProcessLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

// ---------------------------------------------------------------------------
// Guarded runs
// ---------------------------------------------------------------------------

pub struct GuardedRun {
    _lock: OutOfProcessLock,
    tier: Tier,
    checked: Vec<String>,
}

impl GuardedRun {
    /// `None` when this tier was not requested. Everything else is fatal.
    pub fn begin(tier: Tier) -> Option<Self> {
        if requested_tier()? != tier {
            return None;
        }
        require_acknowledgement();
        let lock = OutOfProcessLock::acquire();
        let mut run = Self {
            _lock: lock,
            tier,
            checked: Vec::new(),
        };
        run.require_prerequisites();
        Some(run)
    }

    pub fn record(&mut self, check: impl Into<String>) {
        let check = check.into();
        println!("[real-enforcement:{:?}] {check}", self.tier);
        self.checked.push(check);
    }

    fn require_prerequisites(&mut self) {
        if !cfg!(windows) {
            panic!("real enforcement checks require Windows; nothing was run");
        }

        assert!(
            is_elevated(),
            "elevation is required to subscribe to Windows process-start events; \
             run the test from an elevated shell"
        );

        assert!(
            !service_exists(),
            "{SERVICE_NAME} already exists on this machine. Refusing to run: a real \
             installation is present, and this harness never stops or deletes a user service."
        );

        assert!(
            !process_running("focus-service.exe"),
            "a FocusBlock service process is running; refusing to interfere with it"
        );

        assert!(
            !process_running("focusblock.exe") && !process_running("focus-block.exe"),
            "the FocusBlock desktop app is running; refusing to run real enforcement checks"
        );

        let db = default_db_path();
        assert!(
            !db.exists(),
            "real FocusBlock data already exists at {}. This harness only runs on a \
             machine with no user state, and it never erases user data to prepare.",
            db.display()
        );

        // Probe the kernel subscription before any test process is spawned. The
        // probe target cannot match a real executable, so the sweep this triggers
        // terminates nothing; it only proves the WMI subscription registers.
        let probe_target = AppBlockTarget::Executable {
            path: format!("focus-block-probe-{}.exe", Uuid::new_v4()),
        };
        let mut probe = AppEnforcer::default();
        probe
            .apply(std::slice::from_ref(&probe_target))
            .expect("probe: applying a non-matching target must not fail");
        let mode = probe.mode();
        // Tear down before asserting so a failed prerequisite never leaves a
        // subscription behind while the test unwinds.
        probe.clear().expect("probe: teardown failed");
        assert_eq!(
            mode,
            EnforcementMode::KernelEvents,
            "Windows delivered no kernel process-start subscription (it fell back to the \
             2.5s sweep). Check the Windows Management Instrumentation service and elevation."
        );

        dummy_exe();
        self.record("prerequisites: Windows, elevation, no existing install, kernel subscription active");
    }
}

impl Drop for GuardedRun {
    fn drop(&mut self) {
        if !self.checked.is_empty() {
            eprintln!(
                "[real-enforcement:{:?}] checks completed: {}",
                self.tier,
                self.checked.join("; ")
            );
        }
    }
}

fn is_elevated() -> bool {
    Command::new("net")
        .arg("session")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Windows service control (Tier B only)
// ---------------------------------------------------------------------------

fn sc(args: &[&str]) -> Output {
    Command::new("sc")
        .args(args)
        .stdin(Stdio::null())
        .output()
        .unwrap_or_else(|error| panic!("could not run `sc {}`: {error}", args.join(" ")))
}

pub fn service_exists() -> bool {
    sc(&["query", SERVICE_NAME]).status.success()
}

pub fn service_exe() -> PathBuf {
    let current = std::env::current_exe().expect("locate test executable");
    let deps = current.parent().expect("test executable directory");
    let name = format!("focus-service{}", std::env::consts::EXE_SUFFIX);
    for dir in [Some(deps), deps.parent()] {
        let Some(dir) = dir else { continue };
        let candidate = dir.join(&name);
        if candidate.is_file() {
            return candidate;
        }
    }
    panic!(
        "{name} not found next to the test executable; `cargo test` builds test \
         harnesses and examples but not the service binary, so build it first \
         with `cargo build -p focus-service`"
    );
}

pub fn service_install() -> String {
    let exe = service_exe();
    let output = sc(&["create", SERVICE_NAME, "binPath=", &exe.to_string_lossy(), "start=", "demand"]);
    assert!(
        output.status.success(),
        "installing the test-owned service failed: {}",
        String::from_utf8_lossy(&output.stdout)
    );
    SERVICE_NAME.to_string()
}

pub fn service_start() {
    let output = sc(&["start", SERVICE_NAME]);
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    assert!(
        text.contains("RUNNING") || text.contains("START_PENDING") || output.status.success(),
        "starting the test-owned service failed: {text}"
    );
}

pub fn service_stop() {
    let _ = sc(&["stop", SERVICE_NAME]);
    let _ = wait_until(Duration::from_secs(30), Duration::from_millis(200), || {
        let output = sc(&["query", SERVICE_NAME]);
        String::from_utf8_lossy(&output.stdout).contains("STOPPED")
    });
}

pub fn service_delete() {
    let _ = sc(&["delete", SERVICE_NAME]);
}

pub fn wait_until(
    timeout: Duration,
    interval: Duration,
    mut condition: impl FnMut() -> bool,
) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if condition() {
            return Ok(());
        }
        std::thread::sleep(interval);
    }
    if condition() {
        return Ok(());
    }
    Err(format!("condition still false after {timeout:?}"))
}

// ---------------------------------------------------------------------------
// IPC helpers
// ---------------------------------------------------------------------------

pub fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().expect("tokio runtime")
}

pub fn try_ipc(request: IpcRequest, timeout: Duration) -> Option<IpcResponse> {
    runtime()
        .block_on(IpcClient::with_timeout(request, timeout))
        .ok()
}

pub fn ipc(request: IpcRequest, timeout: Duration) -> IpcResponse {
    try_ipc(request, timeout).expect("IPC request failed: the service did not answer")
}

pub fn wait_for_service_ready(timeout: Duration) {
    wait_until(timeout, Duration::from_millis(250), || {
        runtime().block_on(IpcClient::ping())
    })
    .unwrap_or_else(|error| panic!("service never answered: {error}"));
}

pub fn wait_for_status(
    timeout: Duration,
    mut predicate: impl FnMut(&ServiceStatus) -> bool,
) -> ServiceStatus {
    let mut last: Option<ServiceStatus> = None;
    wait_until(timeout, Duration::from_millis(250), || {
        // A transient pipe error during startup or restart is retried, not fatal:
        // the readiness wait already bounds how long that can last.
        match try_ipc(IpcRequest::GetStatus, Duration::from_secs(5)) {
            Some(IpcResponse::Ok {
                data: ResponseData::Status(status),
            }) => {
                let matched = predicate(&status);
                last = Some(status);
                matched
            }
            _ => false,
        }
    })
    .unwrap_or_else(|error| {
        panic!(
            "service status never matched: {error}; last seen: {:?}",
            last.as_ref().map(|status| status.enforcement_mode)
        )
    });
    last.expect("status predicate succeeded without a status")
}

pub fn require_ok(response: IpcResponse, what: &str) {
    match response {
        IpcResponse::Ok { .. } => {}
        IpcResponse::Err { message } => panic!("{what} failed: {message}"),
    }
}

pub fn remove_real_data() {
    for path in sidecar_paths(&default_db_path()) {
        let _ = fs::remove_file(&path);
    }
    if let Some(parent) = default_db_path().parent() {
        let _ = fs::remove_dir(parent);
    }
}

/// Installs the test-owned service and guarantees teardown on every exit path,
/// including a failed assertion. Dropped last, after the session is stopped, so
/// a still-running service cannot restore policy behind cleanup.
pub struct TierBEnvironment {
    installed: bool,
}

impl TierBEnvironment {
    pub fn install() -> Self {
        service_install();
        Self { installed: true }
    }
}

impl Drop for TierBEnvironment {
    fn drop(&mut self) {
        if !self.installed {
            return;
        }
        // Best effort: release the session first, then remove the service.
        let _ = runtime().block_on(IpcClient::with_timeout(
            IpcRequest::StopSession,
            Duration::from_secs(5),
        ));
        service_stop();
        service_delete();
        remove_real_data();
        let _ = wait_until(Duration::from_secs(20), Duration::from_millis(250), || {
            !service_exists()
        });
    }
}
