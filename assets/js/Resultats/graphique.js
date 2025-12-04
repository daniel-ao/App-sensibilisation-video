// =================================================================================
// GRAPHIQUE.JS - Moteur de rendu des graphiques de la page de statistiques
// =================================================================================

// Les constantes de configuration sont maintenant dans assets/js/config.js
// Les appels fetch sont maintenant dans assets/js/api.js

/**
 * Retourne le nom d'affichage pour un type d'appareil donné.
 * Convertit 'tablet' en 'TABLETTE' et met les autres en majuscules.
 * @param {string} deviceKey - La clé de l'appareil (ex: 'pc', 'tablet', 'mobile').
 * @returns {string} Le nom formaté pour l'affichage.
 */
function getDeviceDisplayName(deviceKey) {
    if (deviceKey.toLowerCase() === 'tablet') {
        return 'TABLETTE';
    }
    return deviceKey.toUpperCase();
}

// --- FONCTION UTILITAIRE DE CRÉATION DE GRAPHIQUE ---

/**
 * Crée ou met à jour un graphique Chart.js sur un canvas donné.
 * Détruit l'instance existante si elle existe pour éviter les conflits.
 * Ajoute également un bouton pour agrandir le graphique.
 * @param {HTMLCanvasElement} canvas - L'élément canvas où dessiner le graphique.
 * @param {string} type - Le type de graphique (ex: 'bar', 'line').
 * @param {Object} data - Les données du graphique au format Chart.js.
 * @param {Object} options - Les options de configuration du graphique.
 */
function createChart(canvas, type, data, options) {
    if (!canvas) return;
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const chart = new Chart(canvas, {
        type,
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            ...options
        }
    });

    try {
        attachEnlargeButtonToCanvas(canvas, options?.plugins?.title?.text || 'Graphique');
    } catch (e) {
        console.warn('Impossible d\'attacher le bouton d\'agrandissement:', e);
    }
}

/**
 * Attache un bouton flottant "Agrandir" au conteneur du canvas.
 * Ce bouton permet d'ouvrir le graphique en mode plein écran (modal).
 * @param {HTMLCanvasElement} canvas - Le canvas associé au bouton.
 * @param {string} titleText - Le titre à afficher dans la modale.
 */
function attachEnlargeButtonToCanvas(canvas, titleText) {
    // Find a suitable wrapper to host a floating button (no layout shift)
    const wrapper = canvas.closest('.chart-canvas-container, .dynamic-chart-wrapper, .video-chart-wrapper') || canvas.parentElement;
    if (!wrapper) return;

    // Avoid duplicates
    if (wrapper.querySelector('.chart-enlarge-btn-floating')) return;

    // Ensure wrapper can host an absolutely positioned child without affecting layout
    try {
        const pos = getComputedStyle(wrapper).position;
        if (!['relative', 'absolute', 'fixed'].includes(pos)) {
            wrapper.style.position = 'relative';
        }
    } catch (_) {
        // Fallback: set relative
        wrapper.style.position = 'relative';
    }

    const btn = document.createElement('button');
    btn.className = 'small-button chart-enlarge-btn chart-enlarge-btn-floating';
    btn.textContent = 'Agrandir';
    btn.title = 'Ouvrir en grand dans une fenêtre';
    btn.style.position = 'absolute';
    btn.style.top = '6px';
    btn.style.right = '6px';
    btn.style.zIndex = '3';
    btn.style.padding = '4px 8px';
    btn.style.fontSize = '0.8em';
    btn.style.opacity = '0.9';

    btn.addEventListener('click', () => openChartModal(canvas, titleText));

    wrapper.appendChild(btn);
}

/**
 * Ouvre une modale contenant le graphique agrandi.
 * Gère le déplacement du canvas dans la modale et sa restauration à la fermeture.
 * @param {HTMLCanvasElement} originalCanvas - Le canvas à afficher dans la modale.
 * @param {string} titleText - Le titre de la modale.
 */
