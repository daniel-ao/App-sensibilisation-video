# --- Configuration ---
DOCKER_IMAGE = registry.gitlab.com/amirost/app-video:latest

# Chemins sur le serveur
SERVER_FRONTEND_PATH = /srv/tngames/www-data/app-sensibilisation-video/
SERVER_BACKEND_PATH  = /srv/sensibilisation-video-backend/

# Variables SSH (Doivent être fournies par l'utilisateur)
SSH_USER ?=
SSH_HOST ?=


# --- Commandes ---

# Commande par défaut : Aide
help:
	@echo "--- Makefile App Sensibilisation Vidéo ---"
	@echo ""
	@echo "Commandes disponibles :"
	@echo "  make install      -> Installe les dépendances Node.js locales"
	@echo "  make build        -> Construit et pousse l'image Docker sur GitLab"
	@echo "  make deploy       -> Déploie les fichiers sur le serveur (Frontend + Config + Data)"
	@echo "                       Usage: make deploy SSH_USER=mon_user SSH_HOST=mon_serveur"
	@echo "  make update       -> Met à jour le service backend sur le serveur"
	@echo "                       Usage: make update SSH_USER=mon_user SSH_HOST=mon_serveur"
	@echo "  make release      -> Fait tout d'un coup (Build + Deploy + Update)"
	@echo ""

# Validation des variables d'environnement obligatoires
check-env:
ifndef SSH_USER
	$(error Erreur : SSH_USER n'est pas défini. Utilisez 'make [commande] SSH_USER=votre_user SSH_HOST=votre_serveur')
endif
ifndef SSH_HOST
	$(error Erreur : SSH_HOST n'est pas défini. Utilisez 'make [commande] SSH_USER=votre_user SSH_HOST=votre_serveur')
endif

# 1. Installation
install:
	@echo "--- Installation des dépendances ---"
	npm install

# 2. Construction
build:
	@echo "--- Construction de l'image Docker ---"
	docker build -t $(DOCKER_IMAGE) -f backend/docker/Dockerfile .
	@echo "--- Publication sur GitLab ---"
	docker push $(DOCKER_IMAGE)

# 3. Déploiement (Nécessite SSH)
deploy: check-env
	@echo "--- Déploiement Frontend ---"
	rsync -avz --delete ./frontend/ $(SSH_USER)@$(SSH_HOST):$(SERVER_FRONTEND_PATH)
	
	@echo "--- Déploiement Backend (Config) ---"
	rsync -avz ./deploy/docker-compose.yaml ./deploy/.env $(SSH_USER)@$(SSH_HOST):$(SERVER_BACKEND_PATH)
	
	@echo "--- Déploiement Backend (Données & Vidéos) ---"
	# Copie des données vers le sous-dossier 'data'
	rsync -avz ./data/ $(SSH_USER)@$(SSH_HOST):$(SERVER_BACKEND_PATH)data/
	# Copie des vidéos vers le sous-dossier 'videos'
	# On crée le dossier s'il n'existe pas
	ssh $(SSH_USER)@$(SSH_HOST) "mkdir -p $(SERVER_BACKEND_PATH)videos/"
	rsync -avz ./Videos_License ./Video_enfants ./Videos_Creative_Common $(SSH_USER)@$(SSH_HOST):$(SERVER_BACKEND_PATH)videos/

# 4. Mise à jour du service (Nécessite SSH)
update: check-env
	@echo "--- Redémarrage du service sur le serveur ---"
	ssh $(SSH_USER)@$(SSH_HOST) "cd $(SERVER_BACKEND_PATH) && docker-compose pull && docker-compose up -d"

# Raccourci global
release: build deploy update
	@echo "--- Mise en production terminée avec succès ! ---"