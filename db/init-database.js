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
// user,category1,videoName1,videoPath1,resolution1,category2,videoName2,videoPath2,resolution2,QO1,QO2,QO3,QO4,QO5,comments,screenType,timestamp

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
    QO5 TEXT,
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
    totalScore INTEGER DEFAULT 0,
    totalTime INTEGER DEFAULT 0,
    sessionCount INTEGER DEFAULT 0
  );
`;

db.exec(createTables);

console.log("Tables 'sessions' and 'users' created successfully (if they already existed, nothing changed).");

// Optional sanity check: list tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Existing tables:', tables.map(t => t.name));

// Close the database.
db.close();
console.log('Database connection closed. You can now use this DB from your services.');

// Developer hint: run `npm run db:init` (added by us) or `node db/init-database.js` to rebuild schema if needed.
