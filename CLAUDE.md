# HeavyMed Apps — Instructions permanentes

## Règles absolues
- **Ne jamais modifier** les applis verrouillées (`simulateur-financier/`, `usip-simulateur/`) sans confirmation explicite de l'utilisateur.
- **Toujours présenter un plan détaillé** avant d'écrire le moindre code. Attendre le feu vert explicite.
- **Ne jamais committer ni pusher** sur GitHub sans accord explicite.

## Contexte projet
Suite d'applis web statiques (HTML/CSS/JS) hébergées sur GitHub Pages.
Répertoire : `C:\Claude Code\Web apps` — URL : `https://heavymed.github.io`
Serveur local de prévisualisation : `.claude/launch.json` config `web-apps`, port 3001.

## Applis existantes
- `medpulse/` — Veille médicale (en cours de développement)
- `usip-simulateur/` — Simulateur USC (**verrouillé**)
- `simulateur-financier/` — Simulateur d'investissement (**verrouillé**)
- `index.html` — Dashboard HeavyMed Apps

## Conventions design
- Thème dark mode + néon coloré par appli (rouge MedPulse, bleu USC, orange Investissement)
- Icônes SVG uniquement (pas d'emojis)
- Titres des articles conservés dans leur langue originale (anglais PubMed, français Cardiologie Pratique)
- Mémoire complète du projet : `memory/project_web_apps.md`
