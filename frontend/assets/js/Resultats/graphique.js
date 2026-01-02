// frontend/assets/js/Resultats/graphique.js

// Les constantes de configuration sont maintenant dans assets/js/config.js
// Les appels fetch sont maintenant dans assets/js/api.js

document.addEventListener("DOMContentLoaded", async function () {
    console.log("========== GRAPHIQUE.JS INIT ==========");
    console.log("[GRAPHIQUE] localStorage.pseudo =", localStorage.getItem("pseudo"));
    console.log("[GRAPHIQUE] localStorage.displayPseudo =", localStorage.getItem("displayPseudo"));
    console.log("[GRAPHIQUE] localStorage.guestDeclinedSave =", localStorage.getItem("guestDeclinedSave"));
    console.log("[GRAPHIQUE] URL =", window.location.href);
    
    // --- 1. Check Login Status & Handle Buttons ---
    const actionContainer = document.getElementById('actionButtonsContainer');
    const urlParams = new URLSearchParams(window.location.search);
    const isGuestFromUrl = urlParams.get('guest') === 'true';
    const hadDeclinedSave = localStorage.getItem("guestDeclinedSave") === "true";
    
    // If user declined save, data is in DB, so treat as non-guest for data loading
    const isGuest = isGuestFromUrl && !hadDeclinedSave;
    console.log("[GRAPHIQUE] isGuestFromUrl =", isGuestFromUrl);
    console.log("[GRAPHIQUE] hadDeclinedSave =", hadDeclinedSave);
    console.log("[GRAPHIQUE] isGuest (final) =", isGuest);
    
    try {
        const meRes = await fetch(`${API_BASE_URL}/api/me`);
        const meData = await meRes.json();
        console.log("[GRAPHIQUE] /api/me response =", meData);
        const isLoggedIn = meData.loggedIn;
        
        // Get the pseudo to use for API calls (the one in DB)
        const dbPseudo = isLoggedIn ? meData.user.pseudo : (localStorage.getItem("pseudo") || "Invité");
        // Get the pseudo to display (original one if user declined save)
        const displayPseudo = localStorage.getItem("displayPseudo") || localStorage.getItem("originalPseudo") || dbPseudo;
        
        console.log("[GRAPHIQUE] isLoggedIn =", isLoggedIn);
        console.log("[GRAPHIQUE] dbPseudo (for API) =", dbPseudo);
        console.log("[GRAPHIQUE] displayPseudo (for UI) =", displayPseudo);

        // Update Header Pseudo with the DISPLAY pseudo (not the __guest one)
        const pseudoEl = document.getElementById('userPseudo');
        if (pseudoEl) pseudoEl.textContent = displayPseudo;

        if (actionContainer) {
            actionContainer.innerHTML = ''; // Clear existing

            if (isLoggedIn) {
                // Logged In: Show "Voir mes données"
                const myDataBtn = document.createElement('a');
                myDataBtn.href = `donnees.html?q=${encodeURIComponent(dbPseudo)}`;
                myDataBtn.className = 'btn-primary';
                myDataBtn.textContent = 'Voir mes données';
                myDataBtn.style.marginRight = '10px';
                actionContainer.appendChild(myDataBtn);
            } else if (isGuestFromUrl) {
                // Guest (from URL): Show "Sauvegarder" button
                const saveBtn = document.createElement('button');
                saveBtn.className = 'btn-primary';
                saveBtn.textContent = 'Sauvegarder mes résultats et créer un compte';
                saveBtn.onclick = openSaveModal;
                actionContainer.appendChild(saveBtn);
            }
            
            // Always show "Retour à l'accueil"
            const homeBtn = document.createElement('a');
            homeBtn.href = 'index.html';
            homeBtn.className = 'btn-secondary';
            homeBtn.textContent = "Retour à l'accueil";
            homeBtn.style.marginLeft = '10px';
            actionContainer.appendChild(homeBtn);
        }

        // --- 2. Load Data Logic ---
        // If guest with data in sessionStorage, load from sessionStorage
        // If guest who declined (data in DB), load from server
        // If logged in, load from server
        console.log("[GRAPHIQUE] About to load data. isGuest =", isGuest, "dbPseudo =", dbPseudo);
        if (isGuest) {
            console.log("[GRAPHIQUE] Calling loadGuestData()");
            loadGuestData();
        } else {
            console.log("[GRAPHIQUE] Calling loadUserData() with pseudo =", dbPseudo);
            loadUserData(dbPseudo);
        }
        
        // Always load global stats
        console.log("[GRAPHIQUE] Calling loadGlobalStats()");
        loadGlobalStats();

    } catch (e) {
        console.error("Error initializing results page:", e);
    }
});

