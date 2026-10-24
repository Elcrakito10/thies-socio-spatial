#!/usr/bin/env python3
"""Charge les données réelles du projet dans PostgreSQL/PostGIS.

Usage :
    pip install "psycopg[binary]"
    python database/load_data.py            # crée le schéma puis charge tout
Variables (facultatives) : POSTGRES_HOST/PORT/DB/USER/PASSWORD, DATA_DIR
Les fichiers lus sont ceux de frontend/public/data (source unique des données de l'application).
"""
import json, os, sys, unicodedata
from pathlib import Path
import psycopg

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.getenv("DATA_DIR", ROOT / "frontend" / "public" / "data"))
FAMILLES = ["sante", "education", "commerce", "sport", "religion", "transport", "banque", "assurance"]

def conn_params():
    return dict(host=os.getenv("POSTGRES_HOST", "localhost"), port=os.getenv("POSTGRES_PORT", "5433"),
                dbname=os.getenv("POSTGRES_DB", "thies_socio_spatial"), user=os.getenv("POSTGRES_USER", "thies"),
                password=os.getenv("POSTGRES_PASSWORD", "thies_dev_password"))

def load(name): return json.loads((DATA / name).read_text(encoding="utf-8"))
def norm(s): return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().upper().strip()
def to_int(v): return None if v is None else int(round(float(v)))

GEOM = "ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)"
MULTI = "ST_Multi(ST_CollectionExtract(ST_MakeValid(" + GEOM + "), 3))"

