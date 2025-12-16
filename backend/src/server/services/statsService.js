// Step 5: SQL-based statistics service
// ------------------------------------
// This refactor replaces full-file reads & JS loops with direct SQLite aggregation queries.
// We keep export function names for API compatibility.
// NOTE: QO1 holds perceived resolution pair; QO2 holds satisfaction pair.
// Data normalization (fix-qo-fields.js) cleaned most malformed rows.

const path = require('path');
const Database = require('better-sqlite3');
const { RESOLUTION_ORDER, DB_PATH } = require('../config'); 

//const dbPath = path.join(__dirname, '..', '..', 'db', 'database.db');

function openDb() { return new Database(DB_PATH, { readonly: true });  }
// Normalize raw screenType values into canonical buckets used by front-end.


// Accepted outputs: 'pc', 'tablet', 'mobile', 'inconnu'
function normalizeDevice(raw) {
    if (!raw) return 'inconnu';
    const v = raw.toString().trim().toLowerCase();
    // French + English synonyms
    if (/(tablet|tablette|ipad)/.test(v)) return 'tablet';
    if (/(mobile|phone|tel|tél|smartphone|iphone|android)/.test(v)) return 'mobile';
    if (/(pc|desktop|ordinateur|ordi|laptop|mac)/.test(v)) return 'pc';
    // Heuristic: very long strings with no device keyword -> inconnu
    if (v.length > 32) return 'inconnu';
    return 'inconnu';
}

// Helper retained for video-based stats
function parseVideoPath(filePath) {
    if (!filePath || typeof filePath !== 'string') return { category: '', videoName: '' };
    const parts = filePath.split('/');
    const videoName = decodeURIComponent(parts[parts.length - 2] || '');
    const category = decodeURIComponent(parts[parts.length - 3] || '');
    return { category, videoName };
}

// Utility to split a pair like "(a,b)" using SQLite string functions inside queries.
// We replicate splitting logic directly in SQL; JS helpers only post-process row sets.

function calculateUserPrecision(username) {
    const db = openDb();
    try {
        const stmt = db.prepare(`
            WITH base AS (
                SELECT
                    resolution1, resolution2,
                    TRIM(REPLACE(REPLACE(REPLACE(QO1,'"',''),'(',''),')','')) AS pair
                FROM sessions
                WHERE LOWER(user) = LOWER(?)
            ), parts AS (
                SELECT
                    resolution1, resolution2, pair,
                    TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END)) AS p1,
                    TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END)) AS p2
                FROM base
            ), metrics AS (
                SELECT
                    SUM(CASE WHEN resolution1<>'' AND p1<>'' THEN 1 ELSE 0 END) AS total1,
                    SUM(CASE WHEN resolution2<>'' AND p2<>'' THEN 1 ELSE 0 END) AS total2,
                    SUM(CASE WHEN resolution1<>'' AND p1<>'' AND resolution1 = p1 THEN 1 ELSE 0 END) AS correct1,
                    SUM(CASE WHEN resolution2<>'' AND p2<>'' AND resolution2 = p2 THEN 1 ELSE 0 END) AS correct2
                FROM parts
            )
            SELECT (total1 + total2) AS total, (correct1 + correct2) AS correct FROM metrics;
        `);
        const row = stmt.get(username) || { total: 0, correct: 0 };
        return row.total > 0 ? (row.correct / row.total) * 100 : 0;
    } finally { db.close(); }
}