function openSaveModal() {
    // Reuse the register modal from index.html logic, but we need to inject it here or redirect
    // Simpler approach: Redirect to index.html with a special flag to open register modal
    // OR: Implement a simple modal here. Let's implement a simple modal here for better UX.
    
    let modal = document.getElementById('saveRegisterModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'saveRegisterModal';
        modal.className = 'popup-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="popup-box" style="max-width: 400px;">
                <h3>Sauvegarder et S'inscrire</h3>
                <p>Créez un compte pour sauvegarder vos résultats définitivement.</p>
                <form id="saveRegisterForm">
                    <div class="input-group" style="margin-bottom: 15px;">
                        <label>Pseudo</label>
                        <input type="text" id="savePseudo" required class="input-field" style="width: 100%;">
                    </div>
                    <div class="input-group" style="margin-bottom: 15px;">
                        <label>Email</label>
                        <input type="email" id="saveEmail" required class="input-field" style="width: 100%;">
                    </div>
                    <div class="input-group" style="margin-bottom: 15px;">
                        <label>Mot de passe</label>
                        <input type="password" id="savePassword" required class="input-field" style="width: 100%;">
                    </div>
                    <div id="saveFeedback" style="color: red; display: none; margin-bottom: 10px;"></div>
                    <div class="quiz-buttons">
                        <button type="button" id="saveCancelBtn" class="quiz-btn quiz-btn-cancel">Annuler</button>
                        <button type="submit" class="quiz-btn quiz-btn-submit">S'inscrire</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Pre-fill pseudo - use original pseudo if user had previously declined
        // Check if user previously declined (originalPseudo or displayPseudo was saved)
        const originalPseudo = localStorage.getItem("originalPseudo") || localStorage.getItem("displayPseudo");
        const currentPseudo = localStorage.getItem("pseudo");
        const pseudoToShow = originalPseudo || currentPseudo;
        
        if (pseudoToShow) document.getElementById('savePseudo').value = pseudoToShow;

        document.getElementById('saveCancelBtn').onclick = () => modal.style.display = 'none';
        
        document.getElementById('saveRegisterForm').onsubmit = async (e) => {
            e.preventDefault();
            console.log("========== SAVE REGISTER FORM SUBMIT ==========");
            console.log("[SAVE] BEFORE - localStorage.pseudo =", localStorage.getItem("pseudo"));
            console.log("[SAVE] BEFORE - localStorage.originalPseudo =", localStorage.getItem("originalPseudo"));
            console.log("[SAVE] BEFORE - localStorage.displayPseudo =", localStorage.getItem("displayPseudo"));
            
            const pseudo = document.getElementById('savePseudo').value.trim();
            const email = document.getElementById('saveEmail').value.trim();
            const password = document.getElementById('savePassword').value;
            const feedback = document.getElementById('saveFeedback');
            
            // Get the current DB pseudo (might be __guest version if user declined before)
            const dbPseudo = localStorage.getItem("pseudo");
            const hadDeclinedBefore = localStorage.getItem("guestDeclinedSave") === "true";
            
            console.log("[SAVE] New pseudo from form =", pseudo);
            console.log("[SAVE] Current DB pseudo =", dbPseudo);
            console.log("[SAVE] Had declined before =", hadDeclinedBefore);
            
            try {
                // Check if we have session data in sessionStorage (not yet saved to DB)
                const sessions = JSON.parse(sessionStorage.getItem("feedbackSessions")) || [];
                
                // Case 1: Data still in sessionStorage (user never declined, just clicking save)
                if (sessions.length > 0) {
                    console.log("[SAVE] Saving", sessions.length, "sessions from sessionStorage");
                    for (const session of sessions) {
                        session.user = pseudo;
                        await fetch(`${API_BASE_URL}/addUser`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(session)
                        });
                    }
                }
                
                // Case 2: User had declined before, data is in DB with __guest pseudo
                // We need to link/migrate that data to the new pseudo
                if (hadDeclinedBefore && dbPseudo && dbPseudo !== pseudo) {
                    console.log("[SAVE] Linking guest data from", dbPseudo, "to", pseudo);
                    await fetch(`${API_BASE_URL}/api/link-guest-data`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oldPseudo: dbPseudo, newPseudo: pseudo })
                    });
                }
                
                // 1. Register
                const regRes = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pseudo, email, password })
                });
                const regData = await regRes.json();
                
                if (!regData.success) {
                    feedback.textContent = regData.message;
                    feedback.style.display = 'block';
                    return;
                }

                // 2. Login
                const loginRes = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pseudo, password })
                });
                const loginData = await loginRes.json();
                
                if (!loginData.success) {
                    feedback.textContent = "Inscription réussie, mais échec de connexion automatique.";
                    feedback.style.display = 'block';
                    return;
                }
                
                // 3. Update localStorage with the NEW pseudo and clear guest flags
                // Keep sessionStorage for recap display - will be cleared when starting new session
                console.log("[SAVE] Setting localStorage.pseudo to:", pseudo);
                localStorage.setItem("pseudo", pseudo);
                localStorage.removeItem("displayPseudo");
                localStorage.removeItem("originalPseudo");
                localStorage.removeItem("guestDeclinedSave");
                
                console.log("[SAVE] AFTER - localStorage.pseudo =", localStorage.getItem("pseudo"));
                console.log("[SAVE] Redirecting to resultats.html (without ?guest=true)");
                
                // 4. Reload as logged in user (without ?guest=true)
                window.location.href = 'resultats.html';

            } catch (err) {
                console.error(err);
                feedback.textContent = "Erreur serveur.";
                feedback.style.display = 'block';
            }
        };
    } else {
        modal.style.display = 'flex';
    }
}