def main():
    schema = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
    with psycopg.connect(**conn_params(), autocommit=False) as cx, cx.cursor() as cur:
        cur.execute(schema)

        # --- communes
        for f in load("communes_thies.geojson")["features"]:
            p = f["properties"]; code = norm(p["commune"])
            cur.execute(f"INSERT INTO communes (code, nom, attributs, geom) VALUES (%s,%s,%s,{MULTI})",
                        (code, p.get("commune_display") or p["commune"], json.dumps(p), json.dumps(f["geometry"])))
        cur.execute("SELECT code, commune_id FROM communes"); cid = dict(cur.fetchall())

        # --- quartiers
        cols_int = {"quartier_id", "population", "menages", "hommes", "femmes"} | {f"nb_{x}" for x in FAMILLES}
        qf = load("quartiers_thies.geojson")["features"]
        keys = [k for k in qf[0]["properties"].keys()]
        for f in qf:
            p = f["properties"]
            vals = [to_int(p[k]) if k in cols_int else p[k] for k in keys]
            cur.execute(f"INSERT INTO quartiers ({','.join(keys)}, commune_id, geom) VALUES ({','.join(['%s']*len(keys))}, %s, {MULTI})",
                        vals + [cid.get(norm(p['commune'])), json.dumps(f["geometry"])])

        # --- grille 200 m
        gf = load("grille_200m.geojson")["features"]
        gk = [k for k in gf[0]["properties"].keys()]
        for f in gf:
            p = f["properties"]
            cur.execute(f"INSERT INTO grille_200m ({','.join(gk)}, geom) VALUES ({','.join(['%s']*len(gk))}, {MULTI})",
                        [p[k] for k in gk] + [json.dumps(f["geometry"])])
        cur.execute("""UPDATE grille_200m g SET quartier_id = q.quartier_id FROM quartiers q
                       WHERE ST_Contains(q.geom, ST_PointOnSurface(g.geom))""")

        # --- infrastructures (8 familles)
        n_inf = 0
        for fam in FAMILLES:
            for f in load(f"infrastructures/infra_{fam}.geojson")["features"]:
                p = f["properties"]
                cur.execute(f"""INSERT INTO infrastructures (famille, nom, type, sous_type, quartier_source, commune_source, region, milieu, geom)
                                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,{GEOM})""",
                            (fam, p.get("nom"), p.get("type"), p.get("sous_type"), p.get("quartier"), p.get("commune"),
                             p.get("region"), p.get("milieu"), json.dumps(f["geometry"])))
                n_inf += 1
        cur.execute("""UPDATE infrastructures i SET quartier_id = q.quartier_id FROM quartiers q
                       WHERE ST_Within(i.geom, q.geom)""")

        # --- réseau routier
        for f in load("reseau_routier.geojson")["features"]:
            p = f["properties"]
            cur.execute(f"INSERT INTO reseau_routier (nom, type_voie, revetement, geom) VALUES (%s,%s,%s,{GEOM})",
                        (p.get("nom"), p.get("type_voie"), p.get("revetement"), json.dumps(f["geometry"])))

        # --- recensement
        s = load("census_summary.json")
        cur.execute("INSERT INTO recensement_synthese (annee, niveau, commune, localites, population, menages, hommes, femmes) VALUES (%s,'ville',NULL,%s,%s,%s,%s,%s)",
                    (s["annee"], s["localites_recensees"], s["population"], s["menages"], s["hommes"], s["femmes"]))
        for c, v in s["par_commune"].items():
            cur.execute("INSERT INTO recensement_synthese (annee, niveau, commune, population, menages, hommes, femmes) VALUES (%s,'commune',%s,%s,%s,%s,%s)",
                        (s["annee"], c, v["population"], v["menages"], v["hommes"], v["femmes"]))
        cur.execute("SELECT nom, quartier_id FROM quartiers"); qid = {norm(n): i for n, i in cur.fetchall()}
        for r in load("census_localites.json"):
            cur.execute("INSERT INTO recensement_localites (localite, commune, menages, population, statut, polygone, pop_polygone, validation, source, quartier_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                        (r["localite"], r.get("commune"), r.get("menages"), r.get("population"), r.get("statut"), r.get("polygone"), r.get("pop_polygone"), r.get("validation"), json.dumps(r, ensure_ascii=False), qid.get(norm(r.get("polygone") or ""))))

        # --- catalogue
        for d in load("datasets_catalog.json"):
            cur.execute("INSERT INTO catalogue_donnees (id, nom, meta) VALUES (%s,%s,%s)", (d["id"], d.get("name"), json.dumps(d)))
        # --- résultats validés de l'analyse de ségrégation
        res = load("resultats_quartiers.json")
        for qid_, r in res.items():
            cols = [c.lower() for c in r.keys()]
            cur.execute(f"INSERT INTO resultats_quartiers (quartier_id, {','.join(cols)}) VALUES (%s, {','.join(['%s']*len(cols))})", [int(qid_), *r.values()])
        ri = load("resultats_indices.json")
        for i in ri["indices"]:
            cur.execute("""INSERT INTO indices_segregation (dimension, indicateur, unite_analyse, gini, gini_pondere, theil, dissimilarite, indice_segregation, entropie, moran_i, pseudo_p, clusters_lisa, classeur)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (i["dimension"], i["indicateur"], i["unite"], i["gini"], i["gini_pond"], i["theil"], i["D"],
                         None if i["IS"] is None else str(i["IS"]), i["H"], i["moran"], i["p"], i["lisa"], i["classeur"]))
        for c in ri["correlations"]:
            cur.execute("INSERT INTO correlations_spearman (indicateur_1, indicateur_2, nb_quartiers, rho, p_brut, p_fdr, significatif) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                        (c["a"], c["b"], c["n"], c["rho"], c["p"], c["pfdr"], c["sig"]))
        cur.execute("""INSERT INTO profils_classes (classe, nom, nb_quartiers, population, part_population)
                       SELECT r.classe, r.nom_classe, COUNT(*), SUM(q.population),
                              SUM(q.population)::float / SUM(SUM(q.population)) OVER ()
                       FROM resultats_quartiers r JOIN quartiers q USING (quartier_id) GROUP BY r.classe, r.nom_classe ORDER BY r.classe""")
        cx.commit()

        # --- rapport de contrôle
        print("Tables chargées :")
        for t in ["communes", "quartiers", "grille_200m", "infrastructures", "reseau_routier", "recensement_synthese", "recensement_localites", "catalogue_donnees", "resultats_quartiers", "indices_segregation", "profils_classes", "correlations_spearman"]:
            cur.execute(f"SELECT COUNT(*) FROM {t}"); print(f"  {t:24s} {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM grille_200m WHERE quartier_id IS NULL"); print(f"  cellules sans quartier   {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM infrastructures WHERE quartier_id IS NULL"); print(f"  équipements hors quartier {cur.fetchone()[0]}")
        cur.execute("""SELECT COUNT(*) FROM quartiers q WHERE
            (SELECT COUNT(*) FROM infrastructures i WHERE i.quartier_id = q.quartier_id)
            <> q.nb_sante+q.nb_education+q.nb_commerce+q.nb_sport+q.nb_transport+q.nb_banque+q.nb_assurance+q.nb_religion""")
        print(f"  quartiers dont le nb d'équipements (jointure spatiale) diffère de la colonne nb_* : {cur.fetchone()[0]}")
        cur.execute("SELECT SUM(population) FROM quartiers"); print(f"  population rattachée aux quartiers : {cur.fetchone()[0]}")

if __name__ == "__main__":
    try: main()
    except psycopg.OperationalError as e:
        sys.exit(f"Connexion impossible : {e}\nDémarrez la base (docker compose up -d db) ou vérifiez POSTGRES_* .")
