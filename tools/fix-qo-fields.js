// Fix QO fields in sessions that were split across columns during CSV migration
// Strategy:
// - If QO1 or QO2 do not contain a comma, but QO3/QO4 look like the second half of the pair,
//   we reconstruct: QO1 = `(perceived1, perceived2)`, QO2 = `(satisfaction1, satisfaction2)`
// - We only modify rows where both pairs lack commas (to avoid touching already-correct rows)
// - Quotes and stray parentheses are stripped while rebuilding

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

function stripToken(s) {
  if (!s) return '';
  return String(s)
    .trim()
    .replace(/^\"|^'|^\(/, '') // leading quote or (
    .replace(/\"$|'$|\)$/,'')  // trailing quote or )
    .trim();
}

function needsFix(q1, q2, q3, q4) {
  const hasCommaQ1 = (q1 || '').includes(',');
  const hasCommaQ2 = (q2 || '').includes(',');
  // Fix only when both lack commas, implying pairs were split
  return !hasCommaQ1 && !hasCommaQ2 && (q1 || q2 || q3 || q4);
}

const selectStmt = db.prepare('SELECT id, QO1, QO2, QO3, QO4 FROM sessions');
const updateStmt = db.prepare('UPDATE sessions SET QO1 = @QO1, QO2 = @QO2 WHERE id = @id');

let scanned = 0;
let fixed = 0;

const rows = selectStmt.all();
const tx = db.transaction((rowsToFix) => {
  for (const row of rowsToFix) {
    scanned += 1;
    if (!needsFix(row.QO1, row.QO2, row.QO3, row.QO4)) continue;
    const p1 = stripToken(row.QO1);
    const p2 = stripToken(row.QO2);
    const s1 = stripToken(row.QO3);
    const s2 = stripToken(row.QO4);
    if (!p1 && !p2 && !s1 && !s2) continue;
    const newQO1 = `(${p1}${p1||p2?',':''}${p2})`;
    const newQO2 = `(${s1}${s1||s2?',':''}${s2})`;
    updateStmt.run({ id: row.id, QO1: newQO1, QO2: newQO2 });
    fixed += 1;
  }
});

tx(rows);

console.log(`Scanned: ${scanned}, Fixed: ${fixed}`);
db.close();
