// =================================================================================
// UI.JS (SITE) - Gestion de l'interface de la page d'accueil/expérience
// =================================================================================

const TABS = ["introduction", "videos", "resolutions", "streaming-quality", "sensibilisation"];
let currentTabIndex = 0;

function setStepperActiveStep(index) {
    const steps = document.querySelectorAll('.step-circle');
    steps.forEach((el, idx) => {
        el.classList.toggle('active', idx <= index);
    });
    openTab(index); 
    const bar = document.querySelector('.step-progress-bar');
    if (bar) {
        const percent = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 100;
        bar.style.background = `linear-gradient(90deg, #1976d2 ${percent}%, #b4c8e8 ${percent}%)`;
    }
}

function openTab(index) {
    if (index < 0 || index >= TABS.length) return;
    
    document.querySelectorAll(".tab-content").forEach(content => content.style.display = "none");
    const tabId = TABS[index];
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.style.display = "block";
    currentTabIndex = index;

    // Logique spécifique pour l'onglet vidéo
    if (tabId !== "videos") {
        if (typeof exitFullscreen === 'function') exitFullscreen();
    }
}

function initNavigation() {
    document.querySelectorAll('.step-circle').forEach((circle, idx) => {
        circle.addEventListener('click', () => setStepperActiveStep(idx));
    });

    document.getElementById("nextButton")?.addEventListener("click", () => {
        if (currentTabIndex < TABS.length - 1) setStepperActiveStep(currentTabIndex + 1);
    });

    document.getElementById("prevButton")?.addEventListener("click", () => {
        if (currentTabIndex > 0) setStepperActiveStep(currentTabIndex - 1);
    });
    
    setStepperActiveStep(0);
}

function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (!darkModeToggle) return;

    const applyDarkMode = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        darkModeToggle.checked = isDark;
    };

    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') applyDarkMode(true);
    
    darkModeToggle.addEventListener('change', () => {
        const isDark = darkModeToggle.checked;
        applyDarkMode(isDark);
        localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    });
}

function initTextToSpeech() {
    document.getElementById("readTextButton")?.addEventListener("click", () => {
        const textElement = document.getElementById("introduction");
        if (textElement) {
            const speech = new SpeechSynthesisUtterance(textElement.innerText);
            speech.lang = "fr-FR";
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(speech);
        }
    });

    document.getElementById("stopTextButton")?.addEventListener("click", () => {
        window.speechSynthesis.cancel();
    });
}

function initEnfantModeSwitch() {
    const switchInput = document.getElementById('modeSwitch');
    const modeText = document.getElementById('modeText');
    if (!switchInput || !modeText) return;

    switchInput.checked = true; // Mode adulte par défaut
    const updateModeText = () => {
        const isAdultMode = switchInput.checked;
        modeText.textContent = isAdultMode ? "Mode adulte" : "Mode enfant";
        modeText.style.color = isAdultMode ? "var(--accent-color-darkest)" : "var(--accent-color)";
        window.enfantMode = !isAdultMode;
    };
    switchInput.addEventListener('change', updateModeText);
    updateModeText();
}

function initPseudoHandling() {
    const pseudoField = document.getElementById('pseudo');
    if (!pseudoField) return;

    // Charger le pseudo depuis le serveur ou le localStorage
    fetch(`http://${window.location.hostname}:3300/lastPseudo`)
        .then(r => r.json())
        .then(data => { if (data.pseudo) pseudoField.value = data.pseudo; })
        .catch(console.error);

    const savePseudo = () => {
        const pseudo = pseudoField.value.trim();
        if (pseudo) {
            localStorage.setItem('pseudo', pseudo);
            fetch(`http://${window.location.hostname}:3300/registerPseudo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pseudo })
            }).catch(console.error);
        }
    };
    
    pseudoField.addEventListener('change', savePseudo);
    pseudoField.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById("startButton")?.click();
        }
    });
}
function initLicensedModeSwitch() {
    const licensedToggle = document.getElementById('licensedModeToggle');
    const passwordPopup = document.getElementById('passwordPopup');
    const passwordInput = document.getElementById('passwordInput');
    const passwordSubmitBtn = document.getElementById('passwordSubmitBtn');
    const passwordCancelBtn = document.getElementById('passwordCancelBtn');

    if (!licensedToggle || !passwordPopup) return;

    // S'assurer que le switch est bien sur "off" au chargement
    licensedToggle.checked = false;

    licensedToggle.addEventListener('change', (event) => {
        // L'utilisateur a cliqué, le switch a bougé.
        // Si la nouvelle position est "on"...
        if (licensedToggle.checked) {
            // ...on ouvre la popup.
            passwordPopup.style.display = 'flex';
            passwordInput.focus();
            passwordInput.value = '';
        } else {
            // Si la nouvelle position est "off", on met simplement à jour les vidéos.
            // PAS DE MOT DE PASSE ICI.
            console.log("Mode étendu désactivé. Mise à jour de la liste des vidéos.");
            if (typeof loadVideosFromServer === 'function') {
                loadVideosFromServer();
            }
        }
    });

    const handlePasswordSubmit = () => {
        if (passwordInput.value === "terranumerica") {
            // Le mot de passe est BON.
            // On ferme la popup. Le switch est déjà sur "on", on ne touche à rien.
            passwordPopup.style.display = 'none';
            console.log("Mode étendu activé. Mise à jour de la liste des vidéos.");
            if (typeof loadVideosFromServer === 'function') {
                loadVideosFromServer();
            }
        } else {
            // Le mot de passe est MAUVAIS.
            console.log("Mot de passe incorrect.");
            // On ferme la popup.
            passwordPopup.style.display = 'none';
            // Et on force le switch à REVENIR à sa position "off".
            licensedToggle.checked = false;
        }
    };

    passwordSubmitBtn.addEventListener('click', handlePasswordSubmit);
    passwordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handlePasswordSubmit();
        }
    });

    passwordCancelBtn.addEventListener('click', () => {
        // L'utilisateur annule, on ferme la popup
        passwordPopup.style.display = 'none';
        // et on force le switch à REVENIR sur "off".
        licensedToggle.checked = false;
    });
}

// Fonctions pour les liens internes
window.afficherExplicationResolution = function () {
    setStepperActiveStep(TABS.indexOf("resolutions"));
};
window.retourFormulaire = function () {
    setStepperActiveStep(TABS.indexOf("videos"));
};


// Fonction d'initialisation globale de l'UI
function initUI() {
    initNavigation();
    initDarkMode();
    initTextToSpeech();
    initEnfantModeSwitch();
    initLicensedModeSwitch();
    initPseudoHandling();
    // New: extras page button
    const extrasBtn = document.getElementById('openExtrasButton');
    if (extrasBtn) {
        extrasBtn.addEventListener('click', () => {
            window.location.href = 'extras.html';
        });
    }
}