const fs = require('fs');
const path = require('path');
const { INCLUDE_LICENSED_VIDEOS, VIDEO_ROOT_PATH, LICENSED_ROOT_PATH, ENFANT_ROOT_PATH } = require('../config');

let videoLists = {
    // On sépare les listes
    adulte_base: [],
    adulte_licensed: [],
    enfant: []
};

function scanVideoDirectories() {
    console.log("🔄 Lancement du scan des répertoires vidéo...");

    const processDirectory = (rootDir) => {
        // ... (la fonction processDirectory reste exactement la même)
        if (!fs.existsSync(rootDir)) return {};
        const categories = fs.readdirSync(rootDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
        let videosFound = {};
        for (const category of categories) {
            const categoryPath = path.join(rootDir, category);
            const videoNames = fs.readdirSync(categoryPath, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
            for (const videoName of videoNames) {
                const videoPath = path.join(categoryPath, videoName);
                const files = fs.readdirSync(videoPath);
                const resolutions = new Set();
                const sources = {};
                const videoKey = `${category}_${videoName}`;
                for (const file of files) {
                    const match = file.match(/_(\d+p?|4k)\.mp4$/);
                    if (match) {
                        let resolution = match[1];
                        if (resolution !== '4k' && !resolution.endsWith('p')) resolution += 'p';
                        resolutions.add(resolution);
                        const safeRootDir = encodeURIComponent(path.basename(rootDir));
                        const safeCategory = encodeURIComponent(category);
                        const safeVideoName = encodeURIComponent(videoName);
                        const safeFile = encodeURIComponent(file);
                        sources[resolution] = `${safeRootDir}/${safeCategory}/${safeVideoName}/${safeFile}`;
                    }
                }
                if (resolutions.size > 0) {
                    if (!videosFound[videoKey]) {
                        videosFound[videoKey] = { id: videoKey, name: videoName, category: category, resolutions: Array.from(resolutions), sources: sources };
                    }
                }
            }
        }
        return videosFound;
    };
    
    // On scanne chaque dossier et on stocke les résultats dans des listes séparées
    const baseVideos = processDirectory(VIDEO_ROOT_PATH);
    const licensedVideos = processDirectory(LICENSED_ROOT_PATH);
    const enfantVideos = processDirectory(ENFANT_ROOT_PATH);

    videoLists.adulte_base = Object.values(baseVideos);
    videoLists.adulte_licensed = Object.values(licensedVideos);
    videoLists.enfant = Object.values(enfantVideos);

    console.log(`\n✅ Scan terminé: ${videoLists.adulte_base.length} vidéos de base, ${videoLists.adulte_licensed.length} vidéos sous licence, et ${videoLists.enfant.length} vidéos enfants trouvées.`);
}

scanVideoDirectories();

// La fonction getVideos est maintenant plus intelligente
function getVideos(mode = 'adulte', includeLicensed = 'false') {
    if (mode === 'enfant') {
        return videoLists.enfant;
    }
    
    // Si l'option "includeLicensed" est vraie, on fusionne les deux listes
    if (includeLicensed === 'true') {
        // On utilise un Map pour gérer les fusions et éviter les doublons
        const allVideosMap = new Map();
        // D'abord les vidéos de base
        videoLists.adulte_base.forEach(v => allVideosMap.set(v.id, JSON.parse(JSON.stringify(v))));
        // Ensuite on fusionne les vidéos sous licence
        videoLists.adulte_licensed.forEach(licensedVideo => {
            if (allVideosMap.has(licensedVideo.id)) {
                // Fusion
                const existingVideo = allVideosMap.get(licensedVideo.id);
                Object.assign(existingVideo.sources, licensedVideo.sources);
                existingVideo.resolutions = Array.from(new Set([...existingVideo.resolutions, ...licensedVideo.resolutions]));
            } else {
                // Ajout
                allVideosMap.set(licensedVideo.id, licensedVideo);
            }
        });
        return Array.from(allVideosMap.values());
    }
    
    // Par défaut, on ne retourne que la liste de base
    return videoLists.adulte_base;
}


function getVideoResolutions(videoName) {
    // 1. On combine TOUTES les listes de vidéos adultes et enfants
    const allVideos = [
        ...videoLists.adulte_base, 
        ...videoLists.adulte_licensed, 
        ...videoLists.enfant
    ];
    
    // 2. On utilise un Map pour dédoublonner au cas où (même si la fusion devrait déjà le faire)
    const uniqueVideos = new Map();
    allVideos.forEach(v => uniqueVideos.set(v.name, v));

    // 3. On cherche la vidéo par son nom dans la liste complète et unique
    const video = uniqueVideos.get(videoName);
    
    return video ? video.resolutions : null;
}

module.exports = {
    getVideos,
    getVideoResolutions,
    scanVideoDirectories
};