function getGlobalSatisfaction() {
    
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT resolution1, resolution2,
                             TRIM(REPLACE(REPLACE(REPLACE(QO2,'"',''),'(',''),')','')) AS pair
                FROM sessions
                WHERE QO2 IS NOT NULL AND QO2 <> ''
            ), split AS (
                SELECT resolution1 AS resolution,
                             TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END)) AS satisfaction
                FROM base
                UNION ALL
                SELECT resolution2,
                             TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END))
                FROM base
            )
            SELECT LOWER(satisfaction) AS satisfaction, resolution, COUNT(*) AS count
            FROM split
            WHERE resolution <> '' AND satisfaction <> ''
            GROUP BY resolution, satisfaction
            ORDER BY resolution, satisfaction;
        `).all();
        // Transform to legacy shape: { resolution: { satisfaction: count } }
        const acc = {};
        for (const r of rows) {
            if (!acc[r.resolution]) acc[r.resolution] = {};
            acc[r.resolution][r.satisfaction] = r.count;
        }
        return acc;
    } finally { db.close(); }
}

function getGlobalSatisfactionByDevice() {
    console.log('********+++++++++++++++++++++++++++++++***********************');
    
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT resolution1, resolution2, screenType,
                             TRIM(REPLACE(REPLACE(REPLACE(QO2,'"',''),'(',''),')','')) AS pair
                FROM sessions
                WHERE QO2 IS NOT NULL AND QO2 <> ''
            ), split AS (
                SELECT resolution1 AS resolution, screenType,
                             TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END)) AS satisfaction
                FROM base
                UNION ALL
                SELECT resolution2, screenType,
                             TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END))
                FROM base
            )
            SELECT LOWER(satisfaction) AS satisfaction, resolution, screenType, COUNT(*) AS count
            FROM split
            WHERE resolution <> '' AND satisfaction <> '' AND screenType <> ''
            GROUP BY resolution, screenType, satisfaction;
        `).all();
        // Shape: { resolution: { screenType: { satisfaction: count } } }
        const acc = {};
        for (const r of rows) {
            const device = normalizeDevice(r.screenType);
            if (!acc[r.resolution]) acc[r.resolution] = {};
            if (!acc[r.resolution][device]) acc[r.resolution][device] = {};
            acc[r.resolution][device][r.satisfaction] = (acc[r.resolution][device][r.satisfaction] || 0) + r.count;
        }
        return acc;
    } finally { db.close(); }
}

function getConfusions(username) {
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT user, resolution1, resolution2,
                             TRIM(REPLACE(REPLACE(REPLACE(QO1,'"',''),'(',''),')','')) AS pair
                FROM sessions
                WHERE QO1 IS NOT NULL AND QO1 <> ''
                    ${username ? 'AND LOWER(user) = LOWER(?)' : ''}
            ), parts AS (
                SELECT resolution1, resolution2, pair,
                             TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END)) AS p1,
                             TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END)) AS p2
                FROM base
            ), mismatches AS (
                SELECT resolution1 AS realRes, p1 AS perceived FROM parts WHERE resolution1<>'' AND p1<>'' AND resolution1 <> p1
                UNION ALL
                SELECT resolution2 AS realRes, p2 AS perceived FROM parts WHERE resolution2<>'' AND p2<>'' AND resolution2 <> p2
            )
            SELECT realRes || ' → ' || perceived AS pair, COUNT(*) AS count
            FROM mismatches
            GROUP BY realRes, perceived
            ORDER BY count DESC;
        `).all(username ? [username] : []);
        return rows; // [{pair,count}]
    } finally { db.close(); }
}

function getGlobalConfusions() { return getConfusions(null); }

function getGlobalPairedSatisfaction() {
    // Pair comparison logic preserved from JS version but translated to SQL partially.
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT resolution1, resolution2,
                             TRIM(REPLACE(REPLACE(REPLACE(QO2,'"',''),'(',''),')','')) AS pair
                FROM sessions WHERE resolution1<>'' AND resolution2<>''
            ), parts AS (
                SELECT resolution1, resolution2, pair,
                             LOWER(TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END))) AS q1,
                             LOWER(TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END))) AS q2
                FROM base
            )
            SELECT resolution1, resolution2, q1, q2 FROM parts;
        `).all();
        const acc = {};
        for (const r of rows) {
            const idx1 = RESOLUTION_ORDER.indexOf(r.resolution1);
            const idx2 = RESOLUTION_ORDER.indexOf(r.resolution2);
            if (idx1 === -1 || idx2 === -1) continue;
            const key = idx1 < idx2 ? `${r.resolution1}-${r.resolution2}` : `${r.resolution2}-${r.resolution1}`;
            const lowerRes = idx1 < idx2 ? r.resolution1 : r.resolution2;
            const higherRes = idx1 < idx2 ? r.resolution2 : r.resolution1;
            const lowerQual = idx1 < idx2 ? r.q1 : r.q2;
            const higherQual = idx1 < idx2 ? r.q2 : r.q1;
            if (!acc[key]) acc[key] = { res1: { name: lowerRes, counts: {} }, res2: { name: higherRes, counts: {} } };
            acc[key].res1.counts[lowerQual] = (acc[key].res1.counts[lowerQual] || 0) + 1;
            acc[key].res2.counts[higherQual] = (acc[key].res2.counts[higherQual] || 0) + 1;
        }
        return acc;
    } finally { db.close(); }
}