function openChartModal(originalCanvas, titleText) {
    // Build overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const content = document.createElement('div');
    content.className = 'modal-content';

    const headerBar = document.createElement('div');
    headerBar.className = 'modal-header';
    const title = document.createElement('h4');
    title.textContent = titleText || 'Graphique';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close small-button';
    closeBtn.textContent = 'Fermer';
    headerBar.append(title, closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-body';

    content.append(headerBar, body);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Prevent background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move the existing canvas into the modal and remember where to restore
    const chart = Chart.getChart(originalCanvas);
    const originalParent = originalCanvas.parentElement;
    const placeholder = document.createElement('div');
    placeholder.style.display = 'none';
    originalParent.insertBefore(placeholder, originalCanvas);
    body.appendChild(originalCanvas);

    // Make it bigger
    const prevHeight = originalCanvas.style.height;
    originalCanvas.style.height = '520px';
    try { if (chart) chart.resize(); } catch(_) {}

    function closeModal() {
        // Restore canvas back to original place
        try {
            if (chart) {
                originalCanvas.style.height = prevHeight;
            }
        } catch(_) {}
        if (placeholder.parentElement) {
            placeholder.parentElement.insertBefore(originalCanvas, placeholder);
            placeholder.remove();
        }
        try { if (chart) chart.resize(); } catch(_) {}
        document.body.removeChild(overlay);
        document.body.style.overflow = prevOverflow;
        document.removeEventListener('keydown', onKeydown);
    }

    function onKeydown(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onKeydown);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

// --- FONCTIONS D'AFFICHAGE DES GRAPHIQUES ---

/**
 * Affiche un graphique en barres empilées de la satisfaction par résolution.
 * @param {Object} data - Les données de satisfaction groupées par résolution.
 * @param {string} chartTitle - Le titre du graphique.
 * @param {string} canvasId - L'ID de l'élément canvas HTML.
 */
function afficherSatisfactionParResolution(data, chartTitle, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    let resolutions = Object.keys(data).filter(res => RESOLUTION_ORDER.includes(res))
                          .sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));
    
    const presentQualityKeys = new Set(Object.values(data).flatMap(res => Object.keys(res)));
    const orderedVisibleQualities = SATISFACTION_LEVELS_CONFIG.filter(level => presentQualityKeys.has(level.key));
    
    const totals = resolutions.map(res => orderedVisibleQualities.reduce((sum, qc) => sum + (data[res]?.[qc.key] || 0), 0));

    const datasets = orderedVisibleQualities.map(qc => ({
        label: qc.text, 
        data: resolutions.map((res, i) => totals[i] > 0 ? ((data[res]?.[qc.key] || 0) / totals[i]) * 100 : 0),
        backgroundColor: qc.color 
    }));

    createChart(canvas, 'bar', { labels: resolutions, datasets }, {
        plugins: { 
            title: { display: true, text: chartTitle }, 
            legend: { position: 'top' },
            tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%` } }
        },
        scales: { 
            x: { stacked: true }, 
            y: { stacked: true, min: 0, max: 100, title: { display: true, text: 'Pourcentage d\'avis' }, ticks: { callback: value => value + '%' } } 
        }
    });
}

/**
 * Affiche une série de graphiques de satisfaction, un par appareil (PC, Tablette, Mobile).
 * Gère le cas particulier des statistiques personnelles ("Votre Satisfaction") en affichant des placeholders si les données sont manquantes.
 * @param {Object} fullData - Les données complètes groupées par résolution puis par appareil.
 * @param {string} containerId - L'ID du conteneur HTML où injecter les graphiques.
 * @param {string} [chartTitlePrefix="Satisfaction"] - Préfixe pour le titre de chaque graphique.
 */
function afficherSatisfactionParAppareil(fullData, containerId, chartTitlePrefix = "Satisfaction") {
    console.log('***************************************************************************************************************');
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const allResolutionsSet = new Set(Object.keys(fullData));
    const allDevicesSet = new Set(Object.values(fullData).flatMap(res => Object.keys(res)));
    const sortedResolutions = Array.from(allResolutionsSet)
        .filter(res => RESOLUTION_ORDER.includes(res))
        .sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));
    let devicesArray = Array.from(allDevicesSet)
        .sort((a, b) => DEVICE_ORDER.indexOf(a.toLowerCase()) - DEVICE_ORDER.indexOf(b.toLowerCase()));

    // If personal stats (prefix starts with 'Votre'), ensure we show placeholders for all known devices.
    if (chartTitlePrefix.toLowerCase().startsWith('votre')) {
        const desired = DEVICE_ORDER.slice(0, 3); // pc, tablet, mobile
        // Add missing devices to list preserving order
        devicesArray = desired;
        // Inject empty structures for missing devices across resolutions so loop proceeds.
        sortedResolutions.forEach(res => {
            if (!fullData[res]) fullData[res] = {};
            devicesArray.forEach(dev => {
                if (!fullData[res][dev]) fullData[res][dev] = {}; // empty object => totals zero
            });
        });
    }
    
    devicesArray.forEach(device => {
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'dynamic-chart-wrapper';
        const canvas = document.createElement('canvas');
        chartWrapper.appendChild(canvas);
        container.appendChild(chartWrapper);

        const totals = sortedResolutions.map(res => SATISFACTION_LEVELS_CONFIG
            .reduce((sum, lc) => sum + (fullData[res]?.[device]?.[lc.key] || 0), 0));
    if (totals.every(t => t === 0)) {
            // For personal stats we keep a placeholder instead of removing chart.
            if (chartTitlePrefix.toLowerCase().startsWith('votre')) {
                const placeholder = document.createElement('div');
                placeholder.className = 'no-data-placeholder';
                placeholder.style.textAlign = 'center';
                placeholder.style.padding = '1rem';
                placeholder.style.color = '#6c757d';
                placeholder.textContent = 'Aucune donnée disponible pour cet appareil.';
                chartWrapper.appendChild(placeholder);
            } else {
                container.removeChild(chartWrapper);
            }
            return; // skip dataset creation for this device
        }

        const datasets = SATISFACTION_LEVELS_CONFIG.map(lc => ({
            label: lc.text,
            data: sortedResolutions.map((res, i) => totals[i] > 0 ? ((fullData[res]?.[device]?.[lc.key] || 0) / totals[i]) * 100 : 0),
            backgroundColor: lc.color,
        }));
        const deviceDisplayName = getDeviceDisplayName(device);

        createChart(canvas, 'bar', { labels: sortedResolutions, datasets }, {
            plugins: { 
                title: { display: true, text: `${chartTitlePrefix} sur ${deviceDisplayName}` },
                legend: { position: 'top' }, 
                tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%` } }
            },
            scales: { 
                x: { stacked: true, title: { display: true, text: 'Résolution' } }, 
                y: { stacked: true, min: 0, max: 100, title: { display: true, text: 'Pourcentage d\'avis' }, ticks: { callback: value => value + '%' } } 
            }
        });
    });
}

