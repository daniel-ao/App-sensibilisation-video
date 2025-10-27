// =================================================================================
// CONFIG.JS - Constantes de configuration pour l'application front-end
// =================================================================================

const RESOLUTION_ORDER = ["144p", "240p", "360p", "480p", "720p", "1080p", "4k"];
const DEVICE_ORDER = ['pc', 'tablet', 'mobile', 'inconnu'];

const PERCEPTION_LEVELS_CONFIG = [
    { key: "correct", text: "Estimation Correcte", color: 'rgba(89, 192, 75, 0.7)' },
    { key: "overestimation", text: "Sur-estimation (perçu > réel)", color: 'rgba(54, 162, 235, 0.7)' },
    { key: "underestimation", text: "Sous-estimation (perçu < réel)", color: 'rgba(255, 99, 132, 0.7)' }
];

const QO4_OPTIONS_CONFIG = [
    { key: "qualite", text: "Qualité d'image", color: 'rgba(255, 99, 132, 0.8)' },
    { key: "fluidite", text: "Fluidité", color: 'rgba(54, 162, 235, 0.8)' },
    { key: "confort", text: "Confort visuel global", color: 'rgba(255, 206, 86, 0.8)' },
    { key: "aucun", text: "Aucun de ces critères", color: 'rgba(75, 192, 81, 0.8)' },
];

const SATISFACTION_LEVELS_CONFIG = [
    { key: "verysatisfactory", text: "Très satisfaisant", color: 'rgba(34, 139, 34, 0.8)' },
    { key: "correct", text: "Correct", color: 'rgba(144, 238, 144, 0.8)' },
    { key: "notsatisfactory", text: "Pas vraiment satisfaisant", color: 'rgba(255, 215, 0, 0.8)' },
    { key: "bad", text: "Mauvaise qualité", color: 'rgba(255, 165, 0, 0.8)' },
    { key: "unwatchable", text: "Difficile à regarder", color: 'rgba(220, 20, 60, 0.8)' }
];