function getGlobalSatisfactionByCategory() {
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT category1, category2,
                             TRIM(REPLACE(REPLACE(REPLACE(QO2,'"',''),'(',''),')','')) AS pair
                FROM sessions WHERE QO2 IS NOT NULL AND QO2 <> ''
            ), split AS (
                SELECT category1 AS category,
                             TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END)) AS satisfaction
                FROM base
                UNION ALL
                SELECT category2,
                             TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END))
                FROM base
            )
            SELECT LOWER(satisfaction) AS satisfaction, category, COUNT(*) AS count
            FROM split
            WHERE category <> '' AND satisfaction <> ''
            GROUP BY category, satisfaction;
        `).all();
        const acc = {};
        for (const r of rows) {
            if (!acc[r.category]) acc[r.category] = {};
            acc[r.category][r.satisfaction] = r.count;
        }
        return acc;
    } finally { db.close(); }
}

function getGlobalPerceptionByCategory() {
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT category1, category2, resolution1, resolution2,
                             TRIM(REPLACE(REPLACE(REPLACE(QO1,'"',''),'(',''),')','')) AS pair
                FROM sessions WHERE QO1 IS NOT NULL AND QO1 <> ''
            ), parts AS (
                SELECT category1 AS category, resolution1 AS realRes,
                             TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END)) AS perceived
                FROM base
                UNION ALL
                SELECT category2, resolution2,
                             TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END))
                FROM base
            )
            SELECT category, realRes, perceived FROM parts WHERE category<>'' AND realRes<>'' AND perceived<>'';
        `).all();
        const acc = {};
        for (const r of rows) {
            const realIdx = RESOLUTION_ORDER.indexOf(r.realRes);
            const perceivedIdx = RESOLUTION_ORDER.indexOf(r.perceived);
            if (realIdx === -1 || perceivedIdx === -1) continue;
            if (!acc[r.category]) acc[r.category] = { correct: 0, overestimation: 0, underestimation: 0, total: 0 };
            acc[r.category].total++;
            if (perceivedIdx > realIdx) acc[r.category].overestimation++;
            else if (perceivedIdx < realIdx) acc[r.category].underestimation++;
            else acc[r.category].correct++;
        }
        return acc;
    } finally { db.close(); }
}

// Stubbed detailed satisfaction functions remain similar pattern if needed.
// ------------------------------------
// Newly implemented aggregation functions (previously stubbed)
// ------------------------------------