/**
 * Affiche un graphique horizontal des confusions de résolution (Réelle -> Perçue).
 * Filtre les paires invalides et agrège les comptes.
 * @param {Array} confusionsArray - Tableau d'objets { pair: "res1 -> res2", count: N }.
 * @param {string} canvasId - L'ID du canvas.
 * @param {string|Array} chartTitle - Le titre du graphique.
 */
function afficherGraphiqueConfusions(confusionsArray, canvasId, chartTitle) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { console.log(`Canvas ${canvasId} non trouvé.`); return; }
    
    if (!confusionsArray || confusionsArray.length === 0) {
        const ctx = canvas.getContext('2d');
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) existingChart.destroy();
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        ctx.font = "16px Arial"; ctx.textAlign = "center";
        ctx.fillText("Aucune donnée de confusion à afficher.", canvas.width / 2, canvas.height / 2);
        return;
    }
    // --- Normalisation & Filtrage ---
    const cleaned = [];
    const invalid = [];
    confusionsArray.forEach(item => {
        const parts = item.pair.split('→'); // already formatted "real → perceived"
        if (parts.length !== 2) { invalid.push(item); return; }
        const real = parts[0].trim();
        const perceived = parts[1].trim();
        const realLower = real.toLowerCase();
        const perceivedLower = perceived.toLowerCase();
        if (RESOLUTION_ORDER.includes(realLower) && RESOLUTION_ORDER.includes(perceivedLower)) {
            cleaned.push({ pair: `${realLower} → ${perceivedLower}`, count: item.count });
        } else {
            invalid.push(item);
        }
    });

    // Combine duplicates after lowercasing.
    const aggregatedMap = new Map();
    cleaned.forEach(item => {
        const prev = aggregatedMap.get(item.pair) || 0;
        aggregatedMap.set(item.pair, prev + item.count);
    });
    const aggregated = Array.from(aggregatedMap.entries()).map(([pair, count]) => ({ pair, count }));

    // Sort by count descending
    aggregated.sort((a, b) => b.count - a.count);

    const labels = aggregated.map(item => item.pair);
    const dataCounts = aggregated.map(item => item.count);

    // Adjust chart title coercing to string
    const finalTitle = Array.isArray(chartTitle) ? chartTitle.join(' ') : (chartTitle || 'Confusions');

    createChart(canvas, 'bar', {
        labels,
        datasets: [{
            label: 'Nombre de Confusions',
            data: dataCounts,
            backgroundColor: 'rgba(118, 189, 216, 0.7)',
            borderColor: 'rgba(75, 152, 192, 1)',
            borderWidth: 1
        }]
    }, {
        indexAxis: 'x',
        plugins: {
            title: { display: true, text: finalTitle },
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: items => items[0].label,
                    label: ctx => `Occurrences: ${ctx.parsed.y}`
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: 'Résolution réelle → Résolution perçue' },
                ticks: { maxRotation: 50, minRotation: 30, autoSkip: false }
            },
            y: {
                beginAtZero: true,
                title: { display: true, text: "Nombre d'occurrences" },
                ticks: { precision: 0 }
            }
        }
    });

    // Optional: display info about filtered invalid pairs
    if (invalid.length > 0) {
        const wrapper = canvas.closest('.chart-canvas-container') || canvas.parentElement;
        if (wrapper && !wrapper.querySelector('.confusions-filter-note')) {
            const note = document.createElement('div');
            note.className = 'confusions-filter-note';
            note.style.fontSize = '0.7rem';
            note.style.marginTop = '4px';
            note.style.color = '#6c757d';
            note.textContent = `${invalid.length} entrées ignorées (valeurs non reconnues).`;
            wrapper.appendChild(note);
        }
    }
}
//todo
/**
 * Affiche un graphique comparant la distribution de satisfaction pour des paires de résolutions.
 * Utile pour les comparaisons directes (A/B testing).
 * @param {Object} data - Données structurées par paire de résolutions.
 */
