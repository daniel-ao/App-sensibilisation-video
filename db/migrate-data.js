#!/usr/bin/env node
/**
 * One-time migration script (Step 3).
 * - Reads data.csv (sessions) and data.json (aggregated user metrics)
 * - Inserts into SQLite tables: sessions, users
 *
 * Features:
 * - DRY_RUN=1 environment variable for no-write preview
 * - Idempotent UPSERT for users
 * - Fallback lightweight CSV parsing if csv-parse isn't installed
 * - Defensive field normalization with comments for future adjustments
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DRY_RUN = process.env.DRY_RUN === '1';
const CWD = process.cwd();
const dbPath = path.join(__dirname, 'database.db');
const csvPath = path.join(CWD, 'data.csv');
const jsonPath = path.join(CWD, 'data.json');

function existsFile(p) { return fs.existsSync(p) && fs.statSync(p).isFile(); }

if (!existsFile(dbPath)) {
  console.error('[ERROR] database.db not found. Run: npm run db:init');
  process.exit(1);
}

if (!existsFile(csvPath)) console.warn('[WARN] data.csv not found. Skipping sessions migration.');
if (!existsFile(jsonPath)) console.warn('[WARN] data.json not found. Skipping users migration.');

const db = new Database(dbPath);
// Performance pragmas (already set during init; safe to repeat)
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// --- CSV Parsing ---
function parseCSV(raw) {
  try {
    const { parse } = require('csv-parse/sync');
    return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    // Minimal fallback – does NOT handle quoted commas
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines.shift().split(',').map(h => h.trim());
    return lines.map(line => {
      const cols = line.split(',').map(c => c.trim());
      const record = {};
      headers.forEach((h, i) => { record[h] = cols[i] ?? ''; });
      return record;
    });
  }
}

// --- Normalizers ---
// Map CSV row to the schema used when we created sessions table.
function normalizeSession(row) {
  // Source columns (confirmed from data.csv header):
  // user,category1,videoName1,videoPath1,resolution1,category2,videoName2,videoPath2,resolution2,QO1,QO2,QO3,QO4,QO5,comments,screenType,timestamp
  return {
    user: row.user || 'unknown',
    category1: row.category1 || null,
    videoName1: row.videoName1 || null,
    videoPath1: row.videoPath1 || null,
    resolution1: row.resolution1 || null,
    category2: row.category2 || null,
    videoName2: row.videoName2 || null,
    videoPath2: row.videoPath2 || null,
    resolution2: row.resolution2 || null,
    QO1: row.QO1 || null,
    QO2: row.QO2 || null,
    QO3: row.QO3 || null,
    QO4: row.QO4 || null,
    QO5: row.QO5 || null,
    comments: row.comments || null,
    screenType: row.screenType || null,
    timestamp: row.timestamp || new Date().toISOString()
  };
}

// data.json structure contains: scores, times, precisions
function extractUsersFromJSON(jsonObj) {
  const users = new Map();
  if (jsonObj.scores) {
    for (const [pseudo, score] of Object.entries(jsonObj.scores)) {
      if (!users.has(pseudo)) users.set(pseudo, { pseudo, totalScore: 0, totalTime: 0, sessionCount: 0 });
      users.get(pseudo).totalScore += Number(score) || 0;
    }
  }
  if (jsonObj.times) {
    for (const [pseudo, time] of Object.entries(jsonObj.times)) {
      if (!users.has(pseudo)) users.set(pseudo, { pseudo, totalScore: 0, totalTime: 0, sessionCount: 0 });
      users.get(pseudo).totalTime += Number(time) || 0;
    }
  }
  if (jsonObj.precisions) {
    for (const [pseudo, obj] of Object.entries(jsonObj.precisions)) {
      if (!users.has(pseudo)) users.set(pseudo, { pseudo, totalScore: 0, totalTime: 0, sessionCount: 0 });
      // Treat sessions count as sessionCount aggregation
      const sessions = obj.sessions || 0;
      users.get(pseudo).sessionCount += Number(sessions) || 0;
    }
  }
  return Array.from(users.values());
}

// --- Prepared Statements ---
const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (
    user, category1, videoName1, videoPath1, resolution1,
    category2, videoName2, videoPath2, resolution2,
    QO1, QO2, QO3, QO4, QO5,
    comments, screenType, timestamp
  ) VALUES (@user, @category1, @videoName1, @videoPath1, @resolution1,
            @category2, @videoName2, @videoPath2, @resolution2,
            @QO1, @QO2, @QO3, @QO4, @QO5,
            @comments, @screenType, @timestamp)
`);

const upsertUserStmt = db.prepare(`
  INSERT INTO users (pseudo, totalScore, totalTime, sessionCount)
  VALUES (@pseudo, @totalScore, @totalTime, @sessionCount)
  ON CONFLICT(pseudo) DO UPDATE SET
    totalScore = excluded.totalScore,
    totalTime = excluded.totalTime,
    sessionCount = excluded.sessionCount
`);

let sessionCount = 0;
let userCount = 0;

// Transaction wrapper
const migrate = db.transaction(() => {
  if (existsFile(csvPath)) {
    const rawCSV = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(rawCSV);
    rows.forEach(r => {
      const normalized = normalizeSession(r);
      if (!DRY_RUN) insertSessionStmt.run(normalized);
      sessionCount++;
    });
  }
  if (existsFile(jsonPath)) {
    const rawJSON = fs.readFileSync(jsonPath, 'utf8');
    let parsed;
    try { parsed = JSON.parse(rawJSON); }
    catch (e) { console.error('[ERROR] Failed to parse data.json:', e.message); process.exit(1); }
    const users = extractUsersFromJSON(parsed);
    users.forEach(u => {
      if (!DRY_RUN) upsertUserStmt.run(u);
      userCount++;
    });
  }
});

migrate();

console.log(`Migration ${DRY_RUN ? '(DRY RUN) ' : ''}complete.`);
console.log(`  Sessions processed: ${sessionCount}`);
console.log(`  Users processed:    ${userCount}`);
if (DRY_RUN) console.log('No writes performed (dry run).');

db.close();
