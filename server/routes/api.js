const express = require('express');
const router = express.Router();
const csvHandler = require('../data/csvHandler');
const videoService = require('../services/videoService');
const statsService = require('../services/statsService');
const dbService = require('../services/dbService');

// --- Routes Vidéos ---
router.get('/api/get-videos', (req, res) => {
    const { mode, includeLicensed } = req.query;
    res.json(videoService.getVideos(mode, includeLicensed));
});

router.get('/videos/resolutions/:baseVideoName', (req, res) => {
    // CORRECTION : On décode le paramètre de l'URL pour gérer les caractères spéciaux.
    const videoName = decodeURIComponent(req.params.baseVideoName);
    const resolutions = videoService.getVideoResolutions(videoName);
    if (resolutions) {
        res.json(resolutions);
    } else {
        res.status(404).json({ message: "Vidéo non trouvée." });
    }
});

// --- Routes de Soumission ---
router.post('/addUser', async (req, res) => {
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
        await csvHandler.appendToCsv(record);

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
    // CORRECTION : On décode le paramètre de l'URL.
    const videoName = decodeURIComponent(req.params.videoName);
    const data = await statsService.getVideoPerception(videoName);
    res.json(data);
});

router.get('/stats/satisfaction-by-video-device/:videoName', async (req, res) => {
    // CORRECTION : On décode le paramètre de l'URL.
    const videoName = decodeURIComponent(req.params.videoName);
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
router.get('/api/db/users', (req, res) => {
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