const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvParser = require('csv-parser');
const { CSV_FILE_PATH } = require('../config');

const csvWriter = createCsvWriter({
    path: CSV_FILE_PATH,
    header: [
        { id: 'user', title: 'user' },
        { id: 'category1', title: 'category1' },
        { id: 'videoName1', title: 'videoName1' },
        { id: 'videoPath1', title: 'videoPath1' },
        { id: 'resolution1', title: 'resolution1' },
        { id: 'category2', title: 'category2' },
        { id: 'videoName2', title: 'videoName2' },
        { id: 'videoPath2', title: 'videoPath2' },
        { id: 'resolution2', title: 'resolution2' },
        { id: 'QO1', title: 'QO1' },
        { id: 'QO2', title: 'QO2' },
        { id: 'QO3', title: 'QO3' },
        { id: 'QO4', title: 'QO4' },
        { id: 'QO5', title: 'QO5' },
        { id: 'comments', title: 'comments' },
        { id: 'screenType', title: 'screenType' },
        { id: 'timestamp', title: 'timestamp' }
    ],
    append: true
});

// Initialiser le fichier CSV avec les en-têtes s'il n'existe pas
if (!fs.existsSync(CSV_FILE_PATH)) {
    csvWriter.writeRecords([])
        .then(() => console.log('Fichier CSV initialisé avec succès.'))
        .catch(err => console.error("Erreur d'initialisation du CSV :", err));
}

async function appendToCsv(record) {
    try {
        await csvWriter.writeRecords([record]);
    } catch (err) {
        console.error("Erreur lors de l'écriture dans le CSV :", err);
        throw err; // Propage l'erreur pour que l'appelant puisse la gérer
    }
}

function readCsv() {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csvParser())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

module.exports = {
    appendToCsv,
    readCsv
};