# THIÈS · GéoPortail — Ségrégation socio-spatiale

Plateforme WebSIG du projet de fin de cycle (Licence Géomatique, UFR SI, Université Iba Der Thiam de Thiès) :
**« La ségrégation socio-spatiale à Thiès »** — Abdoul Aziz Dione & Mouhamed Oumar Sissokho Sy, encadrés par Dr Alphousseyni Ndonky.

Pages : Accueil · Cartothèque · Géoportail · Tableau de bord · Analyse · Histoire · Données · À propos.
Toutes les valeurs affichées proviennent des couches et résultats du projet (68 quartiers, 3 communes, 8 familles d'équipements, grille 200 m, réseau routier OSM, RGPH-5 2023).

## Lancer en local

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

L'application fonctionne **sans base de données** : elle lit alors les fichiers de `frontend/public/data` et `frontend/public/resultats`.

### Option : base PostGIS + API
```bash
docker compose up -d db          # PostgreSQL 16 + PostGIS (port 5433)
python database/load_data.py     # charge les couches
node api/index.mjs               # API sur :8001 (le front la détecte automatiquement)
```

### Option : assistant en langage libre
Copier `frontend/.env.example` vers `frontend/.env`, y mettre votre clé, puis `node frontend/server/index.mjs`.
Sans clé, l'assistant répond avec son moteur local. **Ne jamais committer `.env`.**

## Déploiement (site statique)
Le dossier `frontend` se déploie tel quel sur **Vercel**, **Netlify** ou **Cloudflare Pages** (commande `npm run build`, dossier `dist`, répertoire racine `frontend`).
Les chemins sont absolus (`/data/...`) : le site doit être servi à la racine d'un domaine (pas dans un sous-dossier).
PostGIS et l'API ne sont pas hébergés dans ce mode ; l'application bascule sur les fichiers statiques.
