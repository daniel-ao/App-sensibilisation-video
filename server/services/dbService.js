const path = require('path');
const Database = require('better-sqlite3');

// Open the SQLite database located at db/database.db (relative to repo root)
const dbPath = path.join(__dirname, '..', '..', 'db', 'database.db');

function openDb() {
  try {
    return new Database(dbPath, { readonly: true });
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
