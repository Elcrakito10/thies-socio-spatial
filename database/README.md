# Base PostgreSQL / PostGIS — thies_socio_spatial

Toutes les données réelles du projet (quartiers, communes, grille 200 m, 8 familles d'équipements, réseau routier,
recensement RGPH-5, catalogue) sont chargées dans PostGIS, en EPSG:4326. Rien n'est inventé. Les résultats validés de l'analyse de ségrégation
(indices, clusters LISA, profils K-means) sont chargés dans quatre tables dédiées.

## Mise en route (Windows / Docker Desktop)
```
docker compose up -d db          # démarre PostGIS (port 5432, base thies_socio_spatial, user thies)
pip install "psycopg[binary]"
python database/load_data.py     # crée le schéma puis charge les données (≈ 3 s), affiche un rapport de contrôle
```
Le script relit `frontend/public/data/` (même source que l'application) et peut être relancé à volonté : il recrée les tables.
Sans Docker : installez PostgreSQL + PostGIS, créez la base et l'utilisateur, puis réglez `POSTGRES_HOST/PORT/DB/USER/PASSWORD`.

## Tables
| Table | Contenu | Lignes |
|---|---|---|
| communes | 3 communes (polygones) | 3 |
| quartiers | 68 quartiers : population, densités et nombre d'équipements, accessibilités, indices ACP, géométrie | 68 |
| grille_200m | cellules 200 m : accessibilités par famille + routière, quartier d'appartenance | 2170 |
| infrastructures | équipements (points) des 8 familles, quartier déduit par jointure spatiale | 5953 |
| reseau_routier | tronçons de route (lignes) | 4658 |
| recensement_synthese | totaux RGPH-5 2023 (ville, communes) | 4 |
| recensement_localites | 70 localités recensées et leur appariement aux quartiers | 70 |
| catalogue_donnees | métadonnées des jeux de données | 13 |
| resultats_quartiers | résultats validés par quartier (indices, LQ, LISA, classe K-means) | 68 |
| indices_segregation | Gini, Theil, D, IS, H, Moran, LISA par indicateur | 28 |
| profils_classes | les 5 profils de quartiers | 5 |
| correlations_spearman | corrélations entre dimensions | 12 |

Vues : `v_stats_communes` (synthèse par commune), `v_quartiers_geojson` (FeatureCollection prête pour une API).

## Points d'attention (vérifiés au chargement)
- 3 localités du recensement n'ont pas de polygone (`recensement_localites.quartier_id IS NULL`) : 12 781 habitants non rattachés aux quartiers.
- 3 quartiers ont une population à 0 = « non renseignée » (HLM Thialy, Diakhao Souf, Nguinth Extension) : à exclure des moyennes de population.
- 5 équipements (famille éducation) tombent hors de tout quartier ; les colonnes `nb_*` des quartiers coïncident avec le décompte spatial pour les 68 quartiers.
- Les accessibilités sont stockées telles que fournies (la grille et les quartiers n'ont pas la même échelle) ; seule la population porte un millésime (2023).

## Exemples
```sql
SELECT * FROM v_stats_communes;
SELECT nom, acc_globale FROM quartiers ORDER BY acc_globale LIMIT 5;
SELECT q.nom, COUNT(*) FROM infrastructures i JOIN quartiers q USING (quartier_id) WHERE famille='sante' GROUP BY q.nom ORDER BY 2 DESC;
SELECT ST_AsGeoJSON(geom) FROM quartiers WHERE nom ILIKE 'hersent';
```