function getSatisfactionByPseudo(pseudo) {
    // Shape expected by front-end:
    // { video1: { resolution: { satisfactionKey: count } }, video2: { ... } }
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT resolution1, resolution2,
                       TRIM(REPLACE(REPLACE(REPLACE(QO2,'"',''),'(',''),')','')) AS pair
                FROM sessions
                WHERE QO2 IS NOT NULL AND QO2 <> '' AND LOWER(user) = LOWER(?)
            ), parts AS (
                SELECT resolution1 AS res,
                       LOWER(TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END))) AS sat,
                       1 AS pos
                FROM base
                UNION ALL
                SELECT resolution2,
                       LOWER(TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END))),
                       2
                FROM base
            )
            SELECT res, sat, pos, COUNT(*) AS count
            FROM parts
            WHERE res <> '' AND sat <> ''
            GROUP BY res, sat, pos;
        `).all(pseudo);
        const acc = { video1: {}, video2: {} };
        for (const r of rows) {
            const target = r.pos === 1 ? acc.video1 : acc.video2;
            if (!target[r.res]) target[r.res] = {};
            target[r.res][r.sat] = r.count;
        }
        return acc;
    } finally { db.close(); }
}

function getSatisfactionByDevice(pseudo) {
    
    // Shape: { resolution: { device: { satisfactionKey: count } } }
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT resolution1, resolution2, screenType,
                       TRIM(REPLACE(REPLACE(REPLACE(QO2,'"',''),'(',''),')','')) AS pair
                FROM sessions
                WHERE QO2 IS NOT NULL AND QO2 <> '' AND screenType <> '' AND LOWER(user) = LOWER(?)
            ), split AS (
                SELECT resolution1 AS resolution, screenType,
                       LOWER(TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END))) AS satisfaction
                FROM base
                UNION ALL
                SELECT resolution2, screenType,
                       LOWER(TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END)))
                FROM base
            )
            SELECT resolution, screenType, satisfaction, COUNT(*) AS count
            FROM split
            WHERE resolution <> '' AND satisfaction <> '' AND screenType <> ''
            GROUP BY resolution, screenType, satisfaction;
        `).all(pseudo);
        const acc = {};
        for (const r of rows) {
            const device = normalizeDevice(r.screenType);
            if (!acc[r.resolution]) acc[r.resolution] = {};
            if (!acc[r.resolution][device]) acc[r.resolution][device] = {};
            acc[r.resolution][device][r.satisfaction] = (acc[r.resolution][device][r.satisfaction] || 0) + r.count;
        }
        return acc;
    } finally { db.close(); }
}

