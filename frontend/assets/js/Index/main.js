// frontend/assets/js/Index/main.js

// Refresh page when navigating back (e.g. from results page)
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        window.location.reload();
    }
});

document.addEventListener("DOMContentLoaded", function () {
    let sessionStart = null;
    let nombreDeSessions = 1;
    let videosVisionnees = 0;

    // Initialisation des modules UI
    try { initUI(); } catch (e) { console.error("Error in initUI:", e); }
    try { initPlayer(); } catch (e) { console.error("Error in initPlayer:", e); }
    try { initQuiz(); } catch (e) { console.error("Error in initQuiz:", e); }
    
    // --- Pseudo Check Logic ---
    const pseudoInput = document.getElementById('pseudo');
    const pseudoFeedback = document.getElementById('pseudoFeedback');
    const loginBtn = document.getElementById('loginButton');
    const registerBtn = document.getElementById('registerButton');
    let debounceTimer;

    if (pseudoInput) {
        pseudoInput.addEventListener('input', function() {
            const pseudo = this.value.trim();
            
            // Reset UI state
            clearTimeout(debounceTimer);
            pseudoInput.style.borderColor = '';
            if (pseudoFeedback) {
                pseudoFeedback.style.display = 'none';
                pseudoFeedback.textContent = '';
            }
            if (loginBtn) loginBtn.style.display = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            
            if (pseudo.length === 0) return;

            debounceTimer = setTimeout(() => {
                fetch(`/api/check-pseudo/${encodeURIComponent(pseudo)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.exists) {
                            // User exists
                            pseudoInput.style.borderColor = 'red';
                            if (pseudoFeedback) {
                                pseudoFeedback.textContent = 'Ce pseudo existe déjà. Veuillez vous connecter.';
                                pseudoFeedback.style.color = 'red';
                                pseudoFeedback.style.display = 'block';
                            }
                            if (loginBtn) loginBtn.style.display = 'inline-block';
                            if (registerBtn) registerBtn.style.display = 'none';
                            if (startButton) startButton.disabled = true;
                            if (startButton) startButton.classList.add('disabled');
                        } else {
                            // New user
                            pseudoInput.style.borderColor = 'green';
                            if (pseudoFeedback) {
                                pseudoFeedback.textContent = 'Pseudo disponible. Vous pouvez vous inscrire ou continuer.';
                                pseudoFeedback.style.color = 'green';
                                pseudoFeedback.style.display = 'block';
                            }
                            if (loginBtn) loginBtn.style.display = 'none';
                            if (registerBtn) registerBtn.style.display = 'inline-block';
                            if (startButton) startButton.disabled = false;
                            if (startButton) startButton.classList.remove('disabled');
                        }
                    })
                    .catch(err => console.error('Error checking pseudo:', err));
            }, 500); // 500ms debounce
        });
    }

    // --- Login Modal Logic ---
    const loginPopup = document.getElementById('loginPopup');
    const loginForm = document.getElementById('loginForm');
    const loginCancelBtn = document.getElementById('loginCancelBtn');
    const loginFeedbackModal = document.getElementById('loginFeedback');
    const loginPseudoInput = document.getElementById('loginPseudo');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');

    const updateUIForLogin = (pseudo) => {
        if (pseudoInput) {
            pseudoInput.value = pseudo;
            pseudoInput.disabled = true;
            pseudoInput.style.borderColor = 'green';
        }
        if (pseudoFeedback) {
            pseudoFeedback.textContent = 'Connecté en tant que ' + pseudo;
            pseudoFeedback.style.color = 'green';
            pseudoFeedback.style.display = 'block';
        }
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (headerLoginBtn) headerLoginBtn.style.display = 'none';
        if (headerLogoutBtn) headerLogoutBtn.style.display = 'inline-flex';
        
        if (startButton) {
            startButton.disabled = false;
            startButton.classList.remove('disabled');
        }
    };

    const updateUIForLogout = () => {
        if (pseudoInput) {
            pseudoInput.value = '';
            pseudoInput.disabled = false;
            pseudoInput.style.borderColor = '';
        }
        if (pseudoFeedback) {
            pseudoFeedback.textContent = '';
            pseudoFeedback.style.display = 'none';
        }
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (headerLoginBtn) headerLoginBtn.style.display = 'inline-flex';
        if (headerLogoutBtn) headerLogoutBtn.style.display = 'none';
        
        // Start button state depends on input, but initially enabled/disabled?
        // Let's leave it enabled but check on click as per original logic
        if (startButton) {
            startButton.disabled = false;
            startButton.classList.remove('disabled');
        }
    };

    // Check for existing session on load
    fetch('/api/me')
        .then(res => res.json())
        .then(data => {
            if (data.loggedIn) {
                localStorage.setItem("pseudo", data.user.pseudo);
                updateUIForLogin(data.user.pseudo);
            } else {
                localStorage.removeItem("pseudo");
                updateUIForLogout();
            }
        })
        .catch(err => {
            console.error("Session check failed", err);
            // Fallback to local storage if server check fails (e.g. offline)
            const storedPseudo = localStorage.getItem("pseudo");
            if (storedPseudo) {
                updateUIForLogin(storedPseudo);
            }
        });

    const openLoginModal = () => {
        if (loginPopup) {
            loginPopup.style.display = 'flex';
            // Pre-fill pseudo if available and not empty
            if (pseudoInput && loginPseudoInput && pseudoInput.value.trim()) {
                loginPseudoInput.value = pseudoInput.value;
            }
        }
    };

    if (loginBtn) {
        loginBtn.addEventListener('click', openLoginModal);
    }

    if (headerLoginBtn) {
        headerLoginBtn.addEventListener('click', openLoginModal);
    }

    if (headerLogoutBtn) {
        console.log("Attaching logout listener");
        headerLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Logout clicked");
            
            // Visual feedback
            headerLogoutBtn.style.opacity = '0.5';
            headerLogoutBtn.style.cursor = 'wait';

            fetch('/api/logout', { method: 'POST' })
                .then(res => {
                    console.log("Logout API response:", res.status);
                    // Whether success or fail, we clear local state and reload
                    localStorage.removeItem("pseudo");
                    window.location.reload();
                })
                .catch(err => {
                    console.error('Logout error:', err);
                    // Force logout on error too
                    localStorage.removeItem("pseudo");
                    window.location.reload();
                });
        });
    } else {
        console.error("Logout button not found in DOM");
    }

    if (loginCancelBtn && loginPopup) {
        loginCancelBtn.addEventListener('click', () => {
            loginPopup.style.display = 'none';
            if (loginFeedbackModal) loginFeedbackModal.style.display = 'none';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pseudo = loginPseudoInput.value.trim();
            const password = document.getElementById('loginPassword').value;

            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pseudo, password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Login successful
                    loginPopup.style.display = 'none';
                    
                    // Store in localStorage for session consistency
                    localStorage.setItem("pseudo", pseudo);
                    
                    // Update UI
                    updateUIForLogin(pseudo);
                    
                } else {
                    // Login failed
                    if (loginFeedbackModal) {
                        loginFeedbackModal.textContent = data.message || 'Erreur de connexion.';
                        loginFeedbackModal.style.display = 'block';
                    }
                }
            })
            .catch(err => {
                console.error('Login error:', err);
                if (loginFeedbackModal) {
                    loginFeedbackModal.textContent = 'Erreur serveur.';
                    loginFeedbackModal.style.display = 'block';
                }
            });
        });
    }

    // --- Register Modal Logic ---
    const registerPopup = document.getElementById('registerPopup');
    const registerForm = document.getElementById('registerForm');
    const registerCancelBtn = document.getElementById('registerCancelBtn');
    const registerFeedbackModal = document.getElementById('registerFeedback');
    const registerPseudoInput = document.getElementById('registerPseudo');
    
    const openRegisterModal = () => {
        if (registerPopup) {
            registerPopup.style.display = 'flex';
            // Pre-fill pseudo if available
            if (pseudoInput && registerPseudoInput && pseudoInput.value.trim()) {
                registerPseudoInput.value = pseudoInput.value;
            }
        }
    };

    if (registerBtn) {
        registerBtn.addEventListener('click', openRegisterModal);
    }

    if (registerCancelBtn && registerPopup) {
        registerCancelBtn.addEventListener('click', () => {
            registerPopup.style.display = 'none';
            if (registerFeedbackModal) registerFeedbackModal.style.display = 'none';
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pseudo = registerPseudoInput.value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;

            fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pseudo, email, password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Registration successful
                    registerPopup.style.display = 'none';
                    
                    // Auto-login or just update UI?
                    // Let's auto-login for better UX
                    // But we need to call login API to set cookie
                    return fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pseudo, password })
                    })
                    .then(res => res.json())
                    .then(loginData => {
                        if (loginData.success) {
                            localStorage.setItem("pseudo", pseudo);
                            updateUIForLogin(pseudo);
                        } else {
                            // Should not happen if register was success
                            alert('Inscription réussie, veuillez vous connecter.');
                        }
                    });
                    
                } else {
                    // Registration failed
                    if (registerFeedbackModal) {
                        registerFeedbackModal.textContent = data.message || 'Erreur d\'inscription.';
                        registerFeedbackModal.style.display = 'block';
                    }
                }
            })
            .catch(err => {
                console.error('Register error:', err);
                if (registerFeedbackModal) {
                    registerFeedbackModal.textContent = 'Erreur serveur.';
                    registerFeedbackModal.style.display = 'block';
                }
            });
        });
    }

    const startButton = document.getElementById('startButton');
    if (!startButton) return;

    startButton.onclick = function(event) {
        event.preventDefault();
        
        const pseudoField = document.getElementById('pseudo');
        
        // If the input is NOT disabled, it means the user is playing as a guest (did not log in).
        // We must ensure any stale session cookies are cleared so they are treated as a guest at the end.
        if (!pseudoField.disabled) {
            fetch('/api/logout', { method: 'POST' }).catch(e => console.error("Auto-logout error:", e));
        }

        const pseudo = pseudoField.value.trim();
        if (pseudo === "") {
            alert("Veuillez entrer votre pseudo avant de commencer.");
            pseudoField.focus();
            return;
        }
        localStorage.setItem("pseudo", pseudo);
        // Clear any previous session flags
        localStorage.removeItem("guestDeclinedSave");
        localStorage.removeItem("displayPseudo");
        localStorage.removeItem("originalPseudo");
        
        sessionStart = Date.now();
        sessionStorage.removeItem("feedbackSessions");
        
        const tempsSelect = document.getElementById('temps');
        nombreDeSessions = parseInt(tempsSelect.value);
        videosVisionnees = 0;

        // Démarrer l'expérience via le module player
        startExperience(nombreDeSessions, handlePairComplete);
    };

    function handlePairComplete() {
        // Afficher le quiz via le module quiz
        const isLastSession = (videosVisionnees + 1) >= nombreDeSessions;
        showQuizPopup(isLastSession, handleQuizSubmission);
    }
    
    function handleQuizSubmission(quizData) {
        const pseudo = localStorage.getItem("pseudo");
        const fullData = { user: pseudo, ...quizData };
        
        // Sauvegarder les données de la session
        let previousSessions = JSON.parse(sessionStorage.getItem("feedbackSessions")) || [];
        previousSessions.push(fullData);
        sessionStorage.setItem("feedbackSessions", JSON.stringify(previousSessions));
        
        // Calculer le score
        let score = 0;
        const resPoints1 = calculateResolutionPoints(fullData.resolution1, (quizData.QO1.match(/\(([^,]*),/) || [])[1]?.trim());
        const resPoints2 = calculateResolutionPoints(fullData.resolution2, (quizData.QO1.match(/,([^)]*)\)/) || [])[1]?.trim());
        score += resPoints1 + resPoints2;

        const indexRes1 = RESOLUTION_ORDER.indexOf(fullData.resolution1);
        const indexRes2 = RESOLUTION_ORDER.indexOf(fullData.resolution2);
        let correctPreference = "inconnu";
        if (indexRes1 > indexRes2) correctPreference = "first";
        else if (indexRes2 > indexRes1) correctPreference = "second";
        else if (indexRes1 !== -1) correctPreference = "none";
        if (fullData.QO3 === correctPreference) score += 1;

        // Check if user is logged in (via the input field state)
        const pseudoInput = document.getElementById('pseudo');
        const isGuest = !pseudoInput.disabled;

        if (!isGuest) {
            // Logged in user: Save immediately
            fetch(`${API_BASE_URL}/addUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullData)
            }).catch(e => console.error("Erreur envoi addUser:", e));

            fetch(`${API_BASE_URL}/saveScore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pseudo, score })
            }).catch(e => console.error("Erreur envoi saveScore:", e));

            const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
            fetch(`${API_BASE_URL}/saveTime`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pseudo, time: elapsed })
            }).catch(e => console.error("Erreur envoi saveTime:", e));
        } else {
            // Guest user: Don't save to DB yet, just keep in sessionStorage
            console.log("Guest user: Data saved to session storage only.");
        }

        videosVisionnees++;
        if (videosVisionnees >= nombreDeSessions) {
            if (isGuest) {
                window.location.href = `resultats.html?guest=true`;
            } else {
                window.location.href = `resultats.html`;
            }
        } else {
            afficherMessageTransition(
                `Préparation de la Vidéo ${videosVisionnees + 1}.\nVous allez regarder deux résolutions différentes.`,
                () => jouerNouvellePaire()
            );
        }
    }

    function calculateResolutionPoints(correctRes, userRes) {
        const iCorrect = RESOLUTION_ORDER.indexOf(correctRes);
        const iUser = RESOLUTION_ORDER.indexOf(userRes);
        if (iUser === -1 || iCorrect === -1) return 0;
        const diff = Math.abs(iUser - iCorrect);
        if (diff === 0) return 2;
        if (diff === 1) return 1;
        return 0;
    }
});