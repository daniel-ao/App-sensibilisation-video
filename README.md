# 🎥 Video Experience Tester

Ce projet est une application web permettant de tester la qualité de visionnage de vidéos en fonction de différentes résolutions. Les utilisateurs évaluent la fluidité, la qualité d’image et donnent leur ressenti via un formulaire de feedback.

## 🚀 Lancer le projet

1. Ouvre un terminal à la racine du projet.
2. Lance le serveur Express :

```bash



node server/main.js

## ⚙️ Configuration du projet

Ce projet utilise **Git LFS (Large File Storage)** pour stocker les fichiers vidéo (`.mp4`).

Si tu clones le dépôt sans Git LFS, les vidéos apparaîtront comme de simples fichiers texte (pointeurs) au lieu des vraies vidéos.

### 🧭 Méthode correcte pour cloner le projet

```bash
# Installation de Git LFS (une seule fois sur ton ordinateur)
git lfs install

# Puis cloner le dépôt
git clone git@github.com:daniel-ao/App-sensibilisation-video.git
