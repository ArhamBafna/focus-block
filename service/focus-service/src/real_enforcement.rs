//! Checks that must be real, and are therefore never reached by a plain
//! `cargo test`. Each test returns immediately unless its tier is requested via
//! `FOCUS_REAL_ENFORCEMENT`, and every path after that is fatal on inconsistency.
//!
//! - Tier A may run on a normal dev PC: it spawns only the dedicated dummy
//!   executable and never touches a Windows service.
//! - Tier B installs, starts, restarts, and deletes its own service, so it only
//!   runs where the harness installed that service on a disposable machine.

use crate::app_enforcement::AppEnforcer;
use crate::session_manager::default_db_path;
use crate::test_support::{
    dummy_exe, ipc, require_ok, service_start, service_stop, wait_for_service_ready,
    wait_for_status, ChildGuard, GuardedRun, Tier, TierBEnvironment,
};
use focus_core::{
    AppBlockTarget, EnforcementMode, IpcRequest, IpcResponse, ResponseData, SessionMode,
    SessionStatus,
};
use focus_store::FocusStore;
use std::time::{Duration, Instant};

const BLOCK_DEADLINE: Duration = Duration::from_secs(10);
const OBSERVE_RELEASED: Duration = Duration::from_secs(6);

fn dummy_target() -> AppBlockTarget {
    AppBlockTarget::Executable {
        path: dummy_exe().to_string_lossy().into_owned(),
    }
}

/// Unguarded: proves the dedicated dummy target exists before any guarded run
/// needs it, so a missing build artifact is a clear failure rather than a
/// skipped check.
///
/// The service binary is deliberately not asserted here. `cargo test` builds
/// examples but not the normal service binary, so requiring it would fail a
/// plain `cargo test` on every clean checkout, on any platform. Only Tier B
/// consumes that binary, and it asserts availability where it installs the
/// test-owned service, on a machine prepared for a real run.
#[test]
fn dedicated_dummy_executable_is_available() {
    let dummy = dummy_exe();
    assert!(
        dummy.is_file(),
        "the dedicated test executable must exist at {} (built by cargo test)",
        dummy.display()
    );
}

#[test]
fn tier_a_dummy_launch_is_terminated_with_kernel_events() {
    let Some(mut run) = GuardedRun::begin(Tier::A) else {
        return;
    };

    let mut enforcer = AppEnforcer::default();
    enforcer
        .apply(std::slice::from_ref(&dummy_target()))
        .expect("applying the dummy target must succeed");
    assert_eq!(
        enforcer.mode(),
        EnforcementMode::KernelEvents,
        "the fast path must be live before a real check runs; the polling fallback is not accepted"
    );

    let mut child = ChildGuard::spawn_dummy();
    let started = Instant::now();
    let status = child.wait_for_exit(BLOCK_DEADLINE);
    let observed = started.elapsed();
    assert!(
        status.is_some(),
        "the dummy process survived {BLOCK_DEADLINE:?}: enforcement never fired"
    );
    assert_eq!(
        child.cleanup_kills(),
        0,
        "a cleanup kill satisfied the blocking assertion"
    );

    enforcer.clear().expect("releasing enforcement must succeed");
    run.record(format!(
        "tier-a: dummy terminated on launch in {observed:?} (deadline {BLOCK_DEADLINE:?})"
    ));
}

#[test]
fn tier_b_service_lifecycle_start_stop_and_restart() {
    let Some(mut run) = GuardedRun::begin(Tier::B) else {
        return;
    };
    let environment = TierBEnvironment::install();

    {
        let store = FocusStore::open(default_db_path()).expect("open the disposable store");
        store
            .add_app_block_target(&dummy_target())
            .expect("seed the dummy target");
    }

    service_start();
    wait_for_service_ready(Duration::from_secs(30));
    run.record("service installed, started, and answering IPC");

    require_ok(
        ipc(
            IpcRequest::StartSession {
                mode: SessionMode::Lockdown,
                duration_minutes: 30,
                preset_id: None,
            },
            Duration::from_secs(15),
        ),
        "start session",
    );
    let status = wait_for_status(Duration::from_secs(20), |status| {
        status.active_session.is_some() && status.enforcement_mode == EnforcementMode::KernelEvents
    });
    let session_id = status
        .active_session
        .as_ref()
        .expect("status reported an active session")
        .session
        .id;
    run.record("start: session active, service reports kernel-event enforcement");

    let mut blocked = ChildGuard::spawn_dummy();
    assert!(
        blocked.wait_for_exit(BLOCK_DEADLINE).is_some(),
        "the dummy survived an active session by a real, test-owned service"
    );
    assert_eq!(
        blocked.cleanup_kills(),
        0,
        "a cleanup kill satisfied the blocking assertion"
    );
    run.record("active session: dummy terminated on launch");

    require_ok(
        ipc(IpcRequest::StopSession, Duration::from_secs(15)),
        "stop session",
    );
    let status = wait_for_status(Duration::from_secs(20), |status| {
        status.active_session.is_none()
    });
    assert_eq!(
        status.enforcement_mode,
        EnforcementMode::Inactive,
        "stopping a session must release enforcement"
    );
    match ipc(
        IpcRequest::ListHistory { limit: 5 },
        Duration::from_secs(15),
    ) {
        IpcResponse::Ok {
            data: ResponseData::Sessions(sessions),
        } => {
            let stopped = sessions
                .iter()
                .find(|session| session.id == session_id)
                .expect("the stopped session must be in history");
            assert_eq!(
                stopped.status,
                SessionStatus::Stopped,
                "history must record a manual stop, not completion"
            );
        }
        other => panic!("listing history failed: {other:?}"),
    }

    let mut released = ChildGuard::spawn_dummy();
    released.assert_alive_for(OBSERVE_RELEASED, "after stopping the session");
    drop(released);
    run.record("stop: dummy released, status inactive, history records the stop");

    require_ok(
        ipc(
            IpcRequest::StartSession {
                mode: SessionMode::Lockdown,
                duration_minutes: 30,
                preset_id: None,
            },
            Duration::from_secs(15),
        ),
        "start session before restart",
    );
    wait_for_status(Duration::from_secs(20), |status| {
        status
            .active_session
            .as_ref()
            .is_some_and(|view| view.session.id == session_id)
            && status.enforcement_mode == EnforcementMode::KernelEvents
    });

    service_stop();
    service_start();
    wait_for_service_ready(Duration::from_secs(60));
    let status = wait_for_status(Duration::from_secs(60), |status| {
        status
            .active_session
            .as_ref()
            .is_some_and(|view| view.session.id == session_id)
            && status.enforcement_mode == EnforcementMode::KernelEvents
    });
    assert_eq!(
        status
            .active_session
            .as_ref()
            .map(|view| view.session.status),
        Some(SessionStatus::Active),
        "the same unexpired session must survive a service restart, not be replaced"
    );

    let mut after_restart = ChildGuard::spawn_dummy();
    assert!(
        after_restart.wait_for_exit(BLOCK_DEADLINE).is_some(),
        "enforcement did not resume after the service restart"
    );
    assert_eq!(
        after_restart.cleanup_kills(),
        0,
        "a cleanup kill satisfied the post-restart assertion"
    );
    run.record("restart: same session restored, enforcement resumed in kernel-event mode");

    drop(environment);
    run.record("cleanup: test-owned service removed and disposable data deleted");
}
