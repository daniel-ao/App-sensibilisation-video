const { readCsv } = require('../data/csvHandler');
const { RESOLUTION_ORDER } = require('../config');

// Helper pour parser le chemin d'une vidéo
function parseVideoPath(filePath) {
    if (!filePath || typeof filePath !== 'string') return { category: '', videoName: '' };
    const parts = filePath.split('/');
    // L'avant-dernier élément est le nom de la vidéo/du dossier parent
    const videoName = decodeURIComponent(parts[parts.length - 2] || '');
    // L'élément d'avant est la catégorie
    const category = decodeURIComponent(parts[parts.length - 3] || '');
    return { category, videoName };
}

async function calculateUserPrecision(username) {
    const data = await readCsv();
    let total = 0, correct = 0;
    username = username.toLowerCase();
    data.forEach(row => {
        if ((row.user || "").trim().toLowerCase() === username) {
            const userQO1 = (row.QO1 || "").replace(/[()]/g, "").split(",");
            if (row.resolution1 && userQO1[0]) { total++; if (row.resolution1.trim() === userQO1[0].trim()) correct++; }
            if (row.resolution2 && userQO1[1]) { total++; if (row.resolution2.trim() === userQO1[1].trim()) correct++; }
        }
    });
    return total > 0 ? (correct / total) * 100 : 0;
}

async function calculateStats(aggregatorFn) {
    const data = await readCsv();
    const result = {};
    data.forEach(row => aggregatorFn(row, result));
    return result;
}