function afficherGraphiqueSatisfactionPaireDistribution(data) {
    const canvas = document.getElementById('chartPairedSatisfaction');
    if (!canvas || Object.keys(data).length === 0) return;

    const sortedPairs = Object.keys(data).sort((a, b) => RESOLUTION_ORDER.indexOf(a.split('-')[0]) - RESOLUTION_ORDER.indexOf(b.split('-')[0]));
    const labels = sortedPairs.map(key => key.split('-'));
    
    const totals1 = sortedPairs.map(key => Object.values(data[key].res1.counts).reduce((sum, count) => sum + count, 0));
    const totals2 = sortedPairs.map(key => Object.values(data[key].res2.counts).reduce((sum, count) => sum + count, 0));

    const datasets = [];
    SATISFACTION_LEVELS_CONFIG.forEach(levelConfig => {
        datasets.push({
            label: levelConfig.text,
            data: sortedPairs.map((key, i) => totals1[i] > 0 ? (data[key].res1.counts[levelConfig.key] / totals1[i]) * 100 : 0),
            backgroundColor: levelConfig.color,
            stack: 'res1'
        });
        datasets.push({
            label: levelConfig.text,
            data: sortedPairs.map((key, i) => totals2[i] > 0 ? (data[key].res2.counts[levelConfig.key] / totals2[i]) * 100 : 0),
            backgroundColor: levelConfig.color,
            stack: 'res2'
        });
    });

    createChart(canvas, 'bar', { labels, datasets }, {
        plugins: {
            title: { display: false },
            tooltip: { mode: 'index', callbacks: { label: context => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%` } },
            legend: { labels: { filter: (item) => item.datasetIndex < SATISFACTION_LEVELS_CONFIG.length } }
        },
        scales: {
            x: { stacked: false, title: { display: true, text: 'Paire de Résolutions Comparées' } },
            y: { stacked: true, min: 0, max: 100, title: { display: true, text: 'Pourcentage d\'avis' }, ticks: { callback: value => value + '%' } }
        },
    });
}

/**
 * Récupère et affiche la satisfaction globale groupée par catégorie de vidéo.
 * Utilise un graphique en barres empilées.
 */
async function afficherSatisfactionParCategorie() {
    const data = await getGlobalSatisfactionByCategory();
    const canvas = document.getElementById('chartSatisfactionByCategory');
    if (!canvas || !data) return;
    
    const categories = Object.keys(data).filter(cat => cat);
    if (categories.length === 0) return;

    // Calcul des totaux pour chaque catégorie.
    // On s'assure de prendre en compte toutes les clés possibles.
    const totals = categories.map(cat => 
        SATISFACTION_LEVELS_CONFIG.reduce((sum, level) => sum + (data[cat][level.key] || 0), 0)
    );

    // --- CORRECTION CLÉ ---
    // Au lieu de filtrer les niveaux de satisfaction présents, 
    // on parcourt TOUS les niveaux définis dans la configuration.
    const datasets = SATISFACTION_LEVELS_CONFIG.map(levelConfig => ({
        label: levelConfig.text,
        // Pour chaque catégorie, on calcule le pourcentage.
        // Si la clé n'existe pas dans les données (ex: data[cat]['verysatisfactory'] est undefined),
        // (data[cat][levelConfig.key] || 0) renverra 0, ce qui est le comportement souhaité.
        data: categories.map((cat, i) => {
            const count = data[cat][levelConfig.key] || 0;
            const total = totals[i];
            return total > 0 ? (count / total) * 100 : 0;
        }),
        backgroundColor: levelConfig.color
    }));
    // --- FIN DE LA CORRECTION ---

    createChart(canvas, 'bar', { labels: categories, datasets }, {
        plugins: { 
            title: { display: false }, 
            legend: { position: 'top' },
            tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%` } }
        },
        scales: {
            x: { stacked: true, title: { display: true, text: 'Catégorie' } },
            y: { 
                stacked: true, 
                min: 0, 
                max: 100, 
                title: { display: true, text: 'Pourcentage d\'avis' }, 
                ticks: { callback: value => value + '%' } 
            }
        }
    });
}

