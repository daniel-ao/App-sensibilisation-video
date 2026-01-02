const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH } = require('../config');

// Open the SQLite database located at the path defined in config
function openDb() {
  try {
    // Ensure the directory exists before attempting to open
    const fs = require('fs');
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open in read-write mode to support both queries and updates
    return new Database(DB_PATH);
  } catch (e) {
    console.error('Failed to open SQLite database at', DB_PATH, e);
    throw e;
  }
}

function getSummary() {
  const db = openDb();
  try {
    const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name").all();
    const tables = tableRows.map(t => t.name);
    const hasSessions = tables.includes('sessions');
    const hasUsers = tables.includes('users');
    const sessionCount = hasSessions ? (db.prepare('SELECT COUNT(*) as c FROM sessions').get()?.c || 0) : 0;
    const userCount = hasUsers ? (db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0) : 0;
    const latestSession = hasSessions ? (db.prepare('SELECT timestamp FROM sessions ORDER BY timestamp DESC LIMIT 1').get()?.timestamp || null) : null;
    return {
      database: path.basename(DB_PATH),
      tables,
      counts: { sessions: sessionCount, users: userCount },
      latestSession
    };
  } finally {
    db.close();
  }
}

function sanitizeSort(sortBy, sortDir) {
  const columns = new Set(['id','user','category1','videoName1','resolution1','category2','videoName2','resolution2','screenType','timestamp']);
  const dir = (String(sortDir || '').toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
  return { col: columns.has(sortBy) ? sortBy : 'datetime(timestamp)', dir };
}

function getSessions({ q = '', limit = 50, offset = 0, startDate = '', endDate = '', resolution = '', sortBy = '', sortDir = '' } = {}) {
  const db = openDb();
  try {
    const hasSessions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
    if (!hasSessions) { return { total: 0, rows: [] }; }
    const like = `%${q}%`;
    const clauses = [];
    const params = { like, limit, offset };
    if (q) {
      clauses.push(`(user LIKE @like OR category1 LIKE @like OR videoName1 LIKE @like OR videoName2 LIKE @like OR resolution1 LIKE @like OR resolution2 LIKE @like OR screenType LIKE @like)`);
    }
    if (startDate) {
      params.start = `${startDate}T00:00:00.000Z`;
      clauses.push(`timestamp >= @start`);
    }
    if (endDate) {
      params.end = `${endDate}T23:59:59.999Z`;
      clauses.push(`timestamp <= @end`);
    }
    if (resolution) {
      params.res = resolution;
      clauses.push(`(resolution1 = @res OR resolution2 = @res)`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const sort = sanitizeSort(sortBy, sortDir);
    const orderBy = sort.col === 'datetime(timestamp)' ? 'ORDER BY datetime(timestamp) ' + sort.dir : `ORDER BY ${sort.col} ${sort.dir}`;

    const total = db.prepare(`SELECT COUNT(*) as c FROM sessions ${where}`).get(params)?.c || 0;
    const rows = db.prepare(`
      SELECT id, user, category1, videoName1, resolution1, category2, videoName2, resolution2, screenType, timestamp
      FROM sessions
      ${where}
      ${orderBy}
      LIMIT @limit OFFSET @offset
    `).all(params);
    return { total, rows };
  } finally {
    db.close();
  }
}

function getUsers({ q = '', limit = 50, offset = 0 } = {}) {
  const db = openDb();
  try {
    const hasUsers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!hasUsers) { return { total: 0, rows: [] }; }
    const like = `%${q}%`;
    const where = q ? `WHERE pseudo LIKE @like` : '';
    const total = db.prepare(`SELECT COUNT(*) as c FROM users ${where}`).get({ like })?.c || 0;
    const rows = db.prepare(`
      SELECT pseudo, email, is_admin, totalScore, totalTime, sessionCount
      FROM users
      ${where}
      ORDER BY pseudo COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `).all({ like, limit, offset });
    return { total, rows };
  } finally {
    db.close();
  }
}

function getResolutions() {
  const db = openDb();
  try {
    const hasSessions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
    if (!hasSessions) return [];
    const rows = db.prepare(`
      SELECT resolution1 AS res FROM sessions WHERE resolution1 IS NOT NULL AND resolution1 <> ''
      UNION
      SELECT resolution2 AS res FROM sessions WHERE resolution2 IS NOT NULL AND resolution2 <> ''
    `).all();
    const order = { '144p':1,'240p':2,'360p':3,'480p':4,'720p':5,'1080p':6,'4k':7 };
    return rows.map(r=>r.res).sort((a,b)=> (order[a]||999)-(order[b]||999));
  } finally {
    db.close();
  }
}

function getSessionById(id) {
  const db = openDb();
  try {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return row || null;
  } finally {
    db.close();
  }
}

/**
 * Insert a session record into the sessions table.
 * Expects keys compatible with the schema created in db/init-database.js
 */
function insertSession(record) {
  const db = openDb();
  try {
    const stmt = db.prepare(`
      INSERT INTO sessions (
        user, category1, videoName1, videoPath1, resolution1,
        category2, videoName2, videoPath2, resolution2,
        QO1, QO2, QO3, QO4,
        comments, screenType, timestamp
      ) VALUES (
        @user, @category1, @videoName1, @videoPath1, @resolution1,
        @category2, @videoName2, @videoPath2, @resolution2,
        @QO1, @QO2, @QO3, @QO4,
        @comments, @screenType, @timestamp
      )
    `);
    stmt.run({
      user: record.user || '',
      category1: record.category1 || '',
      videoName1: record.videoName1 || '',
      videoPath1: record.videoPath1 || '',
      resolution1: record.resolution1 || '',
      category2: record.category2 || '',
      videoName2: record.videoName2 || '',
      videoPath2: record.videoPath2 || '',
      resolution2: record.resolution2 || '',
      QO1: record.QO1 || '',
      QO2: record.QO2 || '',
      QO3: record.QO3 || '',
      QO4: record.QO4 || '',
      comments: record.comments || '',
      screenType: record.screenType || '',
      timestamp: record.timestamp || new Date().toISOString()
    });
  } finally {
    db.close();
  }
}

function ensureUser(pseudo) {
  const db = openDb();
  try {
    const normalizedPseudo = pseudo.toLowerCase();
    const insert = db.prepare(`INSERT INTO users (pseudo, totalScore, totalTime, sessionCount) VALUES (?, 0, 0, 0)
      ON CONFLICT(pseudo) DO NOTHING`);
    insert.run(normalizedPseudo);
  } finally {
    db.close();
  }
}

function incrementSessionCount(pseudo) {
  const db = openDb();
  try {
    const normalizedPseudo = pseudo.toLowerCase();
    const stmt = db.prepare(`
      UPDATE users 
      SET sessionCount = sessionCount + 1 
      WHERE pseudo = ?
    `);
    stmt.run(normalizedPseudo);
  } finally {
    db.close();
  }
}

function checkUserExists(pseudo) {
  const db = openDb();
  try {
    const normalizedPseudo = pseudo.toLowerCase();
    const row = db.prepare('SELECT 1 FROM users WHERE pseudo = ?').get(normalizedPseudo);
    return !!row;
  } finally {
    db.close();
  }
}

function registerUser({ pseudo, email, passwordHash }) {
  const db = openDb();
  try {
    const normalizedPseudo = pseudo.toLowerCase();
    
    // Check if user exists first
    const existing = db.prepare('SELECT password_hash FROM users WHERE pseudo = ?').get(normalizedPseudo);
    
    if (existing) {
        if (existing.password_hash) {
            // Already registered
            throw new Error('Pseudo already exists');
        } else {
            // Guest account - Upgrade it
            const stmt = db.prepare(`
                UPDATE users 
                SET email = @email, password_hash = @passwordHash 
                WHERE pseudo = @pseudo
            `);
            stmt.run({ pseudo: normalizedPseudo, email, passwordHash });
            return { success: true };
        }
    } else {
        // New user
        const stmt = db.prepare(`
          INSERT INTO users (pseudo, email, password_hash, totalScore, totalTime, sessionCount)
          VALUES (@pseudo, @email, @passwordHash, 0, 0, 0)
        `);
        stmt.run({ pseudo: normalizedPseudo, email, passwordHash });
        return { success: true };
    }
  } catch (err) {
    if (err.message === 'Pseudo already exists') throw err;
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        throw new Error('Pseudo already exists');
    }
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Email already exists');
    }
    throw err;
  } finally {
    db.close();
  }
}

