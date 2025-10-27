const fs = require('fs');
const { DATA_JSON_PATH } = require('../config');

let dataCache = {
    scores: {},
    times: {},
    precisions: {}
};

function loadDataFromFile() {
    if (fs.existsSync(DATA_JSON_PATH)) {
        try {
            const rawData = fs.readFileSync(DATA_JSON_PATH);
            const jsonData = JSON.parse(rawData);
            dataCache = {
                scores: jsonData.scores || {},
                times: jsonData.times || {},
                precisions: jsonData.precisions || {}
            };
            console.log("✅ Données JSON chargées depuis data.json");
        } catch (error) {
            console.error("❌ Erreur lors du chargement des données JSON :", error);
        }
    }
}

function saveDataToFile() {
    try {
        fs.writeFileSync(DATA_JSON_PATH, JSON.stringify(dataCache, null, 2));
        console.log("💾 Données JSON sauvegardées dans data.json");
    } catch (err) {
        console.error("❌ Erreur lors de la sauvegarde JSON :", err);
    }
}

// Charger les données au démarrage
loadDataFromFile();

module.exports = {
    getData: () => dataCache,
    saveData: saveDataToFile,
    updateData: (newData) => {
        dataCache = { ...dataCache, ...newData };
        saveDataToFile();
    }
};