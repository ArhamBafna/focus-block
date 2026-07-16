pub const SCHEMA: &str = r"
CREATE TABLE IF NOT EXISTS blocklist_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whitelist_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    blocklist_json TEXT NOT NULL DEFAULT '[]',
    whitelist_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    preset_id TEXT,
    mode TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    planned_duration_sec INTEGER NOT NULL,
    status TEXT NOT NULL,
    blocklist_snapshot TEXT NOT NULL DEFAULT '[]',
    whitelist_snapshot TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

";

pub const SEED_PRESETS: &[(&str, &str, u32, &str)] = &[
    (
        "Deep Work",
        "blocklist",
        25,
        r#"["youtube.com","reddit.com","instagram.com","twitter.com","tiktok.com"]"#,
    ),
    ("Study", "blocklist", 50, r#"["youtube.com","reddit.com","instagram.com"]"#),
    ("Offline Focus", "lockdown", 30, "[]"),
];
