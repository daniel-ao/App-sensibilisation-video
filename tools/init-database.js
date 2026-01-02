// File: db/init-database.js
// Purpose: Create and initialize the SQLite database schema.

/*
Contract
- Inputs: none (uses local file ./db/database.db)
- Side effects: creates db/database.db if absent; ensures tables & indexes exist
- Success criteria: process exits without error; tables listed in sqlite_master
- Debug: uses verbose SQL logging; prints next steps on completion
*/

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Resolve DB file path inside this db/ folder regardless of CWD
const dbPath = path.join(__dirname, 'database.db');

// Ensure the db directory exists (it should, but be defensive)
fs.mkdirSync(__dirname, { recursive: true });

// Open (and create if needed) the database. Verbose logs SQL statements.
const db = new Database(dbPath, { verbose: console.log });
console.log(`Database connected/created at: ${dbPath}`);

// Apply useful pragmas for durability/performance
// WAL improves concurrency; foreign_keys enforces constraints
const pragmas = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`;

db.exec(pragmas);

// Schema design
// 1) sessions table mirrors the CSV header exactly, with an auto id.
// CSV headers observed:
// user,category1,videoName1,videoPath1,resolution1,category2,videoName2,videoPath2,resolution2,QO1,QO2,QO3,QO4,comments,screenType,timestamp

const createTables = `
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT NOT NULL,
    category1 TEXT,
    videoName1 TEXT,
    videoPath1 TEXT,
    resolution1 TEXT,
    category2 TEXT,
    videoName2 TEXT,
    videoPath2 TEXT,
    resolution2 TEXT,
    QO1 TEXT,
    QO2 TEXT,
    QO3 TEXT,
    QO4 TEXT,
    comments TEXT,
    screenType TEXT,
    timestamp TEXT NOT NULL
  );

  -- Basic indexes for common lookups
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user);
  CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp);

  -- 2) users table to replace aggregated data from data.json
  -- pseudo is the unique identifier for a user. Aggregates can be rebuilt from sessions
  -- but we store convenient totals as requested.
  CREATE TABLE IF NOT EXISTS users (
    pseudo TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    is_admin INTEGER DEFAULT 0,
    totalScore INTEGER DEFAULT 0,
    totalTime INTEGER DEFAULT 0,
    sessionCount INTEGER DEFAULT 0
  );
`;

db.exec(createTables);

// --- Post-creation: Triggers and Default Data ---

// 1. Triggers to protect MAIN ADMIN
const createTriggers = `
  CREATE TRIGGER IF NOT EXISTS prevent_admin_deletion
  BEFORE DELETE ON users
  FOR EACH ROW
  WHEN OLD.pseudo = 'main_admin'
  BEGIN
      SELECT RAISE(ABORT, 'Cannot delete the MAIN ADMIN account.');
  END;

  CREATE TRIGGER IF NOT EXISTS prevent_admin_demotion
  BEFORE UPDATE OF is_admin ON users
  FOR EACH ROW
  WHEN OLD.pseudo = 'main_admin' AND NEW.is_admin != 1
  BEGIN
      SELECT RAISE(ABORT, 'Cannot remove admin status from MAIN ADMIN account.');
  END;

  CREATE TRIGGER IF NOT EXISTS prevent_admin_rename
  BEFORE UPDATE OF pseudo ON users
  FOR EACH ROW
  WHEN OLD.pseudo = 'main_admin' AND NEW.pseudo != 'main_admin'
  BEGIN
      SELECT RAISE(ABORT, 'Cannot rename the MAIN ADMIN account.');
  END;
`;

db.exec(createTriggers);

// 2. Ensure MAIN ADMIN exists
// We use a simple hash for the default password 'terranumerica2025'
// SHA256('terranumerica2025') = 
// eb2130df152aa51292b5fb1da3235129ee9b7e581a8dbc0d84927c1e6f067c24
const insertMainAdmin = `
  INSERT INTO users (pseudo, email, password_hash, is_admin)
  VALUES ('main_admin', 'admin@example.com', 'eb2130df152aa51292b5fb1da3235129ee9b7e581a8dbc0d84927c1e6f067c24', 1)
  ON CONFLICT(pseudo) DO UPDATE SET
      is_admin = 1;
`;

db.exec(insertMainAdmin);

console.log("Tables 'sessions' and 'users' created successfully (if they already existed, nothing changed).");
console.log("Triggers and MAIN ADMIN account ensured.");

// Optional sanity check: list tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Existing tables:', tables.map(t => t.name));

// Close the database.
db.close();
console.log('Database connection closed. You can now use this DB from your services.');

// Developer hint: run `npm run db:init` (added by us) or `node db/init-database.js` to rebuild schema if needed.
