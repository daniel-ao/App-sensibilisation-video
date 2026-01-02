
console.log("========== MAIN.JS INIT ==========");
console.log("[MAIN.JS] localStorage.pseudo =", localStorage.getItem("pseudo"));
console.log("[MAIN.JS] localStorage.displayPseudo =", localStorage.getItem("displayPseudo"));

// These will be set properly in DOMContentLoaded after checking auth status
let dbPseudo = localStorage.getItem("pseudo") || "Utilisateur inconnu";
let displayPseudo = localStorage.getItem("displayPseudo") || dbPseudo;

console.log("[MAIN.JS] Initial dbPseudo =", dbPseudo);
console.log("[MAIN.JS] Initial displayPseudo =", displayPseudo);

async function initPersonalCharts(pseudo) {
    console.log("========== initPersonalCharts() CALLED ==========");
    console.log("[initPersonalCharts] Pseudo passed to function =", pseudo);
    console.log("[initPersonalCharts] Fetching data from API for this pseudo...");
    
    const [satisfactionCumul, satisfactionDevice, confusions] = await Promise.all([
        getSatisfactionCumul(pseudo),
        getSatisfactionByDevice(pseudo),
        getConfusionsData(pseudo)
    ]);

    console.log("[initPersonalCharts] API responses received:");
    console.log("DEBUG initPersonalCharts: SatisfactionCumul:", JSON.stringify(satisfactionCumul));
    console.log("DEBUG initPersonalCharts: SatisfactionDevice:", JSON.stringify(satisfactionDevice));
    console.log("DEBUG initPersonalCharts: Confusions:", JSON.stringify(confusions));
    
    if (!satisfactionCumul || (Object.keys(satisfactionCumul.video1 || {}).length === 0 && Object.keys(satisfactionCumul.video2 || {}).length === 0)) {
        console.warn("DEBUG: Aucune donnée de satisfaction cumulée trouvée.");
        const container = document.getElementById('chartSatisfactionCumul')?.parentElement;
        if (container) {
             const msg = document.createElement('p');
             msg.style.color = 'orange';
             msg.style.textAlign = 'center';
             msg.innerHTML = `Aucune donnée trouvée pour <strong>${pseudo}</strong>.<br>Avez-vous terminé une session ?`;
             container.appendChild(msg);
        }
    }
    
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
    console.log("DEBUG initPersonalCharts: Fusion result:", JSON.stringify(fusion));
    afficherSatisfactionParResolution(fusion, 'Votre Satisfaction Cumulée', 'chartSatisfactionCumul');
    
    afficherSatisfactionParAppareil(satisfactionDevice, 'satisfactionByDeviceChartsContainer', 'Votre Satisfaction');
    
    // Title parameter should be a string, not an array.
    afficherGraphiqueConfusions(confusions, 'chartConfusions', 'Vos Confusions (Réelle → Perçue)');
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
    afficherGraphiqueConfusions(confusions, 'globalChartConfusions', 'Confusions Globales (Réelle → Perçue)');
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

document.addEventListener("DOMContentLoaded", async function () {
    // Check if this is a guest user (via URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const isGuestFromUrl = urlParams.get('guest') === 'true';
    const hadDeclinedSave = localStorage.getItem("guestDeclinedSave") === "true";
    
    // If user declined save, data is in DB, so treat as non-guest for chart loading
    const isGuest = isGuestFromUrl && !hadDeclinedSave;
    
    console.log("[MAIN.JS] isGuestFromUrl =", isGuestFromUrl);
    console.log("[MAIN.JS] hadDeclinedSave =", hadDeclinedSave);
    console.log("[MAIN.JS] isGuest (final) =", isGuest);
    
    // Check login status and update pseudo accordingly
    try {
        const meRes = await fetch('/api/me');
        const meData = await meRes.json();
        console.log("[MAIN.JS] /api/me response =", meData);
        
        if (meData.loggedIn) {
            // User is logged in - use pseudo from server
            dbPseudo = meData.user.pseudo;
            displayPseudo = meData.user.pseudo;
            console.log("[MAIN.JS] User logged in, using server pseudo:", dbPseudo);
        } else {
            // Not logged in - use localStorage
            dbPseudo = localStorage.getItem("pseudo") || "Utilisateur inconnu";
            displayPseudo = localStorage.getItem("displayPseudo") || localStorage.getItem("originalPseudo") || dbPseudo;
            console.log("[MAIN.JS] User not logged in, using localStorage pseudo:", dbPseudo);
        }
    } catch (e) {
        console.error("[MAIN.JS] Error checking auth:", e);
    }
    
    console.log("[MAIN.JS] Final dbPseudo =", dbPseudo);
    console.log("[MAIN.JS] Final displayPseudo =", displayPseudo);
    
    // 1. Mise à jour des informations textuelles et du récapitulatif
    updateUserStatsHeader(displayPseudo);
    displayAllPrecisions(dbPseudo);
    displayDetailedRecap();
    displaySessionScoreGain();
    
    displayVisualComparison();

    // 2. Initialisation de la comparaison vidéo interactive
    setupVideoComparisons();

    // 3. Lancement de la création de tous les graphiques
    // For guests with data in sessionStorage, graphique.js handles personal charts
    // For guests who declined (data in DB) or logged in users, load from server
    if (isGuest) {
        initGlobalCharts();
    } else {
        initAllCharts(dbPseudo);
    }

    // 4. Check Guest Status & Handle Registration
    checkGuestStatus();
    setupRegistrationHandlers();
});

async function checkGuestStatus() {
    // If user already declined, do not ask again
    if (localStorage.getItem("guestDeclinedSave") === "true") return;

    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (!data.loggedIn) {
            // User is guest
            const pseudo = localStorage.getItem("pseudo");
            if (pseudo) {
                showSavePrompt();
            }
        }
    } catch (e) {
        console.error("Error checking auth status:", e);
    }
}