// Fonctions d'agrégation spécifiques
const aggregators = {
    satisfactionByPseudo: (username) => (row, acc) => {
        if ((row.user || "").trim().toLowerCase() !== username.toLowerCase()) return;
        acc.video1 = acc.video1 || {}; acc.video2 = acc.video2 || {};
        const qo2 = (row.QO2 || "").replace(/[()]/g, "").split(",");
        if (row.resolution1 && qo2[0]) {
            if (!acc.video1[row.resolution1]) acc.video1[row.resolution1] = {};
            acc.video1[row.resolution1][qo2[0].trim()] = (acc.video1[row.resolution1][qo2[0].trim()] || 0) + 1;
        }
        if (row.resolution2 && qo2[1]) {
            if (!acc.video2[row.resolution2]) acc.video2[row.resolution2] = {};
            acc.video2[row.resolution2][qo2[1].trim()] = (acc.video2[row.resolution2][qo2[1].trim()] || 0) + 1;
        }
    },

    satisfactionByDevice: (username) => (row, acc) => {
        if (username && (row.user || "").trim().toLowerCase() !== username.toLowerCase()) return;
        const qo2 = (row.QO2 || "").replace(/[()]/g, "").split(",");
        const screenType = (row.screenType || "inconnu").trim();
        const process = (res, qual) => {
            if (!res || !qual || !screenType) return;
            if (!acc[res]) acc[res] = {};
            if (!acc[res][screenType]) acc[res][screenType] = {};
            acc[res][screenType][qual] = (acc[res][screenType][qual] || 0) + 1;
        };
        process(row.resolution1?.trim(), qo2[0]?.trim(), screenType);
        process(row.resolution2?.trim(), qo2[1]?.trim(), screenType);
    },

    confusions: (username) => (row, acc) => {
        if (username && (row.user || "").trim().toLowerCase() !== username.toLowerCase()) return;
        const userQO1 = (row.QO1 || "").replace(/[()]/g, "").split(",");
        const process = (real, perceived) => {
            if (real && perceived && real !== perceived) {
                const key = `${real} → ${perceived}`;
                acc[key] = (acc[key] || 0) + 1;
            }
        };
        process(row.resolution1?.trim(), userQO1[0]?.trim());
        process(row.resolution2?.trim(), userQO1[1]?.trim());
    },
    
    globalSatisfaction: (row, acc) => {
        const qo2 = (row.QO2 || "").replace(/[()]/g, "").split(",");
        const process = (res, qual) => {
            if (res && qual) {
                if (!acc[res]) acc[res] = {};
                acc[res][qual.toLowerCase()] = (acc[res][qual.toLowerCase()] || 0) + 1;
            }
        };
        process(row.resolution1?.trim(), qo2[0]?.trim());
        process(row.resolution2?.trim(), qo2[1]?.trim());
    },

    pairedSatisfaction: (row, acc) => {
        let [res1, res2] = [row.resolution1?.trim(), row.resolution2?.trim()];
        const qo2 = (row.QO2 || "").replace(/[()]/g, "").split(",");
        let [qual1, qual2] = [qo2[0]?.trim(), qo2[1]?.trim()];
        
        if (!res1 || !res2 || !qual1 || !qual2) return;

        const normalizedQual1 = qual1.toLowerCase();
        const normalizedQual2 = qual2.toLowerCase();

        const [idx1, idx2] = [RESOLUTION_ORDER.indexOf(res1), RESOLUTION_ORDER.indexOf(res2)];
        if (idx1 === -1 || idx2 === -1) return;

        const key = idx1 < idx2 ? `${res1}-${res2}` : `${res2}-${res1}`;
        const [lowerRes, higherRes] = idx1 < idx2 ? [res1, res2] : [res2, res1];
        
        const [lowerQual, higherQual] = idx1 < idx2 ? [normalizedQual1, normalizedQual2] : [normalizedQual2, normalizedQual1];
        
        if (!acc[key]) {
            acc[key] = {
                res1: { name: lowerRes, counts: {} },
                res2: { name: higherRes, counts: {} }
            };
        }
        
        acc[key].res1.counts[lowerQual] = (acc[key].res1.counts[lowerQual] || 0) + 1;
        acc[key].res2.counts[higherQual] = (acc[key].res2.counts[higherQual] || 0) + 1;
    },

    satisfactionByCategory: (row, acc) => {
        const qo2 = (row.QO2 || "").replace(/[()]/g, "").split(",");
        const process = (cat, qual) => {
            if (!cat || !qual) return;
            const qualityKey = qual.trim().toLowerCase();
            if (!acc[cat]) acc[cat] = {};
            acc[cat][qualityKey] = (acc[cat][qualityKey] || 0) + 1;
        };
        const category1 = row.category1?.trim();
        const category2 = row.category2?.trim();

        process(category1, qo2[0]);
        process(category2, qo2[1]);
    },

    perceptionByCategory: (row, acc) => {
        const userQO1 = (row.QO1 || "").replace(/[()]/g, "").split(",");
        const process = (cat, real, perceived) => {
            if (!cat || !real || !perceived) return;
            if (!acc[cat]) acc[cat] = { correct: 0, overestimation: 0, underestimation: 0, total: 0 };
            acc[cat].total++;
            const [realIdx, perceivedIdx] = [RESOLUTION_ORDER.indexOf(real), RESOLUTION_ORDER.indexOf(perceived)];
            if (realIdx === -1 || perceivedIdx === -1) return;
            if (perceivedIdx > realIdx) acc[cat].overestimation++;
            else if (perceivedIdx < realIdx) acc[cat].underestimation++;
            else acc[cat].correct++;
        };
        process(row.category1?.trim(), row.resolution1?.trim(), userQO1[0]?.trim());
        process(row.category2?.trim(), row.resolution2?.trim(), userQO1[1]?.trim());
    },
    
    videoPerception: (videoName) => (row, acc) => {
        const process = (path, realRes, perceivedRes) => {
            if (!path || !realRes || !perceivedRes) return;
            // Utilise le helper `parseVideoPath` qui gère le décodage
            const currentVideoName = parseVideoPath(path).videoName;
            if (currentVideoName !== videoName) return;

            if (!acc[realRes]) acc[realRes] = { correct: 0, overestimation: 0, underestimation: 0, total: 0 };
            acc[realRes].total++;

            const realIndex = RESOLUTION_ORDER.indexOf(realRes.toLowerCase());
            const perceivedIndex = RESOLUTION_ORDER.indexOf(perceivedRes.toLowerCase());
            if (realIndex === -1 || perceivedIndex === -1) return;

            if (perceivedIndex > realIndex) acc[realRes].overestimation++;
            else if (perceivedIndex < realIndex) acc[realRes].underestimation++;
            else acc[realRes].correct++;
        };
        const userQO1 = (row.QO1 || "").replace(/[()]/g, "").split(",");
        process(row.videoPath1, row.resolution1, userQO1[0]?.trim());
        process(row.videoPath2, row.resolution2, userQO1[1]?.trim());
    },

    satisfactionDetailed: (row, acc) => {
        const device = (row.screenType || "inconnu").trim();
        const qo2 = (row.QO2 || "").replace(/[()]/g, "").split(",");
        const process = (cat, res, qual) => {
            if (!device || !cat || !res || !qual) return;
            if (!acc[device]) acc[device] = {};
            if (!acc[device][cat]) acc[device][cat] = {};
            if (!acc[device][cat][res]) acc[device][cat][res] = {};
            acc[device][cat][res][qual] = (acc[device][cat][res][qual] || 0) + 1;
        };
        process(row.category1?.trim(), row.resolution1?.trim(), qo2[0]?.trim().toLowerCase());
        process(row.category2?.trim(), row.resolution2?.trim(), qo2[1]?.trim().toLowerCase());
    },

    satisfactionByVideoAndDevice: (videoName) => (row, acc) => {
        const process = (path, res, qual, device) => {
            if (!path || !res || !qual || !device) return;

            const currentVideoName = parseVideoPath(path).videoName;
            if (currentVideoName !== videoName) return;
            
            const qualityKey = qual.toLowerCase();

            if (!acc[res]) acc[res] = {};
            if (!acc[res][device]) acc[res][device] = {};
            
            // On utilise la clé normalisée pour agréger les données.
            acc[res][device][qualityKey] = (acc[res][device][qualityKey] || 0) + 1;
        };

        const qo2 = (row.QO2 || "").replace(/[()]/g, "").split(",");
        const device = (row.screenType || "inconnu").trim();
        // On s'assure de "trim" les valeurs de qualité avant de les passer
        process(row.videoPath1, row.resolution1?.trim(), qo2[0]?.trim(), device);
        process(row.videoPath2, row.resolution2?.trim(), qo2[1]?.trim(), device);
    },
};

