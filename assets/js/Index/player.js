let videosNormales = [];
let videosEnfant = [];
let videosVisionneesPourLaPaire = new Set();
let areVideosLoaded = false;

let currentVideoObjectForPair;
let resolutionsToPlayForPair;
let currentResolutionPlayIndex = 0; // 0 ou 1
let onPairCompleteCallback = null;

// On garde une référence simple aux éléments HTML
const videoPlayerElement = document.getElementById('videoPlayer');
const videoSourceElement = document.getElementById('videoSource');

function exitFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(e => console.warn("Erreur sortie plein écran:", e));
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
}

function attemptEnterFullscreen(element) {
    if (element && !document.fullscreenElement) {
        if (element.requestFullscreen) element.requestFullscreen().catch(err => console.warn("Échec demande plein écran:", err.message));
        else if (element.mozRequestFullScreen) element.mozRequestFullScreen();
        else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
        else if (element.msRequestFullscreen) element.msRequestFullscreen();
    }
}

async function loadVideosFromServer() {
    try {
        // On récupère l'état du switch
        const licensedToggle = document.getElementById('licensedModeToggle');
        const includeLicensed = licensedToggle ? licensedToggle.checked : false;

        console.log(`Chargement des vidéos avec includeLicensed=${includeLicensed}`);

        const [adulteRes, enfantRes] = await Promise.all([
            // On ajoute le paramètre à l'URL de la requête
            fetch(`http://${window.location.hostname}:3300/api/get-videos?mode=adulte&includeLicensed=${includeLicensed}`),
            fetch(`http://${window.location.hostname}:3300/api/get-videos?mode=enfant`)
        ]);
        if (!adulteRes.ok || !enfantRes.ok) throw new Error("Erreur réseau");
        
        videosNormales = await adulteRes.json();
        videosEnfant = await enfantRes.json();
        areVideosLoaded = true;
        console.log(`Vidéos chargées: ${videosNormales.length} adultes, ${videosEnfant.length} enfants.`);
    } catch (error) {
        console.error("ERREUR CRITIQUE: Impossible de charger les vidéos.", error);
        alert("Une erreur est survenue lors du chargement des vidéos.");
    }
}

function afficherMessageTransition(message, callback) {
    // CORRECTION : La transition ne doit pas cacher le lecteur, juste s'afficher par-dessus
    exitFullscreen(); 

    const transitionScreen = document.getElementById("transitionScreen");
    const transitionText = document.getElementById("transitionText");
    if (!transitionScreen || !transitionText) {
        if (callback) callback();
        return;
    }

    transitionText.innerText = message;
    transitionScreen.style.display = "flex";

    setTimeout(() => {
        transitionScreen.style.display = "none";
        if (callback) callback();
    }, 3000);
}

// CORRECTION : Simplification drastique. La fonction ne fait plus que démarrer la logique.
// L'affichage du lecteur est géré par le CSS et HTML par défaut.
function startExperience(nombreDeSessions, onComplete) {
    onPairCompleteCallback = onComplete;
    
    // On cache juste les champs de saisie, le lecteur reste visible
    document.getElementById('userInputGroup').style.display = 'none';

    afficherMessageTransition(
        `Vous allez regarder ${nombreDeSessions === 1 ? "une paire de vidéos" : nombreDeSessions + " paires de vidéos"}.\nChaque paire contient la même vidéo mais avec des résolutions différentes.`,
        () => jouerNouvellePaire()
    );
}

function jouerNouvellePaire() {
    if (!areVideosLoaded) {
        alert("Les vidéos ne sont pas encore chargées, veuillez patienter.");
        document.getElementById('userInputGroup').style.display = 'block'; // Réafficher les contrôles en cas d'erreur
        return;
    }
    
    currentResolutionPlayIndex = 0;
    const videosSource = window.enfantMode ? videosEnfant : videosNormales;
    if (videosSource.length === 0) {
        alert(window.enfantMode ? "Aucune vidéo enfant disponible !" : "Aucune vidéo adulte disponible !");
        document.getElementById('userInputGroup').style.display = 'block';
        return;
    }

    let videosNonVisionnees = videosSource.filter(v => !videosVisionneesPourLaPaire.has(v.id));
    if (videosNonVisionnees.length === 0) {
        videosVisionneesPourLaPaire.clear();
        videosNonVisionnees = videosSource;
    }
    const randomIndex = Math.floor(Math.random() * videosNonVisionnees.length);
    currentVideoObjectForPair = videosNonVisionnees[randomIndex];
    videosVisionneesPourLaPaire.add(currentVideoObjectForPair.id);

    const res = currentVideoObjectForPair.resolutions;
    let res1 = res[Math.floor(Math.random() * res.length)];
    let res2 = res[Math.floor(Math.random() * res.length)];
    let attempts = 0;
    while (res1 === res2 && res.length > 1 && attempts < 10) {
        res2 = res[Math.floor(Math.random() * res.length)];
        attempts++;
    }
    resolutionsToPlayForPair = [res1, res2];
    
    lancerSequenceVideo();
}

function lancerSequenceVideo() {
    if (currentResolutionPlayIndex >= resolutionsToPlayForPair.length) {
        exitFullscreen();
        if (onPairCompleteCallback) onPairCompleteCallback();
        return;
    }

    const resolution = resolutionsToPlayForPair[currentResolutionPlayIndex];
    const videoPath = currentVideoObjectForPair.sources[resolution];

    if (!videoPath) {
        console.error(`Chemin source non trouvé pour la résolution ${resolution}.`);
        currentResolutionPlayIndex++;
        lancerSequenceVideo();
        return;
    }

    window.currentVideoData = window.currentVideoData || {};
    if (currentResolutionPlayIndex === 0) {
        window.currentVideoData.path1 = videoPath;
        window.currentVideoData.res1 = resolution;
    } else {
        window.currentVideoData.path2 = videoPath;
        window.currentVideoData.res2 = resolution;
    }
    
    // CORRECTION : On s'assure que la source est mise à jour avant de jouer
    if (videoSourceElement && videoPlayerElement) {
        videoSourceElement.src = videoPath;
        videoPlayerElement.load();
        
        // La tentative de plein écran se fera à l'événement 'playing'
        const onVideoReadyToPlay = () => {
            attemptEnterFullscreen(videoPlayerElement);
        };
        videoPlayerElement.removeEventListener('playing', onVideoReadyToPlay);
        videoPlayerElement.addEventListener('playing', onVideoReadyToPlay, { once: true });

        videoPlayerElement.play().catch(e => {
            console.error("Erreur de lecture vidéo:", e);
            videoPlayerElement.removeEventListener('playing', onVideoReadyToPlay); // Nettoyer l'écouteur en cas d'erreur
            currentResolutionPlayIndex++;
            lancerSequenceVideo(); // Tenter de passer à la suite
        });
    }
}

function initPlayer() {
    if (!videoPlayerElement) return;
    
    videoPlayerElement.onended = () => {
        currentResolutionPlayIndex++;
        if (currentResolutionPlayIndex === 1) { // Si la 1ère vient de finir
            setTimeout(() => lancerSequenceVideo(), 1500); // Lance la 2ème après une pause
        } else { // Si la 2ème vient de finir
            lancerSequenceVideo(); // Déclenche la fin de la paire
        }
    };
    
    videoPlayerElement.onerror = (e) => {
        console.error("Erreur du lecteur vidéo:", e);
        alert("Une erreur est survenue avec la vidéo. Passage à la suite.");
        currentResolutionPlayIndex++;
        lancerSequenceVideo();
    };
    
    loadVideosFromServer();
}