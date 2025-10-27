// =================================================================================
// API.JS - Service de communication avec le backend
// =================================================================================

const API_BASE_URL = `http://${window.location.hostname}:3300`;

async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`);
        if (!response.ok) {
            throw new Error(`Erreur réseau pour ${endpoint}: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Erreur lors de la récupération des données de ${endpoint}:`, error);
        // Retourner une valeur par défaut pour éviter de casser les graphiques
        if (endpoint.includes('confusions')) return [];
        return {};
    }
}

// --- Fonctions pour les statistiques personnelles ---
function getSatisfactionCumul(pseudo) {
    return fetchData(`satisfaction/${pseudo}`);
}
function getSatisfactionByDevice(pseudo) {
    return fetchData(`satisfaction-by-device/${pseudo}`);
}
async function getConfusionsData(pseudo) {
     try {
        const response = await fetch(`${API_BASE_URL}/confusions/${encodeURIComponent(pseudo)}`);
        if (!response.ok) {
            console.error("Erreur récupération confusions personnelles:", `Erreur: ${response.status}`);
            const canvas = document.getElementById('chartConfusions');
            if (canvas) {
                 const ctx = canvas.getContext('2d');
                 ctx.font = "16px Arial"; ctx.textAlign = "center";
                 ctx.fillText("Erreur chargement données personnelles.", canvas.width / 2, canvas.height / 2);
            }
            return [];
        }
        return await response.json();
    } catch (error) {
        console.error("Erreur récupération confusions personnelles:", error);
        return [];
    }
}
function getUserScore(pseudo) {
    return fetchData(`getScore?pseudo=${encodeURIComponent(pseudo)}`);
}
function getUserTime(pseudo) {
    return fetchData(`getTime?pseudo=${encodeURIComponent(pseudo)}`);
}
function getUserPrecision(pseudo) {
    return fetchData(`precision/${pseudo}`);
}


// --- Fonctions pour les statistiques globales ---
function getGlobalSatisfactionCumul() {
    return fetchData(`global-satisfaction`);
}
function getGlobalSatisfactionByDevice() {
    return fetchData(`global-satisfaction-by-device`);
}
function getGlobalConfusionsData() {
    return fetchData(`global-confusions`);
}
function getGlobalPairedSatisfaction() {
    return fetchData(`global-paired-satisfaction-distribution`);
}
function getGlobalSatisfactionByCategory() {
    return fetchData(`global-stats/satisfaction-by-category`);
}
function getGlobalPerceptionByCategory() {
    return fetchData(`global-stats/perception-by-category`);
}
function getGlobalSatisfactionDetailed() {
    return fetchData(`global-stats/satisfaction-detailed`);
}
function getGlobalAveragePrecision() {
    return fetchData(`precision_moyenne_globale`);
}
function getVideoPerceptionStats(videoName) {
    return fetchData(`stats/video-perception/${videoName}`);
}
function getVideoResolutions(videoName) {
    return fetchData(`videos/resolutions/${videoName}`);
}
function getSatisfactionByVideoAndDevice(videoName) {
    return fetchData(`stats/satisfaction-by-video-device/${videoName}`);
}