function getUserCredentials(pseudo) {
  const db = openDb();
  try {
    const normalizedPseudo = pseudo.toLowerCase();
    const row = db.prepare('SELECT pseudo, password_hash, is_admin FROM users WHERE lower(pseudo) = ?').get(normalizedPseudo);
    return row;
  } finally {
    db.close();
  }
}

function setScore(pseudo, score) {
  const db = openDb();
  try {
    // We want to ACCUMULATE score in the DB.
    const normalizedPseudo = pseudo.toLowerCase();
    const upsert = db.prepare(`
      INSERT INTO users(pseudo, totalScore, totalTime, sessionCount)
      VALUES(@pseudo, @score, 0, 0)
      ON CONFLICT(pseudo) DO UPDATE SET totalScore = totalScore + excluded.totalScore
    `);
    upsert.run({ pseudo: normalizedPseudo, score: Number(score) || 0 });
  } finally {
    db.close();
  }
}

function getScore(pseudo) {
  const db = openDb();
  try {
    const normalizedPseudo = pseudo.toLowerCase();
    const row = db.prepare('SELECT totalScore FROM users WHERE pseudo = ?').get(normalizedPseudo);
    return row ? row.totalScore : 0;
  } finally {
    db.close();
  }
}

function setTime(pseudo, time) {
  const db = openDb();
  try {
    // Same logic for time, accumulate it
    const normalizedPseudo = pseudo.toLowerCase();
    const upsert = db.prepare(`
      INSERT INTO users(pseudo, totalScore, totalTime, sessionCount)
      VALUES(@pseudo, 0, @time, 0)
      ON CONFLICT(pseudo) DO UPDATE SET totalTime = totalTime + excluded.totalTime
    `);
    upsert.run({ pseudo: normalizedPseudo, time: Number(time) || 0 });
  } finally {
    db.close();
  }
}

