// backend/src/server/config.js

const path = require('path');

// --- DÉTECTION DE L'ENVIRONNEMENT ---
// Si la variable NODE_ENV est 'production' (définie dans docker-compose), on est dans Docker.
const IS_DOCKER = process.env.NODE_ENV === 'production';

// --- DÉFINITION DE LA RACINE ---
// Dans Docker, c'est /usr/src/app.
// En local, on remonte de 3 niveaux depuis ce fichier (server -> src -> backend -> Racine).
const PROJECT_ROOT = IS_DOCKER ? '/usr/src/app' : path.join(__dirname, '..', '..', '..');

// --- CONSTANTES ---
const INCLUDE_LICENSED_VIDEOS = true;
const RESOLUTION_ORDER = ["144p", "240p", "360p", "480p", "720p", "1080p", "4k"];

// --- CHEMINS DES FICHIERS ---
// C'est ici qu'on gère la différence de structure entre Docker et Local.

// 1. Données (CSV/JSON)
// En Docker, elles sont montées dans /usr/src/app/data/
// En local, elles sont dans un dossier /data/ à la racine (si vous avez suivi ma recommandation)
// ou directement à la racine. Adaptons pour le cas le plus probable en local : à la racine.
const dataBasePath = path.join(PROJECT_ROOT, 'data');

const DATA_JSON_PATH = path.join(dataBasePath, 'data.json');
const CSV_FILE_PATH = path.join(dataBasePath, 'data.csv');
const DB_PATH = path.join(dataBasePath, 'database.db');

// 2. Vidéos
// En Docker, elles sont montées dans /usr/src/app/videos/
// En local, elles sont à la racine.
const videosBasePath = IS_DOCKER ? path.join(PROJECT_ROOT, 'videos') : PROJECT_ROOT;

const VIDEO_ROOT_PATH = path.join(videosBasePath, 'Videos_Creative_Common');
const LICENSED_ROOT_PATH = path.join(videosBasePath, 'Videos_License');
const ENFANT_ROOT_PATH = path.join(videosBasePath, 'Videos_enfants');


module.exports = {
    INCLUDE_LICENSED_VIDEOS,
    DATA_JSON_PATH,
    CSV_FILE_PATH,
    DB_PATH,
    VIDEO_ROOT_PATH,
    LICENSED_ROOT_PATH,
    ENFANT_ROOT_PATH,
    RESOLUTION_ORDER
};