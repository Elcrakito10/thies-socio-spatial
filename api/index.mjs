// API REST en lecture seule au-dessus de PostGIS. Les réponses ont EXACTEMENT le format des fichiers
// de frontend/public/data : l'application peut donc lire indifféremment l'API ou les fichiers.
import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.PORT || 8001);
const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || "localhost", port: Number(process.env.POSTGRES_PORT || 5433),
  database: process.env.POSTGRES_DB || "thies_socio_spatial", user: process.env.POSTGRES_USER || "thies",
  password: process.env.POSTGRES_PASSWORD || "thies_dev_password", max: 8,
});
const FAMILLES = ["sante", "education", "commerce", "sport", "religion", "transport", "banque", "assurance"];
const G = (col = "geom") => `ST_AsGeoJSON(${col}, 7)::jsonb`;
const fc = (features) => ({ type: "FeatureCollection", features });
const feat = (r) => ({ type: "Feature", properties: r.properties, geometry: r.geometry });
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const intParam = (v, name) => { const n = Number(v); if (!Number.isInteger(n)) throw new HttpError(400, `Paramètre ${name} invalide`); return n; };
const famille = (v) => { if (v == null) return null; if (!FAMILLES.includes(v)) throw new HttpError(400, `famille inconnue (${FAMILLES.join(", ")})`); return v; };

// ---------- routes ----------
const routes = [];
const GET = (path, fn) => routes.push([new RegExp("^" + path.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "/?$"), fn]);

GET("/api/health", async () => { const [r] = await q("SELECT COUNT(*)::int AS quartiers FROM quartiers"); return { ok: true, base: "PostGIS", quartiers: r.quartiers }; });

GET("/api/communes", async () => fc((await q(`SELECT attributs AS properties, ${G()} AS geometry FROM communes ORDER BY commune_id`)).map(feat)));

GET("/api/quartiers", async (p, u) => {
  const c = u.searchParams.get("commune");
  const rows = await q(`SELECT to_jsonb(t) - 'geom' - 'commune_id' AS properties, ${G("t.geom")} AS geometry FROM quartiers t
                        WHERE ($1::text IS NULL OR upper(t.commune) = upper($1)) ORDER BY t.quartier_id`, [c]);
  return fc(rows.map(feat));
});
GET("/api/quartiers/:id", async ({ id }) => {
  const rows = await q(`SELECT to_jsonb(t) - 'geom' - 'commune_id' AS properties, ${G("t.geom")} AS geometry FROM quartiers t WHERE quartier_id = $1`, [intParam(id, "id")]);
  if (!rows.length) throw new HttpError(404, "Quartier introuvable"); return feat(rows[0]);
});
GET("/api/quartiers/:id/equipements", async ({ id }, u) => {
  const rows = await q(`SELECT jsonb_build_object('famille', famille, 'nom', nom, 'type', type, 'sous_type', sous_type, 'quartier', quartier_source, 'commune', commune_source, 'region', region, 'milieu', milieu) AS properties, ${G()} AS geometry
                        FROM infrastructures WHERE quartier_id = $1 AND ($2::text IS NULL OR famille = $2) ORDER BY infra_id`, [intParam(id, "id"), famille(u.searchParams.get("famille"))]);
  return fc(rows.map(feat));
});

GET("/api/infrastructures", async (p, u) => {
  const bbox = u.searchParams.get("bbox")?.split(",").map(Number);
  if (bbox && (bbox.length !== 4 || bbox.some(Number.isNaN))) throw new HttpError(400, "bbox attendu : minx,miny,maxx,maxy");
  const rows = await q(`SELECT jsonb_build_object('famille', famille, 'nom', nom, 'type', type, 'sous_type', sous_type, 'quartier', quartier_source, 'commune', commune_source, 'region', region, 'milieu', milieu) AS properties, ${G()} AS geometry
                        FROM infrastructures
                        WHERE ($1::text IS NULL OR famille = $1) AND ($2::int IS NULL OR quartier_id = $2)
                          AND ($3::float8 IS NULL OR geom && ST_MakeEnvelope($3, $4, $5, $6, 4326)) ORDER BY infra_id`,
    [famille(u.searchParams.get("famille")), u.searchParams.has("quartier_id") ? intParam(u.searchParams.get("quartier_id"), "quartier_id") : null, ...(bbox ?? [null, null, null, null])]);
  return fc(rows.map(feat));
});

