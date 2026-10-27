use focus_core::{AppBlockTarget, BlockedAppEvent, EnforcementMode};

/// The smallest seam between session bookkeeping and real process enforcement.
///
/// Production uses [`crate::app_enforcement::AppEnforcer`], which subscribes to
/// the Windows kernel process-start feed and terminates matches. Tests must be
/// able to substitute a recorder that touches nothing on the machine: merely
/// constructing a `SessionManager` against an active saved session re-applies
/// enforcement, so the fake has to be injectable at construction.
pub trait Enforcement: Send {
    fn apply(&mut self, targets: &[AppBlockTarget]) -> Result<(), String>;

    fn tick(&mut self) -> Result<(), String>;

    fn clear(&mut self) -> Result<(), String>;

    fn last_blocked_app(&self) -> Option<BlockedAppEvent>;

    fn clear_last_blocked_app(&mut self);

    /// Which mechanism is actually enforcing right now. This is the only way a
    /// caller can tell instant kernel-event blocking from the 2.5s sweep.
    fn mode(&self) -> EnforcementMode;
}
