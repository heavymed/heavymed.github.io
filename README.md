# Mes applications web

Suite de calculateurs et simulateurs pour mon activité de médecin.

## Accès

Une fois déployé sur GitHub Pages, le site sera accessible depuis n'importe quel navigateur (ordinateur ou smartphone) à l'adresse :

`https://<mon-pseudo-github>.github.io/<nom-du-repo>/`

## Structure du projet

```
.
├── index.html              # Tableau de bord (page d'accueil)
├── shared/
│   └── style.css           # Feuille de style commune
└── simulateur-financier/   # Une application par sous-dossier
    └── index.html
```

## Comment ajouter une nouvelle application

1. Créer un nouveau sous-dossier (ex : `calculateur-doses/`)
2. Y placer un fichier `index.html` (s'inspirer du modèle de `simulateur-financier/index.html`)
3. Ajouter un bloc `<a class="app-card">` dans `index.html` (à la racine) pour la lier au tableau de bord
4. Si besoin de Git : commit + push → le site se met à jour automatiquement

## Tester localement

Ouvrir simplement `index.html` dans un navigateur (double-clic sur le fichier).
