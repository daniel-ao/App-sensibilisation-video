
const pseudo = localStorage.getItem("pseudo") || "Utilisateur inconnu";

async function initPersonalCharts(pseudo) {
    const [satisfactionCumul, satisfactionDevice, confusions] = await Promise.all([
        getSatisfactionCumul(pseudo),
        getSatisfactionByDevice(pseudo),
        getConfusionsData(pseudo)
    ]);
    
    let fusion = {};
    ['video1','video2'].forEach(videoKey => {
        if (!satisfactionCumul[videoKey]) return;
        for (let res in satisfactionCumul[videoKey]) {
            if (!RESOLUTION_ORDER.includes(res)) continue;
            if (!fusion[res]) fusion[res] = {};
            for (let qk in satisfactionCumul[videoKey][res]) {
                fusion[res][qk.toLowerCase()] = (fusion[res][qk.toLowerCase()] || 0) + satisfactionCumul[videoKey][res][qk];
            }
        }
    });
    afficherSatisfactionParResolution(fusion, 'Votre Satisfaction Cumulée', 'chartSatisfactionCumul');
    
    afficherSatisfactionParAppareil(satisfactionDevice, 'satisfactionByDeviceChartsContainer', 'Votre Satisfaction');
    
    afficherGraphiqueConfusions(confusions, 'chartConfusions', ['Vos Confusions (Réelle → Perçue)']);
}

async function initGlobalCharts() {
    const [satisfactionCumul, satisfactionDevice, confusions, pairedSatisfaction] = await Promise.all([
        getGlobalSatisfactionCumul(),
        getGlobalSatisfactionByDevice(),
        getGlobalConfusionsData(),
        getGlobalPairedSatisfaction()
    ]);
    
    afficherSatisfactionParResolution(satisfactionCumul, 'Satisfaction Globale Cumulée (Tous Utilisateurs)', 'globalChartSatisfactionCumul');
    afficherSatisfactionParAppareil(satisfactionDevice, 'globalSatisfactionByDeviceChartsContainer', 'Satisfaction Globale');
    afficherGraphiqueConfusions(confusions, 'globalChartConfusions', ['Confusions Globales (Réelle → Perçue)']);
    afficherGraphiqueSatisfactionPaireDistribution(pairedSatisfaction);
    
    // Ces fonctions sont asynchrones et gèrent leur propre fetch
    afficherSatisfactionParCategorie();
    afficherErreurPerceptionParCategorie();
    afficherSatisfactionDetaillee();
}

function initAllCharts(pseudo) {
    initPersonalCharts(pseudo);
    initGlobalCharts();
}

document.addEventListener("DOMContentLoaded", function () {
    // 1. Mise à jour des informations textuelles et du récapitulatif
    updateUserStatsHeader(pseudo);
    displayAllPrecisions(pseudo);
    displayDetailedRecap();
    displaySessionScoreGain();
    
    displayVisualComparison();

    // 2. Initialisation de la comparaison vidéo interactive
    setupVideoComparisons();

    // 3. Lancement de la création de tous les graphiques
    initAllCharts(pseudo);
});