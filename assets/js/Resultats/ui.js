
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h) parts.push(`${h} h`);
    if (m) parts.push(`${m} min`);
    parts.push(`${s} s`);
    return parts.join(' ');
}

function cleanVideoNameForDisplay(rawName) {
    if (!rawName) return "Vidéo inconnue";
    return rawName
        .replace(/_/g, ' ') 
        .replace(/#\w+/g, '') 
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .trim();
}

async function updateUserStatsHeader(pseudo) {
    document.getElementById("userPseudo").innerText = pseudo;

    const scoreData = await getUserScore(pseudo);
    document.getElementById("userScore").innerText = scoreData.score ?? "-";
    const score = Number(scoreData.score) || 0;
    let level = "";
    if (score < 30) level = `Débutant\n(reste ${30 - score} pts pour Amateur)`;
    else if (score < 60) level = `Amateur\n(reste ${60 - score} pts pour Pro)`;
    else if (score < 120) level = `Pro\n(reste ${120 - score} pts pour Légende)`;
    else if (score <= 200) level = `Légende\n(reste ${200 - score} pts pour Elite)`;
    else level = "Elite";
    document.getElementById("levelText").innerText = level;
    
    const timeData = await getUserTime(pseudo);
    document.getElementById("userTime").innerText = formatTime(timeData.time ?? 0);
}

function getPrecisionSession() {
    let feedbackRaw = sessionStorage.getItem("feedbackSessions");
    if (!feedbackRaw) return 0;
    let sessions = JSON.parse(feedbackRaw);
    let total = 0, correct = 0;
    sessions.forEach((s) => {
        let userRes = s.QO1 ? s.QO1.replace(/[()]/g, '').split(',').map(v=>v.trim().toLowerCase()) : [];
        let realRes = [s.resolution1, s.resolution2].map(v=>v.trim().toLowerCase());
        if (userRes[0] && realRes[0]) { total++; if (userRes[0] === realRes[0]) correct++; }
        if (userRes[1] && realRes[1]) { total++; if (userRes[1] === realRes[1]) correct++; }
    });
    return total ? Math.round((correct / total) * 100) : 0;
}

async function displayAllPrecisions(pseudo) {
    const precisionSession = getPrecisionSession();
    document.getElementById("precisionSession").innerText = `🎯 Précision session : ${precisionSession}%`;
    
    const globalData = await getUserPrecision(pseudo);
    document.getElementById("precisionGlobale").innerText = `📈 Précision globale (perso) : ${Number(globalData.precision || 0).toFixed(1)}%`;
    
    const avgData = await getGlobalAveragePrecision();
    document.getElementById("precisionGlobaleMoyenne").innerText = `🌐 Précision moyenne (tous utilisateurs) : ${Number(avgData.moyenne).toFixed(1)}% (sur ${avgData.utilisateurs} utilisateurs)`;
}

function displaySessionScoreGain() {
    let storedData = sessionStorage.getItem("feedbackSessions");
    if (!storedData) return;

    let sessionTotalPoints = 0;
    const sessions = JSON.parse(storedData);

    sessions.forEach(data => {
        let userResolutions = (data.QO1 || "").replace(/[()]/g, "").split(",");
        sessionTotalPoints += calculateResolutionPoints((userResolutions[0] || "").trim(), data.resolution1);
        sessionTotalPoints += calculateResolutionPoints((userResolutions[1] || "").trim(), data.resolution2);

        let userPreferenceQO3 = (data.QO3 || "").trim().toLowerCase();
        const indexRes1 = RESOLUTION_ORDER.indexOf(data.resolution1);
        const indexRes2 = RESOLUTION_ORDER.indexOf(data.resolution2);
        let correctPreferenceForQO3 = "inconnu";
        if (indexRes1 > indexRes2) correctPreferenceForQO3 = "first";
        else if (indexRes2 > indexRes1) correctPreferenceForQO3 = "second";
        else if (indexRes1 !== -1) correctPreferenceForQO3 = "none";

        if (userPreferenceQO3 === correctPreferenceForQO3) {
            sessionTotalPoints += 1;
        }
    });

    const gainElement = document.getElementById("sessionScoreGain");
    if (gainElement && sessionTotalPoints > 0) {
        gainElement.textContent = `(+${sessionTotalPoints} pts)`;
    }
}

function displayDetailedRecap() {
    let storedData = sessionStorage.getItem("feedbackSessions");
    if (!storedData) {
        document.getElementById("userResults").innerHTML = "<p>Aucune donnée de session à afficher.</p>";
        return;
    }

    const sessions = JSON.parse(storedData);
    let resultHTML = sessions.map((data, sessionIndex) => {
        // --- Préparation des données ---
        let videoNumber = sessionIndex + 1;
        let userResolutions = (data.QO1 || "").replace(/[()]/g, "").split(",");
        let userResolution1 = (userResolutions[0] || "N/A").trim();
        let userResolution2 = (userResolutions[1] || "N/A").trim();
        let correctResolution1 = data.resolution1;
        let correctResolution2 = data.resolution2;
        let imageQualities = (data.QO2 || "").replace(/[()]/g, "").split(",");
        let imageQuality1 = (imageQualities[0] || "N/A").trim();
        let imageQuality2 = (imageQualities[1] || "N/A").trim();
        let screenType = data.screenType || "-";
        
        const analyse1 = analyserResolution(correctResolution1, userResolution1, screenType);
        const analyse2 = analyserResolution(correctResolution2, userResolution2, screenType);
        const confort1 = analyserConfortVisionnage(correctResolution1, imageQuality1, screenType);
        const confort2 = analyserConfortVisionnage(correctResolution2, imageQuality2, screenType);
        const feedbackRes1 = getResolutionPointsAndClass(userResolution1, correctResolution1);
        const feedbackRes2 = getResolutionPointsAndClass(userResolution2, correctResolution2);
        
        let userPreferenceQO3 = (data.QO3 || "N/A").trim().toLowerCase();
        const indexRes1 = RESOLUTION_ORDER.indexOf(correctResolution1);
        const indexRes2 = RESOLUTION_ORDER.indexOf(correctResolution2);
        let qo3Points = 0;
        let correctPreferenceForQO3 = "inconnu";

        if (indexRes1 > -1 && indexRes2 > -1) {
            if (indexRes1 > indexRes2) correctPreferenceForQO3 = "first";
            else if (indexRes2 > indexRes1) correctPreferenceForQO3 = "second";
            else correctPreferenceForQO3 = "none";
        }
        
        let qo3CssClass = "mauvaise-reponse";
        if (userPreferenceQO3 && correctPreferenceForQO3 !== "inconnu" && userPreferenceQO3 === correctPreferenceForQO3) {
            qo3Points = 1;
            qo3CssClass = "bonne-reponse";
        }

        let preferredVideoTextExplanation = "la préférence correcte n'a pu être déterminée";
        if (correctPreferenceForQO3 === "first") preferredVideoTextExplanation = `la <strong>première vidéo (${correctResolution1})</strong>`;
        else if (correctPreferenceForQO3 === "second") preferredVideoTextExplanation = `la <strong>deuxième vidéo (${correctResolution2})</strong>`;
        else if (correctPreferenceForQO3 === "none") preferredVideoTextExplanation = "<strong>les deux étaient de qualité égale</strong> (ou très similaire)";
        
        let userChoseTextExplanation = "<strong>un choix non spécifié ou invalide</strong>";
        if (userPreferenceQO3 === "first") userChoseTextExplanation = "la <strong>première vidéo</strong>";
        else if (userPreferenceQO3 === "second") userChoseTextExplanation = "la <strong>deuxième vidéo</strong>";
        else if (userPreferenceQO3 === "none") userChoseTextExplanation = "<strong>aucune différence notable</strong>";

        let qo3FeedbackHTML = "<p>Impossible de déterminer la préférence (résolutions inconnues pour la comparaison).</p>";
        if (correctPreferenceForQO3 !== "inconnu") {
             if (userPreferenceQO3 === correctPreferenceForQO3) {
                qo3FeedbackHTML = `<p>Vous avez indiqué préférer ${userChoseTextExplanation}. C'était la bonne réponse ! En effet, ${preferredVideoTextExplanation} offrait la meilleure expérience. <span class="${qo3CssClass}">(+${qo3Points} pt)</span></p>`;
            } else {
                qo3FeedbackHTML = `<p>Vous avez indiqué préférer ${userChoseTextExplanation}. En réalité, ${preferredVideoTextExplanation} était de meilleure qualité. <span class="${qo3CssClass}">(+${qo3Points} pts)</span></p>`;
            }
        }

        const videoName1 = decodeURIComponent((data.videoPath1 || "").split('/').slice(-2, -1)[0] || `video-1-${sessionIndex}`);
        const displayName1 = cleanVideoNameForDisplay(videoName1);
        const uniqueId = `${videoName1.replace(/[^a-zA-Z0-9]/g, '-')}-${sessionIndex}-1`;
        const satisfactionContainerId = `satisfaction-container-${uniqueId}`;
        const perceptionCanvasId = `perception-chart-${uniqueId}`;
        const perceptionTitleId = `stats-title-${uniqueId}`;
        const visualComparisonContainerId = `visual-comparison-container-${uniqueId}`;

        return `
            <div class="recap-session-pair">
                <h3 class="recap-session-pair-title">🎬 Vidéo ${videoNumber} : ${displayName1}</h3>
                <div class="recap-pair-content">
                    <div class="video-result">
                        <p><strong>Résolution 1 :</strong></p>
                        <p>✅ Vraie résolution : <span class="bonne-reponse">${correctResolution1}</span></p>
                        <p>📝 Votre estimation : <span class="${feedbackRes1.cssClass}">${userResolution1}</span>${feedbackRes1.pointsText}</p>
                        <p>${analyse1}</p> 
                        <p>🎯 ${confort1}</p>
                    </div>
                    <div class="video-result">
                        <p><strong>Résolution 2 :</strong></p>
                        <p>✅ Vraie résolution : <span class="bonne-reponse">${correctResolution2}</span></p>
                        <p>📝 Votre estimation : <span class="${feedbackRes2.cssClass}">${userResolution2}</span>${feedbackRes2.pointsText}</p>
                        <p>${analyse2}</p> 
                        <p>🎯 ${confort2}</p>
                    </div>
                </div>
                <div class="preference-result" style="margin-top: 1.5rem;">
                    <p><strong>⚖️ Votre préférence entre la 1ère et la 2ème résolution :</strong></p>
                    ${qo3FeedbackHTML}
                </div>
                <details open class="video-stats-container">
                    <summary style="grid-column: 1 / -1; cursor: pointer; font-weight: 600;">Statistiques de satisfaction pour cette vidéo</summary>
                    <div id="${satisfactionContainerId}"></div>
                </details>
                <details open class="video-stats-container">
                    <summary style="grid-column: 1 / -1; cursor: pointer; font-weight: 600;">Statistiques de perception pour cette vidéo</summary>
                    <div class="video-chart-wrapper">
                        <h4 id="${perceptionTitleId}">Perception de "${displayName1}"</h4>
                        <canvas id="${perceptionCanvasId}"></canvas>
                    </div>
                </details>
                <details open class="video-stats-container">
                    <summary style="grid-column: 1 / -1; cursor: pointer; font-weight: 600;">Comparaison Visuelle Interactive</summary>
                    <div id="${visualComparisonContainerId}" style="grid-column: 1 / -1;"></div>
                </details>
            </div>
        `;
    }).join('');

    document.getElementById("userResults").innerHTML = resultHTML;
    
    sessions.forEach((data, sessionIndex) => {
        setTimeout(async () => {
            const videoName = decodeURIComponent((data.videoPath1 || "").split('/').slice(-2, -1)[0]);
            if (!videoName) return;

            const uniqueId = `${videoName.replace(/[^a-zA-Z0-9]/g, '-')}-${sessionIndex}-1`;
            const satisfactionContainerId = `satisfaction-container-${uniqueId}`;
            const perceptionCanvasId = `perception-chart-${uniqueId}`;
            const perceptionTitleId = `stats-title-${uniqueId}`;
            const visualComparisonContainerId = `visual-comparison-container-${uniqueId}`;
            
            // --- CHARGEMENT DES GRAPHIQUES DE SATISFACTION ---
            getSatisfactionByVideoAndDevice(videoName).then(satisfactionData => {
                const container = document.getElementById(satisfactionContainerId);
                if (!container) return;
                let finalSatisfactionData = satisfactionData;
                let titlePrefix = `Satisfaction pour "${cleanVideoNameForDisplay(videoName)}"`;
                if (Object.keys(satisfactionData).length === 0) {
                    titlePrefix += " (Votre session)";
                    const sessionSatisfaction = {};
                    const imageQualities = (data.QO2 || "").replace(/[()]/g, "").split(",");
                    const device = data.screenType || "inconnu";
                    const addSessionSatisfaction = (res, qual) => {
                        if (!res || !qual) return;
                        if (!sessionSatisfaction[res]) sessionSatisfaction[res] = {};
                        if (!sessionSatisfaction[res][device]) sessionSatisfaction[res][device] = {};
                        sessionSatisfaction[res][device][qual] = (sessionSatisfaction[res][device][qual] || 0) + 1;
                    };
                    addSessionSatisfaction(data.resolution1, imageQualities[0]?.trim());
                    addSessionSatisfaction(data.resolution2, imageQualities[1]?.trim());
                    finalSatisfactionData = sessionSatisfaction;
                }
                if (Object.keys(finalSatisfactionData).length > 0) {
                    afficherSatisfactionParAppareil(finalSatisfactionData, satisfactionContainerId, titlePrefix);
                } else {
                    container.innerHTML = '<p style="text-align: center; grid-column: 1 / -1; color: #6c757d; padding: 1rem 0;">Aucune donnée de satisfaction à afficher.</p>';
                }
            });

            // --- CHARGEMENT DES GRAPHIQUES DE PERCEPTION ---
            const titleElement = document.getElementById(perceptionTitleId);
            getVideoPerceptionStats(videoName).then(statsData => {
                let finalStatsData = statsData;
                if (Object.keys(statsData).length === 0) {
                    if (titleElement) titleElement.textContent += " (Votre session)";
                    const sessionStats = {};
                    const userResolutions = (data.QO1 || ", ").replace(/[()]/g, "").split(",");
                    const addSessionStat = (realRes, userGuess) => {
                        if (!realRes || !userGuess) return;
                        const realIndex = RESOLUTION_ORDER.indexOf(realRes);
                        const perceivedIndex = RESOLUTION_ORDER.indexOf(userGuess);
                        sessionStats[realRes] = { correct: 0, overestimation: 0, underestimation: 0, total: 1 };
                        if (realIndex > -1 && perceivedIndex > -1) {
                            if (perceivedIndex > realIndex) sessionStats[realRes].overestimation = 1;
                            else if (perceivedIndex < realIndex) sessionStats[realRes].underestimation = 1;
                            else sessionStats[realRes].correct = 1;
                        }
                    };
                    addSessionStat(data.resolution1, userResolutions[0].trim());
                    addSessionStat(data.resolution2, userResolutions[1].trim());
                    finalStatsData = sessionStats;
                } else {
                    if (titleElement) titleElement.textContent += " (Global)";
                }
                const canvas = document.getElementById(perceptionCanvasId);
                if (canvas) {
                    afficherGraphiquePerceptionVideo(perceptionCanvasId, finalStatsData);
                }
            });

            // --- CHARGEMENT DE LA COMPARAISON VISUELLE ---
            const visualContainer = document.getElementById(visualComparisonContainerId);
            if (visualContainer) {
                try {
                    const [availableResolutions, satisfactionData] = await Promise.all([
                        getVideoResolutions(videoName),
                        getSatisfactionByVideoAndDevice(videoName)
                    ]);
                    if (!availableResolutions || availableResolutions.length === 0) throw new Error("Aucune résolution disponible.");

                    const sessionDevice = data.screenType || 'pc';
                    const recommendedResolution = calculateRecommendedResolution(satisfactionData, sessionDevice, availableResolutions);
                    
                    const gridWrapper = document.createElement('div');
                    gridWrapper.className = 'capture-grid-wrapper';
                    const grid = document.createElement('div');
                    grid.className = 'capture-grid';
                    gridWrapper.appendChild(grid);
                    visualContainer.appendChild(gridWrapper);

                    const videoPlayersInGrid = [];
                    const basePath = data.videoPath1.substring(0, data.videoPath1.lastIndexOf('/'));
                    const userResolutions = (data.QO1 || "").replace(/[()]/g, "").split(",");
                    const responses = [
                        { real: data.resolution1, user: (userResolutions[0] || "").trim(), index: 1 },
                        { real: data.resolution2, user: (userResolutions[1] || "").trim(), index: 2 }
                    ];

                    availableResolutions.sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));

                    for (const res of availableResolutions) {
                        const item = document.createElement('div');
                        item.className = 'capture-item';
                        const video = document.createElement('video');
                        video.src = `../${basePath}/segment_${res}.mp4`;
                        video.muted = true;
                        video.loop = true;
                        video.playsInline = true;
                        videoPlayersInGrid.push(video);
                        
                        const indicatorsDiv = document.createElement('div');
                        indicatorsDiv.className = 'capture-indicators';

                        if (res === recommendedResolution) {
                            const recommendedIndicator = document.createElement('div');
                            recommendedIndicator.className = 'indicator';
                            recommendedIndicator.style.backgroundColor = '#fff3cd';
                            recommendedIndicator.style.color = '#664d03';
                            recommendedIndicator.style.border = '1px solid #ffc107';
                            const deviceDisplayName = sessionDevice === 'tablet' ? 'Tablette' : sessionDevice.charAt(0).toUpperCase() + sessionDevice.slice(1);
                            recommendedIndicator.innerHTML = `🌟 Conseillée sur ${deviceDisplayName}`;
                            indicatorsDiv.appendChild(recommendedIndicator);
                        }

                        const matchingResponse = responses.find(r => r.real === res);
                        if (matchingResponse) {
                            item.classList.add('highlight-real');
                            const realIndicator = document.createElement('div');
                            realIndicator.className = 'indicator real-answer-indicator';
                            realIndicator.innerHTML = `✅ Résolution affichée ${matchingResponse.index} : <strong>${res}</strong>`;
                            indicatorsDiv.appendChild(realIndicator);
                            const { pointsText, cssClass } = getResolutionPointsAndClass(matchingResponse.user, res);
                            const userIndicator = document.createElement('div');
                            userIndicator.className = 'indicator user-answer-indicator';
                            userIndicator.innerHTML = `<span>📝 Votre choix ${matchingResponse.index} : <strong class="${cssClass}">${matchingResponse.user}</strong></span> ${pointsText}`;
                            indicatorsDiv.appendChild(userIndicator);
                        } else {
                            const defaultIndicator = document.createElement('div');
                            defaultIndicator.className = 'indicator';
                            defaultIndicator.innerHTML = `Résolution : <strong>${res}</strong>`;
                            indicatorsDiv.appendChild(defaultIndicator);
                        }

                        const userGuessResponse = responses.find(r => r.user === res);
                        if (userGuessResponse) {
                            item.classList.add('highlight-user');
                        }
                        
                        item.append(video, indicatorsDiv);
                        grid.appendChild(item);
                    }

                    let isPlaying = false;
                    grid.addEventListener('click', () => {
                        isPlaying = !isPlaying;
                        if (isPlaying) { videoPlayersInGrid.forEach(v => v.play().catch(e => {})); }
                        else { videoPlayersInGrid.forEach(v => v.pause()); }
                    });
                } catch (error) {
                    visualContainer.innerHTML = `<p style="text-align:center; color:#888;">Erreur lors du chargement de la comparaison visuelle.</p>`;
                    console.error("Erreur comparaison visuelle:", error);
                }
            }
        }, 0);
    });
}

