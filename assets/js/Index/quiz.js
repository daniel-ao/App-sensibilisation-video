// =================================================================================
// QUIZ.JS - Gestion du popup de quiz après le visionnage des vidéos
// =================================================================================

const baseQuizQuestions = [
    { question: "Le confort de visionnage était-il satisfaisant pour la première vidéo ?", options: [ { text: "Oui, très satisfaisant", value: "verySatisfactory" }, { text: "Correct", value: "correct" }, { text: "Pas vraiment satisfaisant", value: "notSatisfactory" }, { text: "Mauvaise qualité", value: "bad" }, { text: "Vidéo très difficile à regarder", value: "unwatchable" } ], name: "imageQuality1" },
    { question: "Quelle était la première résolution choisie ?", options: [ { text: "144p", value: "144p" }, { text: "240p", value: "240p" }, { text: "360p", value: "360p" }, { text: "480p", value: "480p" }, { text: "720p", value: "720p" }, { text: "1080p", value: "1080p" }, { text: "4K", value: "4k" } ], name: "resolution1" },
    { question: "Le confort de visionnage était-il satisfaisant pour la deuxième vidéo ?", options: [ { text: "Oui, très satisfaisant", value: "verySatisfactory" }, { text: "Correct", value: "correct" }, { text: "Pas vraiment satisfaisant", value: "notSatisfactory" }, { text: "Mauvaise qualité", value: "bad" }, { text: "Vidéo très difficile à regarder", value: "unwatchable" } ], name: "imageQuality2" },
    { question: "Quelle était la deuxième résolution choisie ?", options: [ { text: "144p", value: "144p" }, { text: "240p", value: "240p" }, { text: "360p", value: "360p" }, { text: "480p", value: "480p" }, { text: "720p", value: "720p" }, { text: "1080p", value: "1080p" }, { text: "4K", value: "4k" } ], name: "resolution2" },
    { question: "Quelle qualité as-tu préférée ?", options: [ { text: "Première résolution", value: "first" }, { text: "Deuxième résolution", value: "second" }, { text: "Aucune différence", value: "none" } ], name: "preferredResolution" },
    { question: "Qu’est-ce qui est le plus important pour toi ?", options: [ { text: "La qualité d'image", value: "qualite" }, { text: "La fluidité", value: "fluidite" }, { text: "Le confort visuel global", value: "confort" }, { text: "Aucun de ces critères", value: "aucun" } ], name: "importantCriteria", lastSessionOnly: true },
    { question: "Commentaires ou remarques ?", isText: true, name: "comments", lastSessionOnly: true }
];

let quizCurrentIndex = 0;
let quizAnswers = {};
let currentQuizSet = [];
let quizSubmissionCallback = null;

const quizPopup = document.getElementById('quizPopup');
const quizProgressEl = document.getElementById('quizProgress');
const quizQuestionEl = document.getElementById('quizQuestion');
const quizAnswersDiv = document.getElementById('quizAnswers');
const quizBackBtn = document.getElementById('quizBackBtn');
const quizSubmitBtn = document.getElementById('quizSubmitBtn');

function showQuizPopup(isLastSession, onSubmit) {
    quizCurrentIndex = 0;
    quizAnswers = {};
    quizSubmissionCallback = onSubmit;

    currentQuizSet = baseQuizQuestions.filter(q => !q.lastSessionOnly || isLastSession);
    if (quizPopup) quizPopup.style.display = 'flex';
    renderCurrentQuestion();
}

function renderCurrentQuestion() {
    const q = currentQuizSet[quizCurrentIndex];
    if (!q || !quizProgressEl || !quizQuestionEl || !quizAnswersDiv) return;

    quizProgressEl.textContent = `Question ${quizCurrentIndex + 1} sur ${currentQuizSet.length}`;
    quizQuestionEl.innerHTML = q.question;
    quizAnswersDiv.innerHTML = '';
    quizSubmitBtn.style.display = 'none';

    if (q.isText) {
        let textarea = document.createElement('textarea');
        textarea.rows = 3;
        textarea.style.cssText = "width: 100%; resize: vertical; font-family: inherit; font-size: inherit;";
        textarea.value = quizAnswers[q.name] || '';
        textarea.placeholder = "Ton avis, ressenti, suggestion…";
        textarea.oninput = (e) => { quizAnswers[q.name] = e.target.value; };
        quizAnswersDiv.appendChild(textarea);
    } else {
        q.options.forEach((opt) => {
            let btn = document.createElement('button');
            btn.textContent = opt.text;
            btn.className = "quiz-answer-btn";
            if (quizAnswers[q.name] === opt.value) btn.classList.add('selected');
            btn.onclick = () => {
                quizAnswers[q.name] = opt.value;
                handleAnswerSelection();
            };
            quizAnswersDiv.appendChild(btn);
        });
    }

    quizBackBtn.style.display = quizCurrentIndex > 0 ? 'inline-block' : 'none';
    
    // Afficher le bouton soumettre à la dernière question
    if (quizCurrentIndex === currentQuizSet.length - 1) {
        quizSubmitBtn.style.display = 'inline-block';
    }
}

function handleAnswerSelection() {
    if (quizCurrentIndex < currentQuizSet.length - 1) {
        quizCurrentIndex++;
        renderCurrentQuestion();
    } else {
        // C'est la dernière question, le bouton soumettre devient visible
        quizSubmitBtn.style.display = 'inline-block';
    }
}

function submitQuiz() {
    const { res1, res2, path1, path2 } = window.currentVideoData;
    
    if (!res1 || !res2) {
        console.error("Résolutions réelles manquantes à la soumission !");
        alert("Erreur critique, impossible de soumettre les résultats.");
        return;
    }
    
    if (quizPopup) quizPopup.style.display = 'none';

    const data = {
        resolution1: res1,
        resolution2: res2,
        videoPath1: path1,
        videoPath2: path2,
        QO1: `(${(quizAnswers.resolution1 || "").trim()}, ${(quizAnswers.resolution2 || "").trim()})`,
        QO2: `(${(quizAnswers.imageQuality1 || "").trim()}, ${(quizAnswers.imageQuality2 || "").trim()})`,
        QO3: (quizAnswers.preferredResolution || "").trim(),
        QO4: (quizAnswers.importantCriteria || "").trim(),
        QO5: (quizAnswers.comments || "").trim(),
        comments: (quizAnswers.comments || "").trim(),
        screenType: detectDeviceType(),
    };

    if (quizSubmissionCallback) quizSubmissionCallback(data);
}

function detectDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
    return 'pc';
}

function initQuiz() {
    quizBackBtn?.addEventListener('click', () => {
        if (quizCurrentIndex > 0) {
            quizCurrentIndex--;
            renderCurrentQuestion();
        }
    });
    quizSubmitBtn?.addEventListener('click', submitQuiz);
}