function loadGuestData() {
    const sessions = JSON.parse(sessionStorage.getItem("feedbackSessions")) || [];
    if (sessions.length === 0) return;

    // 1. Calculate Score & Time (Local approximation)
    let totalScore = 0;
    let totalTime = 0;
    
    // Helper to calculate points (copied from main.js logic)
    function calculateResolutionPoints(correctRes, userRes) {
        const iCorrect = RESOLUTION_ORDER.indexOf(correctRes);
        const iUser = RESOLUTION_ORDER.indexOf(userRes);
        if (iUser === -1 || iCorrect === -1) return 0;
        const diff = Math.abs(iUser - iCorrect);
        if (diff === 0) return 2;
        if (diff === 1) return 1;
        return 0;
    }

    sessions.forEach(session => {
        // Score
        const resPoints1 = calculateResolutionPoints(session.resolution1, (session.QO1.match(/\(([^,]*),/) || [])[1]?.trim());
        const resPoints2 = calculateResolutionPoints(session.resolution2, (session.QO1.match(/,([^)]*)\)/) || [])[1]?.trim());
        totalScore += resPoints1 + resPoints2;
        
        const indexRes1 = RESOLUTION_ORDER.indexOf(session.resolution1);
        const indexRes2 = RESOLUTION_ORDER.indexOf(session.resolution2);
        let correctPreference = "inconnu";
        if (indexRes1 > indexRes2) correctPreference = "first";
        else if (indexRes2 > indexRes1) correctPreference = "second";
        else if (indexRes1 !== -1) correctPreference = "none";
        if (session.QO3 === correctPreference) totalScore += 1;

        // Time (We don't have per-session time stored in session object in main.js, only sent to server)
        // So we can't easily show total time unless we stored it. 
        // Assuming we can't show time for now.
    });

    document.getElementById('userScore').textContent = totalScore;
    document.getElementById('userTime').textContent = "Non enregistré"; // Or hide
    document.getElementById('levelText').textContent = "Invité";

    // 2. Generate Data for Charts
    // We need to transform 'sessions' into the format expected by the chart functions.
    
    // Data for: afficherSatisfactionParResolution (Satisfaction Cumulée)
    // Format: { "1080p": { "verySatisfactory": 5, "correct": 2 ... }, ... }
    const satisfactionData = {};
    
    // Data for: afficherGraphiqueConfusions (Confusions)
    // Format: [ { pair: "1080p -> 720p", count: 1 }, ... ]
    const confusionsMap = new Map();

    // Data for: afficherSatisfactionParAppareil (Satisfaction par Appareil)
    // Format: { "1080p": { "pc": { "verySatisfactory": 1... }, "mobile": ... } }
    const satisfactionByDeviceData = {};

    sessions.forEach(session => {
        const device = session.screenType || 'pc'; // Default to pc if missing
        
        // Process Video 1
        if (session.resolution1) {
            const q1 = (session.QO2.match(/\(([^,]*),/) || [])[1]?.trim(); // Satisfaction 1
            const p1 = (session.QO1.match(/\(([^,]*),/) || [])[1]?.trim(); // Perception 1
            
            if (q1) {
                // Satisfaction Cumul
                if (!satisfactionData[session.resolution1]) satisfactionData[session.resolution1] = {};
                satisfactionData[session.resolution1][q1] = (satisfactionData[session.resolution1][q1] || 0) + 1;

                // Satisfaction Device
                if (!satisfactionByDeviceData[session.resolution1]) satisfactionByDeviceData[session.resolution1] = {};
                if (!satisfactionByDeviceData[session.resolution1][device]) satisfactionByDeviceData[session.resolution1][device] = {};
                satisfactionByDeviceData[session.resolution1][device][q1] = (satisfactionByDeviceData[session.resolution1][device][q1] || 0) + 1;
            }
            
            if (p1) {
                const pair = `${session.resolution1} → ${p1}`;
                confusionsMap.set(pair, (confusionsMap.get(pair) || 0) + 1);
            }
        }

        // Process Video 2
        if (session.resolution2) {
            const q2 = (session.QO2.match(/,([^)]*)\)/) || [])[1]?.trim(); // Satisfaction 2
            const p2 = (session.QO1.match(/,([^)]*)\)/) || [])[1]?.trim(); // Perception 2
            
            if (q2) {
                // Satisfaction Cumul
                if (!satisfactionData[session.resolution2]) satisfactionData[session.resolution2] = {};
                satisfactionData[session.resolution2][q2] = (satisfactionData[session.resolution2][q2] || 0) + 1;

                // Satisfaction Device
                if (!satisfactionByDeviceData[session.resolution2]) satisfactionByDeviceData[session.resolution2] = {};
                if (!satisfactionByDeviceData[session.resolution2][device]) satisfactionByDeviceData[session.resolution2][device] = {};
                satisfactionByDeviceData[session.resolution2][device][q2] = (satisfactionByDeviceData[session.resolution2][device][q2] || 0) + 1;
            }

            if (p2) {
                const pair = `${session.resolution2} → ${p2}`;
                confusionsMap.set(pair, (confusionsMap.get(pair) || 0) + 1);
            }
        }
    });

    // Convert confusions map to array
    const confusionsArray = Array.from(confusionsMap.entries()).map(([pair, count]) => ({ pair, count }));

    console.log("DEBUG loadGuestData: satisfactionData =", satisfactionData);
    console.log("DEBUG loadGuestData: confusionsArray =", confusionsArray);
    console.log("DEBUG loadGuestData: satisfactionByDeviceData =", satisfactionByDeviceData);

    // 3. Render Charts
    // We use the existing functions!
    
    // Satisfaction Cumulée
    const ctxSat = document.getElementById('chartSatisfactionCumul');
    if (ctxSat) {
        // We need to adapt 'afficherSatisfactionParResolution' logic or call it if it was exported?
        // It is defined in this file, so we can call it directly if we are in the same scope.
        // Wait, 'afficherSatisfactionParResolution' is defined below. We can call it.
        afficherSatisfactionParResolution(satisfactionData, 'Votre Satisfaction', 'chartSatisfactionCumul');
    }

    // Confusions
    // 'afficherGraphiqueConfusions' expects array of { pair, count }
    afficherGraphiqueConfusions(confusionsArray, 'chartConfusions', 'Vos Confusions');

    // Satisfaction par Appareil
    // 'afficherSatisfactionParAppareil' expects { res: { device: { level: count } } }
    afficherSatisfactionParAppareil(satisfactionByDeviceData, 'satisfactionByDeviceChartsContainer', 'Votre Satisfaction');

    // Show the charts container (it was hidden in previous version)
    document.getElementById('personalCharts').style.display = 'block';
    
    // Note: The "Récapitulatif Détaillé" is populated by displayDetailedRecap() in main.js,
    // which uses sessionStorage data. This works for both logged-in users and guests.
}