async function setupVideoComparisons() {
    const container = document.getElementById('videoComparisonSection');
    let storedData = sessionStorage.getItem("feedbackSessions");
    if (!storedData || !container) {
        container.innerHTML = `<p class="placeholder">Aucune vidéo à comparer pour cette session.</p>`;
        return;
    }

    container.innerHTML = '';
    const sessions = JSON.parse(storedData);
    const uniqueVideoBases = new Set(
        sessions.map(s => s.videoPath1 && s.videoPath1.substring(0, s.videoPath1.lastIndexOf('/'))).filter(Boolean)
    );

    if (uniqueVideoBases.size === 0) {
        container.innerHTML = `<p class="placeholder">Aucune vidéo valide trouvée pour comparer.</p>`;
        return;
    }
    
    uniqueVideoBases.forEach(async (basePath, index) => {
        const videoNameForAPI = basePath.split('/').pop();
        const videoNameToDisplay = cleanVideoNameForDisplay(decodeURIComponent(videoNameForAPI));
        
        const pairContainer = document.createElement('div');
        pairContainer.className = 'comparison-pair';
        pairContainer.innerHTML = `<h3 style="width: 100%; text-align: center;">Comparaison - Vidéo : ${videoNameToDisplay}</h3>`;
        container.appendChild(pairContainer);

        try {
            const availableResolutions = await getVideoResolutions(videoNameForAPI);
            const relevantSession = sessions.find(s => s.videoPath1 && s.videoPath1.includes(basePath));
            const res1 = relevantSession ? relevantSession.resolution1 : availableResolutions[0];
            const res2 = relevantSession ? relevantSession.resolution2 : availableResolutions[0];
            
            const videoPlayersInPair = [];
            const video1Element = createVideoPlayer(basePath, availableResolutions, res1, `comparer-vid-${index}-1`, videoPlayersInPair);
            const video2Element = createVideoPlayer(basePath, availableResolutions, res2, `comparer-vid-${index}-2`, videoPlayersInPair);
            pairContainer.append(video1Element, video2Element);

            if (videoPlayersInPair.length === 2) {
                const [player1, player2] = videoPlayersInPair;
                player1.addEventListener('play', () => player2.play());
                player1.addEventListener('pause', () => player2.pause());
                player2.addEventListener('play', () => player1.play());
                player2.addEventListener('pause', () => player1.pause());
            }
        } catch (error) {
            console.error(`Impossible de charger les résolutions pour ${videoNameForAPI}:`, error);
            pairContainer.innerHTML += `<p class="placeholder">Erreur lors du chargement des options pour ${videoNameToDisplay}.</p>`;
        }
    });
}

