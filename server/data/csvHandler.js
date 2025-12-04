const path = require('path');
const Database = require('better-sqlite3');

// Use SQLite instead of filesystem CSV. Keep the same interface.
const dbPath = path.join(__dirname, '..', '..', 'db', 'database.db');

function openDb() {
    return new Database(dbPath);
}

async function appendToCsv(record) {
        // Insert into sessions, and upsert/increment user sessionCount within a single transaction
        const db = openDb();
        try {
                const insertSession = db.prepare(`
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
                const upsertUser = db.prepare(`
                    INSERT INTO users(pseudo, totalScore, totalTime, sessionCount)
                    VALUES(@pseudo, 0, 0, 1)
                    ON CONFLICT(pseudo) DO UPDATE SET sessionCount = sessionCount + 1
                `);

                const tx = db.transaction((rec) => {
                        insertSession.run({
                                user: rec.user || '',
                                category1: rec.category1 || '',
                                videoName1: rec.videoName1 || '',
                                videoPath1: rec.videoPath1 || '',
                                resolution1: rec.resolution1 || '',
                                category2: rec.category2 || '',
                                videoName2: rec.videoName2 || '',
                                videoPath2: rec.videoPath2 || '',
                                resolution2: rec.resolution2 || '',
                                QO1: rec.QO1 || '',
                                QO2: rec.QO2 || '',
                                QO3: rec.QO3 || '',
                                QO4: rec.QO4 || '',
                                comments: rec.comments || '',
                                screenType: rec.screenType || '',
                                timestamp: rec.timestamp || new Date().toISOString()
                        });
                        const pseudo = (rec.user || '').trim();
                        if (pseudo) {
                                upsertUser.run({ pseudo });
                        }
                });

                tx(record);
        } catch (err) {
                console.error("Erreur lors de l'insertion en base :", err);
                throw err;
        } finally {
                db.close();
        }
}

function readCsv() {
    // Return all sessions as an array of objects mimicking CSV rows
    const db = openDb();
    try {
        const rows = db.prepare(`
          SELECT user, category1, videoName1, videoPath1, resolution1,
                 category2, videoName2, videoPath2, resolution2,
                 QO1, QO2, QO3, QO4,
                 comments, screenType, timestamp
          FROM sessions
        `).all();
        return Promise.resolve(rows.map(r => ({
            user: r.user || '',
            category1: r.category1 || '',
            videoName1: r.videoName1 || '',
            videoPath1: r.videoPath1 || '',
            resolution1: r.resolution1 || '',
            category2: r.category2 || '',
            videoName2: r.videoName2 || '',
            videoPath2: r.videoPath2 || '',
            resolution2: r.resolution2 || '',
            QO1: r.QO1 || '',
            QO2: r.QO2 || '',
            QO3: r.QO3 || '',
            QO4: r.QO4 || '',
            comments: r.comments || '',
            screenType: r.screenType || '',
            timestamp: r.timestamp || ''
        })));
    } catch (err) {
        return Promise.reject(err);
    } finally {
        db.close();
    }
}

module.exports = { appendToCsv, readCsv };