// backend/src/server/main.js

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3300;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Servir les fichiers statiques du dossier parent
const staticPath = path.join(__dirname, '..', '..', '..');
app.use(express.static(path.join(staticPath, 'frontend')));
app.use('/frontend', express.static(path.join(staticPath, 'frontend')));
app.use('/assets', express.static(path.join(staticPath, 'frontend', 'assets')));
app.use('/Videos_License', express.static(path.join(staticPath, 'Videos_License')));
app.use('/Videos_Creative_Common', express.static(path.join(staticPath, 'Videos_Creative_Common')));
app.use('/Videos_enfants', express.static(path.join(staticPath, 'Videos_enfants')));

// Brancher les routes de l'API
app.use('/', apiRoutes);

// Démarrage du serveur
app.listen(PORT, HOST, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
    console.log('Pour accéder depuis d\'autres appareils, utilisez une des adresses IP de votre machine.');
    
    // Afficher les IPs locales
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`- http://${net.address}:${PORT}/frontend/index.html`);
            }
        }
    }
});