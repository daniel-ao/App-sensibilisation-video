# Application "Sensibilisation Vidéo"

Ce projet est une application web interactive visant à sensibiliser les utilisateurs à l'impact de la résolution vidéo sur la consommation de données et l'empreinte carbone.

## Architecture du Projet

L'application est composée de deux parties distinctes :

1.  Frontend :
    - Fichiers HTML, CSS, JS client.
    - Servis par le serveur web global 'tngames' (Nginx).
    - Localisation source : dossier 'frontend/'.

2.  Backend :
    - Localisation source : dossier 'backend/'.
    - Configuration de déploiement : dossier 'deploy/'.

## Structure des Répertoires (Déploiement)

Sur le serveur de production, l'application respecte la structure suivante :

1. Frontend
    - Chemin serveur : "/srv/tngames/www-data/app-sensibilisation-video/"
    - Contenu : 'index.html', 'assets/', 'img/', 'chart.umd.js', 'resultats.html'.

2. Backend
    - Chemin serveur : "/srv/sensibilisation-video-backend/"
    - Contenu :
        - docker-compose.yaml
        - .env
        - data/ : Sous-dossier contenant les fichiers de données persistants (data.csv, data.json).
        - videos/ : Sous-dossier contenant les répertoires de médias.


## Procédure de Construction (Build)

L'image Docker du backend doit être construite et poussée sur le registre GitLab avant tout déploiement.

Depuis la racine du projet :

1.  Se connecter au registre :

    docker login registry.gitlab.com

2.  Construire l'image :

    docker build -t registry.gitlab.com/amirost/app-video:latest .

    (Note : Utilise le Dockerfile situé dans `backend/docker/Dockerfile` via le contexte)

3.  Publier l'image :

    docker push registry.gitlab.com/amirost/app-video:latest