function createVideoPlayer(basePath, resolutions, initialResolution, videoId, playersArray) {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-comparer';
    const selector = document.createElement('select');
    selector.className = 'resolution-selector-live';
    selector.id = `selector-${videoId}`;
    
    resolutions.sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));
    resolutions.forEach(res => {
        const option = document.createElement('option');
        option.value = `../${basePath}/segment_${res}.mp4`;
        option.textContent = res;
        option.selected = res === initialResolution;
        selector.appendChild(option);
    });
    
    const video = document.createElement('video');
    video.id = videoId;
    video.src = selector.value;
    video.controls = true;
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    
    selector.addEventListener('change', (event) => {
        const currentTime = video.currentTime;
        playersArray.forEach(player => player.pause());
        video.src = event.target.value;
        video.load();
        video.addEventListener('loadeddata', () => {
            video.currentTime = currentTime;
            Promise.all(playersArray.map(p => p.play())).catch(e => console.error("Reprise sync error:", e));
        }, { once: true });
    });
    
    playersArray.push(video);
    wrapper.innerHTML = `<label class="video-comparer-label" for="selector-${videoId}">Choisir une résolution :</label>`;
    wrapper.append(selector, video);
    return wrapper;
}

async function displayVisualComparison() {
    const container = document.getElementById('captureComparisonSection');
    const storedData = sessionStorage.getItem("feedbackSessions");

    if (!container || !storedData) {
        if (container) container.style.display = 'none';
        return;
    }

    const sessions = JSON.parse(storedData);
    container.innerHTML = '';
    if (sessions.length > 0) {
        container.style.paddingTop = '1.5rem';
        container.style.paddingBottom = '1.5rem';
    }

    for (const [index, sessionData] of sessions.entries()) {
        const videoNameForAPI_raw = (sessionData.videoPath1 || '').split('/').slice(-2, -1)[0];
        if (!videoNameForAPI_raw) continue;

        // --- CORRECTION CLÉ : ENCODAGE DE L'URL AVANT L'APPEL API ---
        const videoNameForAPI = encodeURIComponent(videoNameForAPI_raw);
        
        // On décode uniquement pour l'affichage, pas pour les appels API
        const videoNameToDisplay = cleanVideoNameForDisplay(decodeURIComponent(videoNameForAPI_raw));
        
        const sessionContainer = document.createElement('div');
        sessionContainer.className = 'capture-session-container';
        const title = document.createElement('h3');
        title.className = 'capture-grid-title';
        title.textContent = `Comparaison pour la vidéo : ${videoNameToDisplay}`;
        sessionContainer.appendChild(title);
        const wrapper = document.createElement('div');
        wrapper.className = 'capture-grid-wrapper';
        const grid = document.createElement('div');
        grid.className = 'capture-grid';
        wrapper.appendChild(grid);
        sessionContainer.appendChild(wrapper);
        container.appendChild(sessionContainer);

        try {
            // Les appels API utilisent maintenant la variable encodée `videoNameForAPI`
            const [availableResolutions, satisfactionData] = await Promise.all([
                getVideoResolutions(videoNameForAPI),
                getSatisfactionByVideoAndDevice(videoNameForAPI)
            ]);

            // La suite du code reste la même, mais elle recevra maintenant des données valides
            if (!availableResolutions || typeof availableResolutions[Symbol.iterator] !== 'function') {
                throw new Error("Les résolutions reçues ne sont pas itérables (probablement une erreur API).");
            }
            if (availableResolutions.length === 0) continue;
            
            const sessionDevice = sessionData.screenType || 'pc';
            const recommendedResolution = calculateRecommendedResolution(satisfactionData, sessionDevice, availableResolutions);
            
            availableResolutions.sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));

            const videoPlayersInGrid = [];
            const basePath = sessionData.videoPath1.substring(0, sessionData.videoPath1.lastIndexOf('/'));
            
            const userResolutions = (sessionData.QO1 || "").replace(/[()]/g, "").split(",");
            const responses = [
                { real: sessionData.resolution1, user: (userResolutions[0] || "").trim(), index: 1 },
                { real: sessionData.resolution2, user: (userResolutions[1] || "").trim(), index: 2 }
            ];

            for (const res of availableResolutions) {
                const item = document.createElement('div');
                item.className = 'capture-item';

                const video = document.createElement('video');
                video.src = `../${basePath}/segment_${res}.mp4`;
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                videoPlayersInGrid.push(video);
                
                const indicatorsDiv = document.createElement('div');
                indicatorsDiv.className = 'capture-indicators';

                if (res === recommendedResolution) {
                    const recommendedIndicator = document.createElement('div');
                    recommendedIndicator.className = 'indicator';
                    recommendedIndicator.style.backgroundColor = '#fff3cd';
                    recommendedIndicator.style.color = '#664d03';
                    recommendedIndicator.style.border = '1px solid #ffc107';
                    const deviceDisplayName = sessionDevice === 'tablet' ? 'Tablette' : sessionDevice.charAt(0).toUpperCase() + sessionDevice.slice(1);
                    recommendedIndicator.innerHTML = `🌟 Conseillée sur ${deviceDisplayName}`;
                    indicatorsDiv.appendChild(recommendedIndicator);
                }

                const matchingResponse = responses.find(r => r.real === res);
                if (matchingResponse) {
                    item.classList.add('highlight-real');
                    const realIndicator = document.createElement('div');
                    realIndicator.className = 'indicator real-answer-indicator';
                    realIndicator.innerHTML = `✅ Résolution affichée ${matchingResponse.index} : <strong>${res}</strong>`;
                    indicatorsDiv.appendChild(realIndicator);
                    
                    const { pointsText, cssClass } = getResolutionPointsAndClass(matchingResponse.user, res);
                    const userIndicator = document.createElement('div');
                    userIndicator.className = 'indicator user-answer-indicator';
                    userIndicator.innerHTML = `<span>📝 Votre choix ${matchingResponse.index} : <strong class="${cssClass}">${matchingResponse.user}</strong></span> ${pointsText}`;
                    indicatorsDiv.appendChild(userIndicator);
                } else {
                    const defaultIndicator = document.createElement('div');
                    defaultIndicator.className = 'indicator';
                    defaultIndicator.innerHTML = `Résolution : <strong>${res}</strong>`;
                    indicatorsDiv.appendChild(defaultIndicator);
                }

                const userGuessResponse = responses.find(r => r.user === res);
                if (userGuessResponse) {
                    item.classList.add('highlight-user');
                }
                
                item.append(video, indicatorsDiv);
                grid.appendChild(item);
            }

            let isPlaying = false;
            const togglePlayback = () => {
                isPlaying = !isPlaying;
                if (isPlaying) {
                    Promise.all(videoPlayersInGrid.map(v => v.play())).catch(error => { isPlaying = false; });
                } else {
                    videoPlayersInGrid.forEach(v => v.pause());
                }
            };
            grid.addEventListener('click', togglePlayback);
            setTimeout(() => {
                 videoPlayersInGrid.forEach(v => v.play().catch(e => {}));
                 isPlaying = true;
            }, 500);

        } catch (error) {
            console.error(`Erreur lors de la création de la grille pour ${videoNameToDisplay}:`, error);
            grid.innerHTML = `<p style="text-align:center; color: #888; padding: 1rem;">Impossible de charger les données pour cette comparaison.</p>`;
        }
    }
}

