import os
import re

# ---------------------------
# CONFIGURATION
# ---------------------------
root_folder = r"D:/App-sensibilisation-video/Videos"  # <-- mets ton dossier ici

# ---------------------------
# Parcours récursif et renommage
# ---------------------------

pattern = re.compile(r"(?:_|)(\d{3,4})(p?)\.mp4$", re.IGNORECASE)

print(f"🔍 Parcours du dossier racine : {root_folder}\n")

for dirpath, _, filenames in os.walk(root_folder):
    print(f"📂 Dossier : {dirpath}")

    for filename in filenames:
        if filename.lower().endswith(".mp4"):
            print(f"   🎬 Fichier trouvé : {filename}")

            match = pattern.search(filename)
            if match:
                resolution = match.group(1)  # ex: "360" ou "1080"
                res = f"{resolution}p"       # on force l'ajout du "p"
                old_path = os.path.join(dirpath, filename)
                new_name = f"segment_{res}.mp4"
                new_path = os.path.join(dirpath, new_name)

                if old_path != new_path:
                    print(f"   ✏️  Renommage : {filename}  →  {new_name}")
                    try:
                        os.rename(old_path, new_path)
                        print(f"   ✅ Succès : {new_name}")
                    except Exception as e:
                        print(f"   ❌ Erreur lors du renommage : {e}")
            else:
                print(f"   ⚠️ Ignoré (ne correspond pas à un fichier résolution)")

    print("")  # ligne vide entre dossiers

print("🎉 Fin du traitement : tous les fichiers ont été analysés.")