/**
 * Récupère et affiche le taux d'erreur de perception par catégorie de vidéo.
 * Montre la proportion de réponses correctes vs incorrectes.
 */
async function afficherErreurPerceptionParCategorie() {
    const data = await getGlobalPerceptionByCategory();
    const canvas = document.getElementById('chartPerceptionErrorByCategory');
    if (!canvas || !data) return;

    const categories = Object.keys(data).filter(cat => cat);
    if (categories.length === 0) return;

    const datasets = PERCEPTION_LEVELS_CONFIG.map(level => ({
        label: level.text,
        data: categories.map(cat => ((data[cat][level.key] || 0) / (data[cat].total || 1)) * 100),
        backgroundColor: level.color
    }));

    createChart(canvas, 'bar', { labels: categories, datasets }, {
        plugins: {
            title: { display: false },
            tooltip: { callbacks: { label: context => `${context.dataset.label || ''}: ${context.parsed.y.toFixed(1)}%` } }
        },
        scales: {
            x: { stacked: true, title: { display: true, text: 'Catégorie' } },
            y: { stacked: true, beginAtZero: true, max: 100, title: { display: true, text: 'Pourcentage des réponses' } }
        }
    });
}

/**
 * Affiche une vue détaillée de la satisfaction, segmentée par appareil et catégorie.
 * Crée dynamiquement des blocs de graphiques avec un sélecteur de résolution pour chaque appareil.
 */