function getSatisfactionByVideoAndDevice(videoName) {
    // Shape: { resolution: { device: { satisfactionKey: count } } } filtered by video name (either position)
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT videoName1, videoName2, resolution1, resolution2, screenType,
                       TRIM(REPLACE(REPLACE(REPLACE(QO2,'"',''),'(',''),')','')) AS pair
                FROM sessions
                WHERE QO2 IS NOT NULL AND QO2 <> '' AND screenType <> ''
                  AND (LOWER(videoName1) = LOWER(?) OR LOWER(videoName2) = LOWER(?))
            ), split AS (
                SELECT resolution1 AS resolution, screenType,
                       LOWER(TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END))) AS satisfaction
                FROM base
                UNION ALL
                SELECT resolution2, screenType,
                       LOWER(TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END)))
                FROM base
            )
            SELECT resolution, screenType, satisfaction, COUNT(*) AS count
            FROM split
            WHERE resolution <> '' AND satisfaction <> '' AND screenType <> ''
            GROUP BY resolution, screenType, satisfaction;
        `).all(videoName, videoName);
        const acc = {};
        for (const r of rows) {
            const device = normalizeDevice(r.screenType);
            if (!acc[r.resolution]) acc[r.resolution] = {};
            if (!acc[r.resolution][device]) acc[r.resolution][device] = {};
            acc[r.resolution][device][r.satisfaction] = (acc[r.resolution][device][r.satisfaction] || 0) + r.count;
        }
        return acc;
    } finally { db.close(); }
}

function getVideoPerception(videoName) {
    // Shape: { realResolution: { correct, overestimation, underestimation, total } }
    const db = openDb();
    try {
        const rows = db.prepare(`
            SELECT resolution1, resolution2, QO1
            FROM sessions
            WHERE QO1 IS NOT NULL AND QO1 <> ''
              AND (LOWER(videoName1) = LOWER(?) OR LOWER(videoName2) = LOWER(?));
        `).all(videoName, videoName);
        const acc = {};
        for (const r of rows) {
            const raw = String(r.QO1 || '').replace(/["()]/g, '').split(',');
            const p1 = (raw[0] || '').trim().toLowerCase();
            const p2 = (raw[1] || '').trim().toLowerCase();
            const res1 = (r.resolution1 || '').trim();
            const res2 = (r.resolution2 || '').trim();
            const handle = (real, perceived) => {
                if (!real || !perceived) return;
                const realIdx = RESOLUTION_ORDER.indexOf(real);
                const perceivedIdx = RESOLUTION_ORDER.indexOf(perceived);
                if (realIdx === -1 || perceivedIdx === -1) return;
                if (!acc[real]) acc[real] = { correct: 0, overestimation: 0, underestimation: 0, total: 0 };
                acc[real].total++;
                if (perceivedIdx > realIdx) acc[real].overestimation++; else if (perceivedIdx < realIdx) acc[real].underestimation++; else acc[real].correct++;
            };
            handle(res1, p1);
            handle(res2, p2);
        }
        return acc;
    } finally { db.close(); }
}

function getDetailedSatisfaction() {
    // Shape: { device: { category: { resolution: { satisfactionKey: count } } } }
    const db = openDb();
    try {
        const rows = db.prepare(`
            WITH base AS (
                SELECT screenType, category1, category2, resolution1, resolution2,
                       TRIM(REPLACE(REPLACE(REPLACE(QO2,'"',''),'(',''),')','')) AS pair
                FROM sessions
                WHERE QO2 IS NOT NULL AND QO2 <> '' AND screenType <> ''
            ), first_part AS (
                SELECT LOWER(screenType) AS device, category1 AS category, resolution1 AS resolution,
                       LOWER(TRIM(SUBSTR(pair,1,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')-1 ELSE LENGTH(pair) END))) AS sat
                FROM base
            ), second_part AS (
                SELECT LOWER(screenType) AS device, category2 AS category, resolution2 AS resolution,
                       LOWER(TRIM(SUBSTR(pair,CASE WHEN INSTR(pair,',')>0 THEN INSTR(pair,',')+1 ELSE LENGTH(pair)+1 END))) AS sat
                FROM base
            ), all_parts AS (
                SELECT * FROM first_part UNION ALL SELECT * FROM second_part
            )
            SELECT device, category, resolution, sat, COUNT(*) AS count
            FROM all_parts
            WHERE device <> '' AND category <> '' AND resolution <> '' AND sat <> ''
            GROUP BY device, category, resolution, sat;
        `).all();
        const acc = {};
        for (const r of rows) {
            const device = normalizeDevice(r.device);
            if (!acc[device]) acc[device] = {};
            if (!acc[device][r.category]) acc[device][r.category] = {};
            if (!acc[device][r.category][r.resolution]) acc[device][r.category][r.resolution] = {};
            acc[device][r.category][r.resolution][r.sat] = (acc[device][r.category][r.resolution][r.sat] || 0) + r.count;
        }
        return acc;
    } finally { db.close(); }
}

module.exports = {
    calculateUserPrecision,
    parseVideoPath,
    getConfusions,
    getGlobalConfusions,
    getGlobalSatisfaction,
    getGlobalSatisfactionByDevice,
    getGlobalPairedSatisfaction,
    getGlobalSatisfactionByCategory,
    getGlobalPerceptionByCategory,
    getDetailedSatisfaction,
    getSatisfactionByVideoAndDevice,
    getVideoPerception,
    getSatisfactionByPseudo,
    getSatisfactionByDevice
};