APPLICATION DE SUIVI DU MATÉRIEL — ROSSET BOULON ET FILS
=========================================================

FICHIERS À METTRE SUR GITHUB
----------------------------
Mets directement ces fichiers à la racine du dépôt GitHub :

- README_INSTALL.txt
- app.js
- config.js
- index.html
- manifest.webmanifest
- service-worker.js
- styles.css
- supabase.sql

Il n’y a volontairement aucune image.

ÉTAPE 1 — CRÉER LA BASE SUPABASE
---------------------------------
1. Ouvre ton projet Supabase.
2. Va dans SQL Editor.
3. Clique sur New query.
4. Ouvre le fichier supabase.sql.
5. Copie tout son contenu dans Supabase.
6. Clique sur Run.

ÉTAPE 2 — CRÉER UN UTILISATEUR
-------------------------------
1. Dans Supabase, ouvre Authentication puis Users.
2. Clique sur Add user puis Create new user.
3. Entre une adresse e-mail et un mot de passe.
4. Confirme automatiquement l’utilisateur si l’option est proposée.

ÉTAPE 3 — RELIER L’APPLICATION À SUPABASE
------------------------------------------
1. Dans Supabase, clique sur Connect.
2. Copie Project URL.
3. Copie Publishable key, commençant normalement par sb_publishable_.
4. Sur GitHub, ouvre config.js puis clique sur le crayon.
5. Remplace :

   https://VOTRE-PROJET.supabase.co

   par ton Project URL.

6. Remplace :

   sb_publishable_VOTRE_CLE

   par ta Publishable key.

7. Clique sur Commit changes.

Ne mets jamais une Secret key ou la clé service_role dans config.js.

ÉTAPE 4 — ACTIVER GITHUB PAGES
-------------------------------
1. Ouvre Settings dans ton dépôt GitHub.
2. Clique sur Pages.
3. Dans Build and deployment, choisis Deploy from a branch.
4. Sélectionne la branche main et le dossier /(root).
5. Clique sur Save.
6. Attends quelques minutes : GitHub affichera l’adresse de l’application.

UTILISATION
-----------
- Connexion avec l’e-mail et le mot de passe créés dans Supabase.
- Ajout et modification des chantiers et du dépôt.
- Ajout et modification du matériel.
- Transfert complet ou partiel entre deux emplacements.
- Historique de tous les mouvements.
- Ajout de factures et de fiches de suivi.
- Utilisation sur téléphone et ordinateur.