async function afficherSatisfactionDetaillee() {
    try {
        const data = await getGlobalSatisfactionDetailed();
        const container = document.getElementById('satisfactionByCategoryAndDeviceContainer');
        if (!container || !data) {
            console.error("Conteneur ou données manquantes pour la satisfaction détaillée.");
            return;
        }
        container.innerHTML = '';

        const devicesToDisplay = ['pc', 'tablet', 'mobile'];
        devicesToDisplay.forEach(device => {
            const deviceData = data[device];
            if (!deviceData || Object.keys(deviceData).length === 0) return;
            
            const chartBlock = document.createElement('div');
            chartBlock.className = 'device-chart-block';
            const title = document.createElement('h3');
            title.textContent = `Analyse sur ${device.toUpperCase()}`;
            const select = document.createElement('select');
            select.className = 'resolution-selector';
            const canvasContainer = document.createElement('div');
            canvasContainer.className = 'chart-canvas-container';
            const canvas = document.createElement('canvas');
            canvasContainer.appendChild(canvas);
            chartBlock.append(title, select, canvasContainer);
            container.appendChild(chartBlock);

            const availableResolutions = Array.from(new Set(Object.values(deviceData).flatMap(cat => Object.keys(cat))))
                .sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));
            if (availableResolutions.length === 0) {
                chartBlock.innerHTML += "<p>Pas de données de résolution pour cet appareil.</p>";
                return;
            }

            availableResolutions.forEach(res => {
                const option = document.createElement('option');
                option.value = res;
                option.textContent = res;
                select.appendChild(option);
            });

            let defaultResolution = availableResolutions.includes('1080p') ? '1080p' : availableResolutions[0];
            select.value = defaultResolution;

            function updateChart(selectedResolution) {
                const categoriesWithThisRes = Object.keys(deviceData).filter(cat => deviceData[cat][selectedResolution]);
                const totals = categoriesWithThisRes.map(cat => Object.values(deviceData[cat][selectedResolution]).reduce((sum, count) => sum + count, 0));
                const datasets = SATISFACTION_LEVELS_CONFIG.map(level => ({
                    label: level.text,
                    data: categoriesWithThisRes.map((cat, i) => {
                        const count = deviceData[cat][selectedResolution]?.[level.key] || 0;
                        return totals[i] > 0 ? (count / totals[i]) * 100 : 0;
                    }),
                    backgroundColor: level.color,
                }));
                const deviceDisplayName = getDeviceDisplayName(device);

                createChart(canvas, 'bar', { labels: categoriesWithThisRes, datasets }, {
                    plugins: { 
                        title: { display: true, text: `Satisfaction pour ${selectedResolution} sur ${deviceDisplayName}` }, 
                        legend: { position: 'top' },
                        tooltip: { callbacks: { label: context => `${context.dataset.label || ''}: ${context.parsed.y.toFixed(1)}%` } }
                    },
                    scales: { 
                        x: { stacked: true, title: { display: true, text: 'Catégorie' } }, 
                        y: { stacked: true, min: 0, max: 100, title: { display: true, text: "Pourcentage d'avis" }, ticks: { callback: value => value + '%' } } 
                    }
                });
            }
            select.addEventListener('change', (e) => updateChart(e.target.value));
            updateChart(defaultResolution);
        });
    } catch (error) {
        console.error("Erreur lors de l'affichage des graphiques de satisfaction détaillés:", error);
        const container = document.getElementById('satisfactionByCategoryAndDeviceContainer');
        if (container) container.innerHTML = "<p>Erreur lors du chargement de ces graphiques.</p>";
    }
}

