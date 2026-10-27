//! Dedicated process for the guarded real-enforcement checks.
//!
//! It exists only to be blocked: it starts, does nothing, and never exits on its
//! own, so a normal exit can only mean enforcement closed it (or cleanup did,
//! which the checks rule out by observing the exit before teardown).
//!
//! Never point real enforcement at a user application — this is the one target
//! the harness is allowed to kill.

use std::time::Duration;

fn main() {
    // A child that exits by itself would look like a successful block.
    loop {
        std::thread::sleep(Duration::from_secs(1));
    }
}
