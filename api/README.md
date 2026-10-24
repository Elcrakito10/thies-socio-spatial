# API Thiès (lecture seule) — PostGIS → JSON / GeoJSON

Les réponses ont exactement le format des fichiers de `frontend/public/data` (vérifié : mêmes propriétés, mêmes valeurs, mêmes géométries).

## Lancer
**Avec Docker** (depuis la racine du projet) : `docker compose up -d db api` puis, la première fois, `py database\load_data.py` pour remplir la base.
**Sans conteneur API** : `cd api`, `npm install`, `npm start` (variables facultatives POSTGRES_HOST/PORT/DB/USER/PASSWORD ; port par défaut de la base : 5433). Puis, dans `frontend`, `npm run dev` : le proxy envoie `/api` vers http://localhost:8001.
Si l'API est éteinte, l'application lit automatiquement les fichiers locaux (le pied de page indique la source utilisée).

## Routes (GET)
| Route | Réponse |
|---|---|
| /api/health | état de la base |
| /api/communes | GeoJSON des 3 communes |
| /api/quartiers[?commune=THIES EST] | GeoJSON des 68 quartiers (tous les indicateurs) |
| /api/quartiers/{id} | un quartier |
| /api/quartiers/{id}/equipements[?famille=sante] | équipements du quartier |
| /api/infrastructures[?famille=&quartier_id=&bbox=minx,miny,maxx,maxy] | équipements (points) |
| /api/grille[?quartier_id=] | grille 200 m + accessibilités |
| /api/reseau-routier | réseau routier |
| /api/densites · /api/accessibilites · /api/acp | tableaux par quartier (sans géométrie) |
| /api/stats | synthèse ville, communes, équipements |
| /api/recensement · /api/recensement/localites | RGPH-5 |
| /api/datasets | catalogue des données |
| /api/resultats | résultats validés par quartier : indices, quartiles, LQ, clusters LISA, classe K-means |
| /api/indices-segregation | Gini, Theil, dissimilarité, IS, entropie, Moran, LISA par indicateur |
| /api/profils · /api/correlations | les 5 profils de quartiers · corrélations de Spearman |
Familles : sante, education, commerce, sport, religion, transport, banque, assurance. Erreurs : 400 (paramètre invalide), 404, 405 (écriture refusée), 503 (base indisponible).