function getTime(pseudo) {
  const db = openDb();
  try {
    const normalizedPseudo = pseudo.toLowerCase();
    const row = db.prepare('SELECT totalTime FROM users WHERE pseudo = ?').get(normalizedPseudo);
    return row ? row.totalTime : 0;
  } finally {
    db.close();
  }
}

function computeGlobalAveragePrecision() {
  const db = openDb();
  try {
    const rows = db.prepare('SELECT user, resolution1, resolution2, QO1 FROM sessions').all();
    const perUser = new Map();
    for (const r of rows) {
      const u = (r.user || '').trim();
      if (!u) continue;
      const entry = perUser.get(u) || { correct: 0, total: 0 };
      const parts = String(r.QO1 || '').replace(/[()]/g, '').split(',');
      const p1 = (parts[0] || '').trim();
      const p2 = (parts[1] || '').trim();
      const res1 = (r.resolution1 || '').trim();
      const res2 = (r.resolution2 || '').trim();
      if (res1 && p1) {
        entry.total += 1;
        if (res1 === p1) entry.correct += 1;
      }
      if (res2 && p2) {
        entry.total += 1;
        if (res2 === p2) entry.correct += 1;
      }
      perUser.set(u, entry);
    }
    let users = 0;
    let sum = 0;
    for (const [, v] of perUser.entries()) {
      if (v.total > 0) {
        users += 1;
        sum += (v.correct / v.total) * 100;
      }
    }
    const moyenne = users > 0 ? sum / users : 0;
    return { moyenne, utilisateurs: users };
  } finally {
    db.close();
  }
}

function linkGuestData(oldPseudo, newPseudo) {
  const db = openDb();
  
  const transaction = db.transaction(() => {
    const normalizedOld = oldPseudo.toLowerCase();
    const normalizedNew = newPseudo.toLowerCase();

    // 1. Move sessions
    const info = db.prepare('UPDATE sessions SET user = ? WHERE user = ?').run(normalizedNew, normalizedOld);
    const sessionChanges = info.changes;

    // 2. Handle Users table (Merge or Rename)
    const oldUser = db.prepare('SELECT totalScore, totalTime, sessionCount FROM users WHERE pseudo = ?').get(normalizedOld);
    
    if (oldUser) {
        const newUser = db.prepare('SELECT 1 FROM users WHERE pseudo = ?').get(normalizedNew);

        if (newUser) {
            // Target user exists: MERGE stats and DELETE old user
            db.prepare(`
                UPDATE users 
                SET totalScore = totalScore + @score,
                    totalTime = totalTime + @time,
                    sessionCount = sessionCount + @count
                WHERE pseudo = @newPseudo
            `).run({
                score: oldUser.totalScore || 0,
                time: oldUser.totalTime || 0,
                count: oldUser.sessionCount || 0,
                newPseudo: normalizedNew
            });
            
            db.prepare('DELETE FROM users WHERE pseudo = ?').run(normalizedOld);
        } else {
            // Target user does not exist: RENAME old user
            db.prepare('UPDATE users SET pseudo = ? WHERE pseudo = ?').run(normalizedNew, normalizedOld);
        }
    }
    
    return { changes: sessionChanges };
  });

  try {
    return transaction();
  } finally {
    db.close();
  }
}

function updateUserRole(pseudo, isAdmin) {
  const db = openDb();
  try {
    const normalizedPseudo = pseudo.toLowerCase();
    const stmt = db.prepare('UPDATE users SET is_admin = ? WHERE pseudo = ?');
    stmt.run(isAdmin ? 1 : 0, normalizedPseudo);
  } finally {
    db.close();
  }
}

module.exports = {
  getSummary,
  getSessions,
  getUsers,
  getResolutions,
  getSessionById,
  insertSession,
  setScore,
  getScore,
  setTime,
  getTime,
  computeGlobalAveragePrecision,
  ensureUser,
  checkUserExists,
  registerUser,
  getUserCredentials,
  linkGuestData,
  incrementSessionCount,
  updateUserRole
};