/**
 * Affiche un graphique de perception pour une vidéo spécifique.
 * Montre comment les utilisateurs ont perçu la qualité de la vidéo par rapport à sa résolution réelle.
 * @param {string} canvasId - L'ID du canvas.
 * @param {Object} videoData - Les données de perception pour la vidéo.
 */
function afficherGraphiquePerceptionVideo(canvasId, videoData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (!videoData || Object.keys(videoData).length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Pas encore de statistiques pour cette vidéo.", canvas.width / 2, 40);
        return;
    }

    const sortedResolutions = Object.keys(videoData)
        .sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));

    const datasets = PERCEPTION_LEVELS_CONFIG.map(level => ({
        label: level.text,
        data: sortedResolutions.map(res => {
            const total = videoData[res]?.total || 1;
            const count = videoData[res]?.[level.key] || 0;
            return (count / total) * 100;
        }),
        backgroundColor: level.color,
    }));

    createChart(canvas, 'bar', { labels: sortedResolutions, datasets }, {
        plugins: {
            title: { display: false },
            tooltip: { callbacks: { label: context => `${context.dataset.label || ''}: ${context.parsed.y.toFixed(1)}%` } }
        },
        scales: {
            x: { stacked: true, title: { display: true, text: 'Résolution réelle' } },
            y: { stacked: true, min: 0, max: 100, title: { display: true, text: '% des estimations' }, ticks: { callback: (value) => value + '%' } }
        }
    });
}


/**
 * Affiche les graphiques de satisfaction pour une vidéo spécifique, séparés par appareil.
 * @param {HTMLElement} container - Le conteneur HTML où ajouter les graphiques.
 * @param {Object} data - Les données de satisfaction de la vidéo.
 * @param {string} videoName - Le nom de la vidéo pour le titre.
 */
function afficherSatisfactionVideoParAppareil(container, data, videoName) {
    console.log('***************************************************************************************************************');
    if (!container || Object.keys(data).length === 0) {
        container.innerHTML = "<p style='text-align:center; color: #888; padding: 1rem;'>Pas de données de satisfaction pour cette vidéo.</p>";
        return;
    }
    container.innerHTML = ''; // Nettoyer le conteneur

    // Trier les appareils selon l'ordre défini
    const devices = Object.keys(data).sort((a, b) => DEVICE_ORDER.indexOf(a) - DEVICE_ORDER.indexOf(b));

    devices.forEach(device => {
        const deviceData = data[device];
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'dynamic-chart-wrapper';
        const canvas = document.createElement('canvas');
        chartWrapper.appendChild(canvas);
        container.appendChild(chartWrapper);

        // Obtenir et trier les résolutions disponibles pour CET appareil
        const resolutions = Object.keys(deviceData).sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));
        if (resolutions.length === 0) return;

        // Calculer les totaux pour chaque barre (chaque résolution)
        const totals = resolutions.map(res => 
            SATISFACTION_LEVELS_CONFIG.reduce((sum, level) => sum + (deviceData[res][level.key] || 0), 0)
        );

        const datasets = SATISFACTION_LEVELS_CONFIG.map(level => ({
            label: level.text,
            data: resolutions.map((res, i) => {
                const count = deviceData[res][level.key] || 0;
                return totals[i] > 0 ? (count / totals[i]) * 100 : 0;
            }),
            backgroundColor: level.color,
        }));
        
        createChart(canvas, 'bar', { labels: resolutions, datasets }, {
            plugins: { 
                title: { display: true, text: `Satisfaction pour "${videoName}" sur ${device.toUpperCase()}` },
                legend: { position: 'top' }, 
                tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%` } }
            },
            scales: { 
                x: { stacked: true, title: { display: true, text: 'Résolution' } }, 
                y: { stacked: true, min: 0, max: 100, title: { display: true, text: 'Pourcentage d\'avis' }, ticks: { callback: value => value + '%' } } 
            }
        });
    });
}