// =================================================================================
// ANALYSIS.JS - Fonctions d'analyse des réponses de l'utilisateur
// =================================================================================

function analyserResolution(vraie, choisie, screenType) {
    const niveaux = RESOLUTION_ORDER;
    const iVraie = niveaux.indexOf(vraie);
    const iChoisie = niveaux.indexOf(choisie);
    if (iVraie === -1 || iChoisie === -1) return "⚠️ Résolution inconnue.";
    if (iVraie === iChoisie) return "<span class='bonne-reponse'>✅ Bonne estimation de la résolution.</span>";
    if (vraie === "144p" && (choisie === "240p" || choisie === "360p")) {
        return `<span class='mauvaise-reponse'>📉 144p reste très flou — facile à confondre avec d'autres basses résolutions, surtout sur un écran ${screenType || 'inconnu'}.</span>`;
    }
    if (vraie === "480p" && (choisie === "720p" || choisie === "1080p")) {
        let message = "📺 Vous avez perçu une qualité HD alors que ce n'était que du 480p.";
        if (screenType === "mobile" || screenType === "tablet") message += ` Sur un petit écran (${screenType}), les détails manquants peuvent être moins visibles.`;
        else if (screenType === "pc") message += " Sur un écran d’ordinateur, la différence aurait dû être plus marquée.";
        return `<span class='mauvaise-reponse'>${message}</span>`;
    }
    if (vraie === "720p" && (choisie === "1080p" || choisie === "4k")) {
        if (screenType === "mobile" || screenType === "tablet") return `<span class='mauvaise-reponse'>🎥 Vous avez vu du HD comme du Full HD/4K. Sur un ${screenType}, les hautes résolutions paraissent souvent plus proches.</span>`;
        return `<span class='mauvaise-reponse'>🎥 Vous avez confondu du 720p avec une résolution supérieure. Sur un écran ${screenType || 'inconnu'}, cela peut arriver.</span>`;
    }
    const diff = iChoisie - iVraie;
    if (diff >= 2) return `<span class='mauvaise-reponse'>🔍 Vous avez nettement surestimé la qualité. Sur un ${screenType || 'inconnu'}, cela peut arriver.</span>`;
    if (diff <= -2) return `<span class='mauvaise-reponse'>👁️ Vous avez sous-estimé la qualité. Sur un ${screenType || 'inconnu'}, cela peut arriver.</span>`;
    return "<span class='mauvaise-reponse'>ℹ️ Estimation approximative, mais pas trop éloignée.</span>";
}

function analyserConfortVisionnage(resolution, confort, screenType) {
    const niveaux = RESOLUTION_ORDER;
    const faibles = niveaux.slice(0, niveaux.indexOf("720p"));
    const hautes = niveaux.slice(niveaux.indexOf("720p"));
    let resClean = resolution.toString().toLowerCase().replace(/\s+/g, '');
    if (resClean === "2160p") resClean = "4k";
    if (!resClean.endsWith("p") && resClean !== "4k") resClean += "p";
    const confortClean = (confort || "").trim().toLowerCase();
    const isFaible = faibles.includes(resClean);
    const isHaute = hautes.includes(resClean);
    if (!niveaux.includes(resClean)) return "⚠️ Résolution inconnue, analyse impossible.";
    let message = "";
    if (isFaible) {
        if (confortClean === "verysatisfactory" || confortClean === "correct") message = "<span class='reponse_ImgQal1'>👍 Malgré la basse résolution, confort satisfaisant.</span>";
        else if (["notsatisfactory", "bad", "unwatchable"].includes(confortClean)) message = "<span class='reponse_ImgQal2'>📉 Inconfort compréhensible (faible résolution).</span>";
    }
    if (isHaute) {
        if (confortClean === "verysatisfactory" || confortClean === "correct") message = "<span class='reponse_ImgQal1'>✅ Bonne qualité, visionnage agréable.</span>";
        else if (["notsatisfactory", "bad", "unwatchable"].includes(confortClean)) message = "<span class='reponse_ImgQal2'>❗ Haute résolution mais inconfort (compression, fluidité?).</span>";
    }
    let deviceMessage = "";
    switch (screenType) {
        case "mobile": deviceMessage = "<span class='deviceInfo'>📱 Sur mobile : impact faible résolution atténué.</span>"; break;
        case "tablet": deviceMessage = "<span class='deviceInfo'>📱📘 Sur tablette : bon équilibre, sensible au réseau.</span>"; break;
        case "pc": deviceMessage = "<span class='deviceInfo'>🖥️ Sur PC : hautes résolutions visibles, exigeantes.</span>"; break;
        default: deviceMessage = `<span class='deviceInfo'>🧐 Appareil (${screenType || 'inconnu'}).</span>`;
    }
    return message + "<br>" + deviceMessage;
}

function calculateResolutionPoints(userRes, correctRes) {
    const niveaux = RESOLUTION_ORDER;
    const iUser = niveaux.indexOf(userRes);
    const iCorrect = niveaux.indexOf(correctRes);
    if (iUser === -1 || iCorrect === -1) return 0;
    const diff = Math.abs(iUser - iCorrect);
    if (diff === 0) return 2;
    if (diff === 1) return 1;
    return 0;
}

function getResolutionPointsAndClass(userRes, correctRes) {
    const points = calculateResolutionPoints(userRes, correctRes);
    let pointsText = "", cssClass = "mauvaise-reponse";
    
    if (points === 2) {
        pointsText = `<span class="points-feedback points-good">+2 pts</span>`;
        cssClass = "bonne-reponse";
    } else if (points === 1) {
        pointsText = `<span class="points-feedback points-ok">+1 pt</span>`;
    } else {
        pointsText = `<span class="points-feedback points-bad">+0 pts</span>`;
    }
    
    return { pointsText, cssClass };
}