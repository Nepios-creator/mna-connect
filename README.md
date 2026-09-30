# MNA Connect — Le réseau de la Nouvelle Alliance

Application web (PWA) du Ministère de la Nouvelle Alliance.
Site statique (HTML, CSS, JavaScript) relié à Supabase (authentification, base de données, stockage, temps réel).

Fichiers : `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`.

La clé `sb_publishable_…` présente dans `app.js` est publique par conception : la sécurité repose sur les règles d'accès (RLS) de Supabase.
Ne jamais ajouter de clé `service_role` dans ce dépôt.
