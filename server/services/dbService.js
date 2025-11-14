const path = require('path');
const Database = require('better-sqlite3');

// Open the SQLite database located at db/database.db (relative to repo root)
const dbPath = path.join(__dirname, '..', '..', 'db', 'database.db');

function openDb() {
  try {
    // Open in read-write mode to support both queries and updates
    return new Database(dbPath);
  } catch (e) {
    console.error('Failed to open SQLite database at', dbPath, e);
    throw e;
  }
}

function getSummary() {
  const db = openDb();
  try {
    const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const tables = tableRows.map(t => t.name);
    const hasSessions = tables.includes('sessions');
    const hasUsers = tables.includes('users');
    const sessionCount = hasSessions ? (db.prepare('SELECT COUNT(*) as c FROM sessions').get()?.c || 0) : 0;
    const userCount = hasUsers ? (db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0) : 0;
    const latestSession = hasSessions ? (db.prepare('SELECT timestamp FROM sessions ORDER BY timestamp DESC LIMIT 1').get()?.timestamp || null) : null;
    return {
      database: path.basename(dbPath),
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
      SELECT pseudo, totalScore, totalTime, sessionCount
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

module.exports = { getSummary, getSessions, getUsers, getResolutions, getSessionById };
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
        QO1, QO2, QO3, QO4, QO5,
        comments, screenType, timestamp
      ) VALUES (
        @user, @category1, @videoName1, @videoPath1, @resolution1,
        @category2, @videoName2, @videoPath2, @resolution2,
        @QO1, @QO2, @QO3, @QO4, @QO5,
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
      QO5: record.QO5 || '',
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
    const insert = db.prepare(`INSERT INTO users (pseudo, totalScore, totalTime, sessionCount) VALUES (?, 0, 0, 0)
      ON CONFLICT(pseudo) DO NOTHING`);
    insert.run(pseudo);
  } finally {
    db.close();
  }
}

function setScore(pseudo, score) {
  const db = openDb();
  try {
    const upsert = db.prepare(`
      INSERT INTO users(pseudo, totalScore, totalTime, sessionCount)
      VALUES(@pseudo, @score, 0, 0)
      ON CONFLICT(pseudo) DO UPDATE SET totalScore = excluded.totalScore
    `);
    upsert.run({ pseudo, score: Number(score) || 0 });
  } finally {
    db.close();
  }
}

function getScore(pseudo) {
  const db = openDb();
  try {
    const row = db.prepare('SELECT totalScore FROM users WHERE pseudo = ?').get(pseudo);
    return row ? row.totalScore : 0;
  } finally {
    db.close();
  }
}

function setTime(pseudo, time) {
  const db = openDb();
  try {
    const upsert = db.prepare(`
      INSERT INTO users(pseudo, totalScore, totalTime, sessionCount)
      VALUES(@pseudo, 0, @time, 0)
      ON CONFLICT(pseudo) DO UPDATE SET totalTime = excluded.totalTime
    `);
    upsert.run({ pseudo, time: Number(time) || 0 });
  } finally {
    db.close();
  }
}

function getTime(pseudo) {
  const db = openDb();
  try {
    const row = db.prepare('SELECT totalTime FROM users WHERE pseudo = ?').get(pseudo);
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
  computeGlobalAveragePrecision
};