function calculateRecommendedResolution(satisfactionData, deviceType, availableResolutions) {
    if (!satisfactionData || !deviceType || !availableResolutions || availableResolutions.length === 0) {
        return null;
    }

    // On s'assure que les résolutions sont triées de la plus basse à la plus haute.
    const sortedResolutions = [...availableResolutions].sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));

    let recommendedRes = null;

    // 1. On cherche la première résolution qui dépasse 70% de satisfaction positive.
    for (const res of sortedResolutions) {
        const deviceStats = satisfactionData[res]?.[deviceType];
        if (deviceStats) {
            const verySatisfactory = deviceStats.verysatisfactory || 0;
            const correct = deviceStats.correct || 0;
            const total = Object.values(deviceStats).reduce((sum, count) => sum + count, 0);

            if (total > 0) {
                const positivePercentage = ((verySatisfactory + correct) / total) * 100;
                if (positivePercentage >= 70) {
                    recommendedRes = res;
                    break; // On a trouvé la plus basse, on arrête la boucle.
                }
            }
        }
    }

    // 2. Si aucune résolution n'a atteint le seuil (cas de fallback).
    if (!recommendedRes) {
        // On cherche la plus haute résolution disponible qui est 1080p ou moins.
        const resolutionsUpTo1080p = sortedResolutions.filter(res => RESOLUTION_ORDER.indexOf(res) <= RESOLUTION_ORDER.indexOf('1080p'));
        
        if (resolutionsUpTo1080p.length > 0) {
            // On prend la dernière de cette liste filtrée (la plus haute).
            recommendedRes = resolutionsUpTo1080p[resolutionsUpTo1080p.length - 1];
        } else {
            // Cas très rare : s'il n'y a que du 4k, on prend la plus basse disponible.
            recommendedRes = sortedResolutions[0];
        }
    }

    return recommendedRes;
}