function loadUserData(pseudo) {
    // For logged-in users, just load the score and time display.
    // The charts are handled by main.js -> initPersonalCharts() which uses the proper rendering functions.
    fetch(`${API_BASE_URL}/getScore?pseudo=${encodeURIComponent(pseudo)}`)
        .then(r => r.json())
        .then(d => {
            const scoreEl = document.getElementById('userScore');
            if(d.score !== undefined && scoreEl) scoreEl.textContent = d.score;
        });
        
    fetch(`${API_BASE_URL}/getTime?pseudo=${encodeURIComponent(pseudo)}`)
        .then(r => r.json())
        .then(d => {
            const timeEl = document.getElementById('userTime');
            if(d.time !== undefined && timeEl) {
                const min = Math.floor(d.time / 60);
                const sec = d.time % 60;
                timeEl.textContent = `${min}m ${sec}s`;
            }
        });
    
    // NOTE: Personal charts are loaded by main.js -> initPersonalCharts()
    // Do NOT call loadPersonalCharts here to avoid duplicate/conflicting chart creation
}

function loadGlobalStats() {
    // Global charts are loaded by main.js -> initGlobalCharts()
    // Do NOT load them here to avoid duplicate/conflicting chart creation
}

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
    console.log("DEBUG afficherSatisfactionParResolution: canvasId =", canvasId, "canvas =", canvas);
    if (!canvas) return;
    
    let resolutions = Object.keys(data).filter(res => RESOLUTION_ORDER.includes(res))
                          .sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));
    
    console.log("DEBUG afficherSatisfactionParResolution: resolutions =", resolutions);
    
    if (resolutions.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "14px Inter";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText("Aucune donnée à afficher", canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const presentQualityKeys = new Set(Object.values(data).flatMap(res => Object.keys(res)));
    console.log("DEBUG afficherSatisfactionParResolution: presentQualityKeys =", [...presentQualityKeys]);
    const orderedVisibleQualities = SATISFACTION_LEVELS_CONFIG.filter(level => presentQualityKeys.has(level.key));
    console.log("DEBUG afficherSatisfactionParResolution: orderedVisibleQualities =", orderedVisibleQualities.map(q => q.key));
    
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