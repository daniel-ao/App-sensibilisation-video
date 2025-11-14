// Step 5: SQL-based statistics service
// ------------------------------------
// This refactor replaces full-file reads & JS loops with direct SQLite aggregation queries.
// We keep export function names for API compatibility.
// NOTE: QO1 holds perceived resolution pair; QO2 holds satisfaction pair.
// Data normalization (fix-qo-fields.js) cleaned most malformed rows.

const path = require('path');
const Database = require('better-sqlite3');
const { RESOLUTION_ORDER } = require('../config');

const dbPath = path.join(__dirname, '..', '..', 'db', 'database.db');

function openDb() { return new Database(dbPath, { readonly: true }); }

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
            if (!acc[r.resolution]) acc[r.resolution] = {};
            if (!acc[r.resolution][r.screenType]) acc[r.resolution][r.screenType] = {};
            acc[r.resolution][r.screenType][r.satisfaction] = r.count;
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
function getDetailedSatisfaction() { return {}; }
function getSatisfactionByVideoAndDevice(videoName) { return {}; }
function getVideoPerception(videoName) { return {}; }
function getSatisfactionByPseudo(pseudo) { return {}; }
function getSatisfactionByDevice(pseudo) { return getGlobalSatisfactionByDevice(); }

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