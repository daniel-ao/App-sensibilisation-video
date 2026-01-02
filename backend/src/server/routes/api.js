const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Debug logging
router.use((req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
});
// On peut supprimer ces deux lignes si on n'utilise plus du tout CSV/JSON
// const jsonHandler = require('../data/jsonHandler'); 
// const csvHandler = require('../data/csvHandler'); 
const videoService = require('../services/videoService');
const statsService = require('../services/statsService');
const dbService = require('../services/dbService');

// --- Routes Vidéos ---
router.get('/api/get-videos', (req, res) => {
    const { mode, includeLicensed } = req.query;
    res.json(videoService.getVideos(mode, includeLicensed));
});

// --- Routes Utilisateurs ---
router.get('/api/check-pseudo/:pseudo', (req, res) => {
    const { pseudo } = req.params;
    try {
        const exists = dbService.checkUserExists(pseudo);
        res.json({ exists });
    } catch (error) {
        console.error("Error checking pseudo:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/api/register', (req, res) => {
    const { pseudo, email, password } = req.body;
    if (!pseudo || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    
    // Simple SHA256 hash (in production use bcrypt/argon2)
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    try {
        dbService.registerUser({ pseudo, email, passwordHash });
        res.json({ success: true, message: 'User registered successfully.' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/api/login', (req, res) => {
    const { pseudo, password } = req.body;
    if (!pseudo || !password) {
        return res.status(400).json({ message: 'Pseudo and password are required.' });
    }

    try {
        const user = dbService.getUserCredentials(pseudo);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
        if (user.password_hash !== passwordHash) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Set a simple cookie for session
        res.cookie('user_session', user.pseudo, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // 1 day
        res.json({ success: true, message: 'Login successful.', user: { pseudo: user.pseudo, is_admin: !!user.is_admin } });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/api/me', (req, res) => {
    const pseudo = req.cookies.user_session;
    if (pseudo) {
        const user = dbService.getUserCredentials(pseudo);
        if (user) {
            res.json({ loggedIn: true, user: { pseudo: user.pseudo, is_admin: !!user.is_admin } });
        } else {
            res.clearCookie('user_session');
            res.json({ loggedIn: false });
        }
    } else {
        res.json({ loggedIn: false });
    }
});

router.post('/api/logout', (req, res) => {
    res.clearCookie('user_session');
    res.json({ success: true, message: 'Logged out successfully.' });
});

router.post('/api/link-guest-data', (req, res) => {
    const { oldPseudo, newPseudo } = req.body;
    if (!oldPseudo || !newPseudo) {
        return res.status(400).json({ message: 'Old and new pseudo required.' });
    }
    try {
        const result = dbService.linkGuestData(oldPseudo, newPseudo);
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        console.error("Link guest data error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    console.log('[isAdmin] Checking auth...');
    const pseudo = req.cookies.user_session;
    console.log('[isAdmin] Cookie:', pseudo);
    if (!pseudo) {
        console.log('[isAdmin] No cookie');
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const user = dbService.getUserCredentials(pseudo);
    console.log('[isAdmin] User:', user);
    if (!user || !user.is_admin) {
        console.log('[isAdmin] Not admin');
        return res.status(403).json({ message: 'Forbidden: Admins only' });
    }
    console.log('[isAdmin] Authorized');
    next();
};

router.put('/api/update-role', isAdmin, (req, res) => {
    const { pseudo, is_admin } = req.body;
    console.log('[PUT Role] Request received for:', pseudo);
    
    if (!pseudo) {
        return res.status(400).json({ message: 'Pseudo is required.' });
    }

    const MAIN_ADMIN = 'admin'; // Hardcoded main admin

    if (pseudo.toLowerCase() === MAIN_ADMIN.toLowerCase()) {
        return res.status(403).json({ message: 'Cannot change role of Main Admin.' });
    }

    try {
        dbService.updateUserRole(pseudo, is_admin);
        res.json({ success: true, message: `User role updated for ${pseudo}` });
    } catch (err) {
        console.error("Error updating role:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/videos/resolutions/:baseVideoName', (req, res) => {
    const videoName = req.params.baseVideoName;
    const resolutions = videoService.getVideoResolutions(videoName);
    if (resolutions) {
        res.json(resolutions);
    } else {
        res.status(404).json({ message: "Vidéo non trouvée." });
    }
});

// --- Route d'Ajout (CORRIGÉE POUR SQLITE) ---
router.post('/addUser', (req, res) => {
    const { user, videoPath1, resolution1, videoPath2, resolution2, QO1 } = req.body;
    if (!user || !resolution1 || !resolution2 || !QO1) {
        return res.status(400).json({ message: 'Champs obligatoires manquants.' });
    }
    try {
        const decodedVideoPath1 = videoPath1 ? decodeURIComponent(videoPath1) : '';
        const decodedVideoPath2 = videoPath2 ? decodeURIComponent(videoPath2) : '';
        const video1Info = statsService.parseVideoPath(decodedVideoPath1);
        const video2Info = statsService.parseVideoPath(decodedVideoPath2);
        
        const record = { 
            ...req.body,
            videoPath1: decodedVideoPath1,
            videoPath2: decodedVideoPath2,
            category1: video1Info.category, 
            videoName1: video1Info.videoName, 
            category2: video2Info.category, 
            videoName2: video2Info.videoName, 
            timestamp: new Date().toISOString() 
        };

        // --- INSERTION DANS LA BDD ---
        dbService.insertSession(record);
        
        // --- MISE À JOUR DU USER (SCORE/PRECISION) ---
        // On s'assure que l'utilisateur existe dans la table users
        dbService.ensureUser(user);
        dbService.incrementSessionCount(user);
        
        // Note: Le calcul du score total se fait normalement par accumulation côté client et envoi via /saveScore,
        // ou alors on pourrait le recalculer ici en SQL, mais pour l'instant on garde la logique existante :
        // l'ajout de session est fait.

        res.json({ message: "Utilisateur ajouté avec succès!" });
    } catch (err) {
        console.error("Erreur dans /addUser:", err);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

// --- Routes Score & Temps ---
router.post('/saveScore', (req, res) => {
    const { pseudo, score } = req.body;
    if (!pseudo || typeof score !== 'number') return res.status(400).json({ message: "Données invalides." });
    try {
        dbService.setScore(pseudo, score);
        res.json({ message: "Score sauvegardé." });
    } catch (e) {
        console.error('Erreur /saveScore', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});
router.get('/getScore', (req, res) => {
    try {
        const score = dbService.getScore(req.query.pseudo);
        res.json({ score });
    } catch (e) {
        console.error('Erreur /getScore', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});
router.post('/saveTime', (req, res) => {
    const { pseudo, time } = req.body;
    if (!pseudo || typeof time !== 'number') return res.status(400).json({ message: "Données invalides." });
    try {
        dbService.setTime(pseudo, time);
        res.json({ message: "Temps sauvegardé." });
    } catch (e) {
        console.error('Erreur /saveTime', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});
router.get('/getTime', (req, res) => {
    try {
        const time = dbService.getTime(req.query.pseudo);
        res.json({ time });
    } catch (e) {
        console.error('Erreur /getTime', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

// --- Routes Statistiques Personnelles ---
router.get('/precision/:username', async (req, res) => {
    const precision = await statsService.calculateUserPrecision(req.params.username);
    res.json({ precision: precision.toFixed(2) });
});
router.get('/satisfaction/:username', async (req, res) => {
    const data = await statsService.getSatisfactionByPseudo(req.params.username);
    res.json(data);
});
router.get('/satisfaction-by-device/:username', async (req, res) => {
    const data = await statsService.getSatisfactionByDevice(req.params.username);
    res.json(data);
});
router.get('/confusions/:username', async (req, res) => {
    const data = await statsService.getConfusions(req.params.username);
    res.json(data);
});

// --- Routes Statistiques Globales ---
router.get('/global-satisfaction', async (req, res) => {
    const data = await statsService.getGlobalSatisfaction();
    res.json(data);
});
router.get('/global-satisfaction-by-device', async (req, res) => {
    const data = await statsService.getGlobalSatisfactionByDevice();
    res.json(data);
});
router.get('/global-confusions', async (req, res) => {
    const data = await statsService.getGlobalConfusions();
    res.json(data);
});
router.get('/global-paired-satisfaction-distribution', async (req, res) => {
    const data = await statsService.getGlobalPairedSatisfaction();
    res.json(data);
});
router.get('/global-stats/satisfaction-by-category', async (req, res) => {
    const data = await statsService.getGlobalSatisfactionByCategory();
    res.json(data);
});
router.get('/global-stats/perception-by-category', async (req, res) => {
    const data = await statsService.getGlobalPerceptionByCategory();
    res.json(data);
});
router.get('/global-stats/satisfaction-detailed', async (req, res) => {
    const data = await statsService.getDetailedSatisfaction();
    res.json(data);
});
router.get('/precision_moyenne_globale', (req, res) => {
    try {
        const result = dbService.computeGlobalAveragePrecision();
        res.json(result);
    } catch (e) {
        console.error('Erreur /precision_moyenne_globale', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

router.get('/stats/video-perception/:videoName', async (req, res) => {
    const videoName = req.params.videoName;
    const data = await statsService.getVideoPerception(videoName);
    res.json(data);
});

router.get('/stats/satisfaction-by-video-device/:videoName', async (req, res) => {
    const videoName = req.params.videoName;
    const data = await statsService.getSatisfactionByVideoAndDevice(videoName);
    res.json(data);
});

// --- Pseudo Handling ---
let lastPseudo = null;
router.post('/registerPseudo', (req, res) => {
    lastPseudo = req.body.pseudo;
    res.cookie('userPseudo', lastPseudo, { maxAge: 10 * 60 * 1000, httpOnly: false, sameSite: 'Lax' });
    res.json({ message: "Pseudo enregistré." });
});
router.get('/lastPseudo', (req, res) => {
    res.json({ pseudo: req.cookies.userPseudo || lastPseudo });
});

// --- Routes Base de Données (exploration) ---
router.get('/api/db/summary', (req, res) => {
    try {
        res.json(dbService.getSummary());
    } catch (e) {
        console.error('Erreur /api/db/summary', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});
router.get('/api/db/sessions', (req, res) => {
    const { q = '', limit = '50', offset = '0', startDate = '', endDate = '', resolution = '', sortBy = '', sortDir = '' } = req.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    try {
        const data = dbService.getSessions({ q, limit: lim, offset: off, startDate, endDate, resolution, sortBy, sortDir });
        res.json({ query: q, limit: lim, offset: off, startDate, endDate, resolution, sortBy, sortDir, total: data.total, rows: data.rows });
    } catch (e) {
        console.error('Erreur /api/db/sessions', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});
router.get('/api/db/users', isAdmin, (req, res) => {
    const { q = '', limit = '50', offset = '0' } = req.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    try {
        const data = dbService.getUsers({ q, limit: lim, offset: off });
        res.json({ query: q, limit: lim, offset: off, total: data.total, rows: data.rows });
    } catch (e) {
        console.error('Erreur /api/db/users', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

router.get('/api/db/resolutions', (req, res) => {
    try {
        res.json({ resolutions: dbService.getResolutions() });
    } catch (e) {
        console.error('Erreur /api/db/resolutions', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

router.get('/api/db/session/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ message: 'ID invalide' });
        const row = dbService.getSessionById(id);
        if (!row) return res.status(404).json({ message: 'Session non trouvée' });
        res.json(row);
    } catch (e) {
        console.error('Erreur /api/db/session/:id', e);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

module.exports = router;