GET("/api/grille", async (p, u) => {
  const rows = await q(`SELECT (to_jsonb(g) - 'geom' - 'quartier_id') AS properties, ${G("g.geom")} AS geometry FROM grille_200m g
                        WHERE ($1::int IS NULL OR quartier_id = $1) ORDER BY cell_id`, [u.searchParams.has("quartier_id") ? intParam(u.searchParams.get("quartier_id"), "quartier_id") : null]);
  return fc(rows.map(feat));
});
GET("/api/reseau-routier", async () => fc((await q(`SELECT jsonb_build_object('nom', nom, 'type_voie', type_voie, 'revetement', revetement) AS properties, ${G()} AS geometry FROM reseau_routier ORDER BY route_id`)).map(feat)));

// Vues thématiques (JSON tabulaire, sans géométrie)
const thematique = (cols, extra = "") => async () => q(`SELECT quartier_id, nom, commune, ${cols} FROM quartiers ${extra} ORDER BY quartier_id`);
GET("/api/densites", thematique(FAMILLES.flatMap(f => [`nb_${f}`, `dens_${f}`]).join(", ") + ", surface_km2, population"));
GET("/api/accessibilites", thematique(FAMILLES.map(f => `acc_${f}`).join(", ") + ", acc_globale, acc_routiere_dist_m, acc_routiere_indice"));
GET("/api/acp", thematique("ind_instruction, ind_instruction_0_1, ind_niveau_vie, ind_niveau_vie_0_1"));

GET("/api/stats", async () => {
  const [ville] = await q(`SELECT COUNT(*)::int AS quartiers, ROUND(SUM(surface_km2)::numeric,2)::float AS surface_km2, SUM(population)::int AS population_rattachee, COUNT(*) FILTER (WHERE population = 0)::int AS quartiers_sans_population FROM quartiers`);
  const equip = await q(`SELECT famille, COUNT(*)::int AS nombre FROM infrastructures GROUP BY famille ORDER BY nombre DESC`);
  const communes = await q(`SELECT code, nom, nb_quartiers::int, surface_km2::float, population::int, menages::int, densite_hab_km2::float, acc_globale_moy::float, niveau_vie_moy::float, instruction_moy::float FROM v_stats_communes`);
  return { ville, equipements: equip, communes, source: "PostGIS (v_stats_communes, infrastructures, quartiers)" };
});

GET("/api/recensement", async () => {
  const rows = await q(`SELECT * FROM recensement_synthese ORDER BY id`); const v = rows.find(r => r.niveau === "ville");
  return { annee: v.annee, localites_recensees: v.localites, population: v.population, menages: v.menages, hommes: v.hommes, femmes: v.femmes,
    par_commune: Object.fromEntries(rows.filter(r => r.niveau === "commune").map(r => [r.commune, { population: r.population, menages: r.menages, hommes: r.hommes, femmes: r.femmes }])) };
});
GET("/api/recensement/localites", async () => (await q(`SELECT source FROM recensement_localites ORDER BY id`)).map(r => r.source));
GET("/api/datasets", async () => (await q(`SELECT meta FROM catalogue_donnees ORDER BY ctid`)).map(r => r.meta));
GET("/api/resultats", async () => q(`SELECT r.*, q.nom, q.commune FROM resultats_quartiers r JOIN quartiers q USING (quartier_id) ORDER BY r.quartier_id`));
GET("/api/indices-segregation", async () => ({ source: "Analyse validée (Dione & Sissokho Sy)", indices: await q(`SELECT dimension, indicateur, unite_analyse, gini, gini_pondere, theil, dissimilarite, indice_segregation, entropie, moran_i, pseudo_p, clusters_lisa FROM indices_segregation ORDER BY id`) }));
GET("/api/profils", async () => q(`SELECT classe, nom, nb_quartiers, population, part_population FROM profils_classes ORDER BY classe`));
GET("/api/correlations", async () => q(`SELECT indicateur_1, indicateur_2, nb_quartiers, rho, p_brut, p_fdr, significatif FROM correlations_spearman ORDER BY abs(rho) DESC`));

// ---------- serveur ----------
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };
http.createServer(async (req, res) => {
  const send = (code, body, extra = {}) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", ...CORS, ...extra }); res.end(JSON.stringify(body)); };
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
    if (req.method !== "GET") throw new HttpError(405, "Lecture seule : méthode GET uniquement");
    const u = new URL(req.url, "http://x");
    for (const [re, fn] of routes) {
      const m = re.exec(u.pathname); if (m) return send(200, await fn(m.groups ?? {}, u), { "cache-control": "public, max-age=60" });
    }
    throw new HttpError(404, "Route inconnue");
  } catch (e) {
    if (e instanceof HttpError) return send(e.code, { erreur: e.message });
    console.error(e.message); send(503, { erreur: "Base de données indisponible ou requête invalide" });
  }
}).listen(PORT, () => console.log(`API Thiès sur http://localhost:${PORT}  (base ${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || 5433})`));