const formatConfusions = async (aggregator) => {
    const map = await calculateStats(aggregator);
    return Object.entries(map).map(([pair, count]) => ({ pair, count })).sort((a, b) => b.count - a.count);
};

module.exports = {
    calculateUserPrecision,
    parseVideoPath,
    getSatisfactionByPseudo: (pseudo) => calculateStats(aggregators.satisfactionByPseudo(pseudo)),
    getSatisfactionByDevice: (pseudo) => calculateStats(aggregators.satisfactionByDevice(pseudo)),
    getConfusions: (pseudo) => formatConfusions(aggregators.confusions(pseudo)),
    getGlobalSatisfaction: () => calculateStats(aggregators.globalSatisfaction),
    getGlobalSatisfactionByDevice: () => calculateStats(aggregators.satisfactionByDevice(null)), // Passe null pour ignorer le filtre utilisateur
    getGlobalConfusions: () => formatConfusions(aggregators.confusions(null)), // Passe null pour ignorer le filtre utilisateur
    getGlobalPairedSatisfaction: () => calculateStats(aggregators.pairedSatisfaction),
    getGlobalSatisfactionByCategory: () => calculateStats(aggregators.satisfactionByCategory),
    getGlobalPerceptionByCategory: () => calculateStats(aggregators.perceptionByCategory),
    getVideoPerception: (videoName) => calculateStats(aggregators.videoPerception(videoName)),
    getDetailedSatisfaction: () => calculateStats(aggregators.satisfactionDetailed),
    getSatisfactionByVideoAndDevice: (videoName) => calculateStats(aggregators.satisfactionByVideoAndDevice(videoName)),

};