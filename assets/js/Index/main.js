document.addEventListener("DOMContentLoaded", function () {
    let sessionStart = null;
    let nombreDeSessions = 1;
    let videosVisionnees = 0;

    // Initialisation des modules UI
    initUI();
    initPlayer();
    initQuiz();
    
    const startButton = document.getElementById('startButton');
    if (!startButton) return;

    startButton.onclick = function(event) {
        event.preventDefault();
        
        const pseudoField = document.getElementById('pseudo');
        const pseudo = pseudoField.value.trim();
        if (pseudo === "") {
            alert("Veuillez entrer votre pseudo avant de commencer.");
            pseudoField.focus();
            return;
        }
        localStorage.setItem("pseudo", pseudo);
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

        // Envoyer les données au serveur
        const API_BASE_URL = `http://${window.location.hostname}:3300`;
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

        videosVisionnees++;
        if (videosVisionnees >= nombreDeSessions) {
            window.location.href = `resultats.html`;
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