function showSavePrompt() {
    const prompt = document.getElementById('saveResultsPrompt');
    if (prompt) prompt.style.display = 'flex';
}

function openRegisterModal() {
    const modal = document.getElementById('registerPopup');
    const pseudoInput = document.getElementById('registerPseudo');
    const currentPseudo = localStorage.getItem("pseudo");
    
    if (modal) {
        modal.style.display = 'flex';
        if (pseudoInput && currentPseudo) {
            pseudoInput.value = currentPseudo;
            // Lock the pseudo field so user cannot change it
            pseudoInput.disabled = true;
            pseudoInput.style.backgroundColor = "#e9ecef";
            pseudoInput.style.cursor = "not-allowed";
            pseudoInput.title = "Le pseudo ne peut pas être modifié pour la sauvegarde des résultats.";
        }
    }
}

function setupRegistrationHandlers() {
    document.getElementById('saveResultsBtn')?.addEventListener('click', () => {
        document.getElementById('saveResultsPrompt').style.display = 'none';
        openRegisterModal();
    });

    document.getElementById('closeSavePromptBtn')?.addEventListener('click', async () => {
        // User chose NOT to save. Save data with an anonymized pseudo.
        const currentPseudo = localStorage.getItem("pseudo");
        // Generate a random guest ID to avoid collisions and free up the original pseudo
        const randomId = Math.floor(Math.random() * 1000000);
        const newPseudo = `${currentPseudo}__guest${randomId}`;
        
        if (currentPseudo) {
            try {
                // FIRST: Save the session data to the database with the GUEST pseudo
                // This is crucial - the data must be saved before any pseudo manipulation
                const sessions = JSON.parse(sessionStorage.getItem("feedbackSessions")) || [];
                
                for (const session of sessions) {
                    // Save with the new anonymous guest pseudo
                    session.user = newPseudo;
                    await fetch('/addUser', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(session)
                    });
                }
                
                console.log("[GUEST DECLINE] Saved", sessions.length, "sessions under pseudo:", newPseudo);
                
                // Update local storage to reflect the anonymous user
                localStorage.setItem("pseudo", newPseudo);
                // Save the original pseudo for display purposes AND for potential restore later
                localStorage.setItem("displayPseudo", currentPseudo);
                localStorage.setItem("originalPseudo", currentPseudo);
                // Mark that the user has declined saving so we don't ask again
                localStorage.setItem("guestDeclinedSave", "true");
                
                // Keep sessionStorage for recap display - will be cleared when starting new session
                
            } catch (e) {
                console.error("Error saving guest data:", e);
            }
        }
        
        document.getElementById('saveResultsPrompt').style.display = 'none';
    });
    
    document.getElementById('registerCancelBtn')?.addEventListener('click', () => {
        document.getElementById('registerPopup').style.display = 'none';
        // If they cancel registration, show the save prompt again (obligatory)
        document.getElementById('saveResultsPrompt').style.display = 'flex';
    });
    
    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pseudo = document.getElementById('registerPseudo').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const feedback = document.getElementById('registerFeedback');
        const oldPseudo = localStorage.getItem("pseudo");
        
        try {
            // 0. FIRST: Save session data to DB with the user's chosen pseudo
            // This ensures data is saved BEFORE registration
            const sessions = JSON.parse(sessionStorage.getItem("feedbackSessions")) || [];
            
            console.log("[REGISTER FORM] Saving", sessions.length, "sessions for pseudo:", pseudo);
            
            for (const session of sessions) {
                session.user = pseudo;
                await fetch('/addUser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(session)
                });
            }
            
            // 1. Register
            const regRes = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pseudo, email, password })
            });
            const regData = await regRes.json();
            
            if (!regData.success) {
                throw new Error(regData.message || 'Erreur inscription');
            }
            
            // 2. Login
            const loginRes = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pseudo, password })
            });
            const loginData = await loginRes.json();
            
            if (!loginData.success) {
                throw new Error('Erreur connexion après inscription');
            }
            
            // 3. Update localStorage - keep sessionStorage for recap display
            // sessionStorage will be cleared when starting a new session
            
            // Success
            localStorage.setItem("pseudo", pseudo);
            localStorage.removeItem("displayPseudo");
            localStorage.removeItem("originalPseudo");
            localStorage.removeItem("guestDeclinedSave");
            document.getElementById('registerPopup').style.display = 'none';
            alert('Compte créé et résultats sauvegardés !');
            window.location.reload(); // Reload to update UI with logged in state
            
        } catch (err) {
            if (feedback) {
                feedback.textContent = err.message;
                feedback.style.display = 'block';
            }
        }
    });
}