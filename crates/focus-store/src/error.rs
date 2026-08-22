use std::io;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    /// A single row is unreadable (e.g. corrupt id). Callers skip the row and
    /// keep serving the rest of the list instead of failing the whole read.
    #[error("corrupt database row: {0}")]
    CorruptRow(String),
    #[error("{0}")]
    Message(String),
}
