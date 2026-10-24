-- ============================================================
-- THIÈS — Ségrégation socio-spatiale : schéma PostgreSQL / PostGIS
-- Toutes les géométries sont en EPSG:4326 (WGS 84).
-- Les tables sont remplies par database/load_data.py à partir des
-- fichiers réels du projet (aucune valeur n'est inventée).
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;

DROP VIEW  IF EXISTS v_stats_communes, v_quartiers_geojson CASCADE;
DROP TABLE IF EXISTS correlations_spearman, profils_classes, resultats_quartiers, indices_segregation, catalogue_donnees, recensement_localites, recensement_synthese,
                     infrastructures, reseau_routier, grille_200m, quartiers, communes CASCADE;

CREATE TABLE communes (
  commune_id  SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,          -- ex. 'THIES EST'
  nom         TEXT NOT NULL,                 -- ex. 'THIÈS EST'
  attributs   JSONB NOT NULL DEFAULT '{}',   -- propriétés d'origine du fichier
  geom        geometry(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE quartiers (
  quartier_id          INTEGER PRIMARY KEY,
  nom                  TEXT NOT NULL,
  commune_id           INTEGER REFERENCES communes(commune_id),
  commune              TEXT NOT NULL,
  surface_km2          DOUBLE PRECISION,
  -- Population (recensement RGPH-5, millésime 2023). 0 = non renseignée (pas de localité appariée).
  population INTEGER, menages INTEGER, hommes INTEGER, femmes INTEGER,
  -- Équipements par famille : nombre et densité (par km²)
  nb_sante INTEGER, dens_sante DOUBLE PRECISION, nb_education INTEGER, dens_education DOUBLE PRECISION,
  nb_commerce INTEGER, dens_commerce DOUBLE PRECISION, nb_sport INTEGER, dens_sport DOUBLE PRECISION,
  nb_transport INTEGER, dens_transport DOUBLE PRECISION, nb_banque INTEGER, dens_banque DOUBLE PRECISION,
  nb_assurance INTEGER, dens_assurance DOUBLE PRECISION, nb_religion INTEGER, dens_religion DOUBLE PRECISION,
  -- Accessibilité (indices fournis par le pipeline de données, non recalculés)
  acc_sante DOUBLE PRECISION, acc_education DOUBLE PRECISION, acc_commerce DOUBLE PRECISION, acc_sport DOUBLE PRECISION,
  acc_transport DOUBLE PRECISION, acc_banque DOUBLE PRECISION, acc_assurance DOUBLE PRECISION, acc_religion DOUBLE PRECISION,
  acc_globale DOUBLE PRECISION, acc_routiere_dist_m DOUBLE PRECISION, acc_routiere_indice DOUBLE PRECISION,
  -- Indices issus de l'ACP (fournis, non recalculés)
  ind_instruction DOUBLE PRECISION, ind_instruction_0_1 DOUBLE PRECISION,
  ind_niveau_vie DOUBLE PRECISION, ind_niveau_vie_0_1 DOUBLE PRECISION,
  geom geometry(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE grille_200m (
  cell_id INTEGER PRIMARY KEY, row_index INTEGER, col_index INTEGER,
  quartier_id INTEGER REFERENCES quartiers(quartier_id),   -- dérivé : quartier contenant un point de la cellule
  hub_name TEXT, hub_dist_m DOUBLE PRECISION,
  acc_routiere_dist_m DOUBLE PRECISION, acc_routiere_indice DOUBLE PRECISION, acc_globale DOUBLE PRECISION,
  acc_sante DOUBLE PRECISION, acc_sport DOUBLE PRECISION, acc_education DOUBLE PRECISION, acc_transport DOUBLE PRECISION,
  acc_banque DOUBLE PRECISION, acc_commerce DOUBLE PRECISION, acc_assurance DOUBLE PRECISION, acc_religion DOUBLE PRECISION,
  geom geometry(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE infrastructures (
  infra_id SERIAL PRIMARY KEY,
  famille TEXT NOT NULL CHECK (famille IN ('sante','education','commerce','sport','religion','transport','banque','assurance')),
  nom TEXT, type TEXT, sous_type TEXT,
  quartier_source TEXT, commune_source TEXT, region TEXT, milieu TEXT,   -- champs tels que fournis dans la source
  quartier_id INTEGER REFERENCES quartiers(quartier_id),                  -- dérivé : jointure spatiale
  geom geometry(Point, 4326) NOT NULL
);

CREATE TABLE reseau_routier (
  route_id SERIAL PRIMARY KEY, nom TEXT, type_voie TEXT, revetement TEXT,
  geom geometry(LineString, 4326) NOT NULL
);

CREATE TABLE recensement_synthese (
  id SERIAL PRIMARY KEY, annee INTEGER NOT NULL, niveau TEXT NOT NULL CHECK (niveau IN ('ville','commune')),
  commune TEXT, localites INTEGER, population INTEGER, menages INTEGER, hommes INTEGER, femmes INTEGER
);

CREATE TABLE recensement_localites (
  id SERIAL PRIMARY KEY, localite TEXT NOT NULL, commune TEXT, menages INTEGER, population INTEGER,
  statut TEXT,                                    -- 'apparie' ou non apparié à un polygone
  polygone TEXT,                                  -- nom du quartier apparié
  pop_polygone INTEGER,
  validation TEXT,                                -- ex. 'confirmé par les auteurs' (appariement validé manuellement)
  source JSONB,                                   -- enregistrement d'origine complet (champs facultatifs inclus)
  quartier_id INTEGER REFERENCES quartiers(quartier_id)
);

CREATE TABLE catalogue_donnees (id TEXT PRIMARY KEY, nom TEXT, meta JSONB NOT NULL);

-- ------------------------------------------------------------
-- Résultats validés de l'analyse de ségrégation (octobre 2026)
-- Source : dossier RESULTATS_SEGREGATION_SOCIO_SPATIALE_THIES, validé par l'encadreur.
-- ------------------------------------------------------------
-- Une ligne par quartier : indices, quartiles, coefficients de localisation, clusters LISA, classe K-means.
CREATE TABLE resultats_quartiers (
  quartier_id INTEGER PRIMARY KEY REFERENCES quartiers(quartier_id),
  instruction_0_1 DOUBLE PRECISION, instruction_quartile TEXT,
  part_sans_niveau DOUBLE PRECISION, part_prescolaire DOUBLE PRECISION, part_primaire DOUBLE PRECISION,
  part_moyen DOUBLE PRECISION, part_secondaire DOUBLE PRECISION, part_superieur DOUBLE PRECISION,
  lq_sans_niveau DOUBLE PRECISION, lq_prescolaire DOUBLE PRECISION, lq_primaire DOUBLE PRECISION,
  lq_moyen DOUBLE PRECISION, lq_secondaire DOUBLE PRECISION, lq_superieur DOUBLE PRECISION,
  entropie_scolaire_locale DOUBLE PRECISION,
  niveau_vie_0_1_corrige DOUBLE PRECISION, niveau_vie_quartile TEXT,
  densite_sante DOUBLE PRECISION, densite_education DOUBLE PRECISION, densite_commerce DOUBLE PRECISION, densite_sport DOUBLE PRECISION,
  densite_transport DOUBLE PRECISION, densite_banque DOUBLE PRECISION, densite_assurance DOUBLE PRECISION, densite_religion DOUBLE PRECISION,
  offre_infra_0_1 DOUBLE PRECISION, offre_infra_quartile TEXT,
  acces_global_moyen_0_1 DOUBLE PRECISION, acces_route_moyen_0_1 DOUBLE PRECISION, distance_route_moy_m DOUBLE PRECISION, part_cellules_ll_acces DOUBLE PRECISION,
  flux_emis DOUBLE PRECISION, flux_recus DOUBLE PRECISION, volume_echanges DOUBLE PRECISION, solde_echanges DOUBLE PRECISION,
  indice_attractivite DOUBLE PRECISION, lq_emission_hab DOUBLE PRECISION, lq_reception_hab DOUBLE PRECISION, categorie_attractivite TEXT,
  lisa_instruction_0_1 TEXT, lisa_niveau_vie_0_1_corrige TEXT, lisa_offre_infra_0_1 TEXT, lisa_acces_global_moyen_0_1 TEXT,
  lisa_indice_attractivite TEXT, lisa_flux_emis TEXT, lisa_flux_recus TEXT,        -- HH, LL, LH, HL ou NS
  classe INTEGER CHECK (classe BETWEEN 1 AND 5), nom_classe TEXT, cp1 DOUBLE PRECISION, cp2 DOUBLE PRECISION, silhouette DOUBLE PRECISION
);

-- Une ligne par indicateur analysé : indices d'inégalité, de ségrégation et d'autocorrélation spatiale.
CREATE TABLE indices_segregation (
  id SERIAL PRIMARY KEY,
  dimension TEXT NOT NULL,         -- Socio-économique, Infrastructures, Accessibilité, Mobilité
  indicateur TEXT NOT NULL,
  unite_analyse TEXT,              -- 68 quartiers, 67 quartiers, 2 170 cellules
  gini DOUBLE PRECISION, gini_pondere DOUBLE PRECISION, theil DOUBLE PRECISION,
  dissimilarite DOUBLE PRECISION, indice_segregation TEXT, entropie DOUBLE PRECISION,
  moran_i DOUBLE PRECISION, pseudo_p DOUBLE PRECISION, clusters_lisa TEXT,
  classeur TEXT                    -- classeur détaillé qui contient le calcul
);

CREATE TABLE profils_classes (
  classe INTEGER PRIMARY KEY CHECK (classe BETWEEN 1 AND 5), nom TEXT NOT NULL,
  nb_quartiers INTEGER, population INTEGER, part_population DOUBLE PRECISION
);

CREATE TABLE correlations_spearman (
  id SERIAL PRIMARY KEY, indicateur_1 TEXT NOT NULL, indicateur_2 TEXT NOT NULL, nb_quartiers INTEGER,
  rho DOUBLE PRECISION, p_brut DOUBLE PRECISION, p_fdr DOUBLE PRECISION, significatif BOOLEAN
);

CREATE INDEX quartiers_geom_gix ON quartiers USING GIST (geom);
CREATE INDEX communes_geom_gix ON communes USING GIST (geom);
CREATE INDEX grille_geom_gix ON grille_200m USING GIST (geom);
CREATE INDEX infra_geom_gix ON infrastructures USING GIST (geom);
CREATE INDEX routes_geom_gix ON reseau_routier USING GIST (geom);
CREATE INDEX resultats_classe_idx ON resultats_quartiers (classe);
CREATE INDEX infra_famille_idx ON infrastructures (famille);
CREATE INDEX infra_quartier_idx ON infrastructures (quartier_id);
CREATE INDEX grille_quartier_idx ON grille_200m (quartier_id);

CREATE VIEW v_stats_communes AS
SELECT c.code, c.nom, COUNT(q.*) AS nb_quartiers, ROUND(SUM(q.surface_km2)::numeric, 2) AS surface_km2,
       SUM(q.population) AS population, SUM(q.menages) AS menages,
       ROUND((SUM(q.population) / NULLIF(SUM(q.surface_km2) FILTER (WHERE q.population > 0), 0))::numeric, 0) AS densite_hab_km2,
       ROUND(AVG(q.acc_globale)::numeric, 3) AS acc_globale_moy,
       ROUND(AVG(q.ind_niveau_vie_0_1)::numeric, 3) AS niveau_vie_moy,
       ROUND(AVG(q.ind_instruction_0_1)::numeric, 3) AS instruction_moy
FROM communes c LEFT JOIN quartiers q USING (commune_id) GROUP BY c.code, c.nom ORDER BY c.code;

CREATE VIEW v_quartiers_geojson AS
SELECT jsonb_build_object('type','FeatureCollection','features',
  COALESCE(jsonb_agg(jsonb_build_object('type','Feature','geometry',ST_AsGeoJSON(geom)::jsonb,
    'properties', to_jsonb(q) - 'geom')), '[]'::jsonb)) AS collection
FROM quartiers q;
