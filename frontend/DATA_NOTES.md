# Données intégrées — Thiès

## Périmètres
- 3 communes urbaines : THIES EST, THIES OUEST, THIES NORD.
- 68 polygones de quartiers issus de `quartier_TH.shp`.
- Répartition des polygones : 22 THIES EST, 23 THIES OUEST, 23 THIES NORD.
- Le champ utilisé pour la commune urbaine est `CCRCA`, et non `CAV` (qui contenait notamment la valeur THIES SUD dans la couche source).

## Recensement 2023
Le fichier `data-recensement thies (2)(2).xlsx` contient 70 localités recensées :
- Population : 391 253
- Ménages : 47 581
- Hommes : 195 085
- Femmes : 196 168

Répartition population :
- THIES EST : 166 256
- THIES NORD : 136 138
- THIES OUEST : 88 859

## Enquête ménages
Le fichier `resultats (4).xlsx` contient 8 feuilles de synchronisation. Chaque feuille est comptée comme une synchronisation de collecte conformément à la règle demandée pour l'application.

Nombre de lignes par feuille : 7 + 12 + 4 + 8 + 11 + 33 + 51 + 98 = **224 ménages/enregistrements enquêtés**.

Le total est présenté comme un volume de collecte et non comme une estimation exhaustive de la population de Thiès.

## Confidentialité
Les noms, numéros de téléphone et autres informations personnelles du fichier d'enquête ne sont pas exposés dans l'interface publique.

## Résultats de l'analyse de ségrégation (octobre 2026)
Source : dossier RESULTATS_SEGREGATION_SOCIO_SPATIALE_THIES (validé par l'encadreur M. Alphousseyni Ndonky).
- `public/data/resultats_quartiers.json` : valeurs par quartier (clé `quartier_id`), fusionnées dans chaque quartier par `src/api.ts` (`dataFetch`), que les données viennent de l'API ou des fichiers.
  Les anciens `ind_niveau_vie_0_1` (indice inversé) et `ind_instruction_0_1` sont remplacés par les valeurs validées.
- `public/data/resultats_indices.json` : tableau des indices (Gini, Theil, D, IS, H, Moran, LISA), corrélations, corrections, classification (KMO, ACP, choix de k, profils).
- `public/data/resultats_base_68.json` : base finale (catalogue Données).
- `public/resultats/` : rapports PDF, base CSV/XLSX, synthèse XLSX, GeoPackage, 19 cartes (`cartes/*.webp`).
Points ouverts signalés par le groupe : règle de découpage du réseau routier, méthode de collecte de la mobilité, superficie de Cité Senghor II (0,026 km²).
