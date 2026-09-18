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

Si tu avais déjà lancé une ancienne version de supabase.sql, relance entièrement
ce nouveau fichier : il enlève l’obligation de créer un compte ou un mot de passe.

ÉTAPE 2 — RELIER L’APPLICATION À SUPABASE
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

ÉTAPE 3 — ACTIVER GITHUB PAGES
-------------------------------
1. Ouvre Settings dans ton dépôt GitHub.
2. Clique sur Pages.
3. Dans Build and deployment, choisis Deploy from a branch.
4. Sélectionne la branche main et le dossier /(root).
5. Clique sur Save.
6. Attends quelques minutes : GitHub affichera l’adresse de l’application.

UTILISATION
-----------
- Ouverture directe sans compte et sans mot de passe.
- Ajout et modification des chantiers et du dépôt.
- Ajout et modification du matériel.
- Transfert complet ou partiel entre deux emplacements.
- Historique de tous les mouvements.
- Ajout de factures et de fiches de suivi.
- Utilisation sur téléphone et ordinateur.

ATTENTION : comme il n’y a pas de connexion, toute personne possédant le lien
de l’application pourra consulter et modifier l’inventaire.
