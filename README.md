# MNA Connect — Le réseau de la Nouvelle Alliance

Application web (PWA) du Ministère de la Nouvelle Alliance.
Site statique (HTML, CSS, JavaScript) relié à Supabase (authentification, base de données, stockage, temps réel).

Fichiers : `index.html`, `app.js`, `style.css`, `sw.js` (cache + notifications push), `manifest.webmanifest`, logo officiel (`logo.png`, `logo-entete.png`) et icônes PNG (`icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon`).

La clé `sb_publishable_…` présente dans `app.js` est publique par conception : la sécurité repose sur les règles d'accès (RLS) de Supabase.
Ne jamais ajouter de clé `service_role` dans ce dépôt.
