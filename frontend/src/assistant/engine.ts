import { INFRA_FAMILIES, computeStats, quartileClass, type QuartierFull } from "../Geoportail";
import type { MapCtx } from "./store";

// ============================================================
// Moteur d'analyse de l'Assistant Spatial de Thiès.
// 100 % local et deterministe : chaque nombre cite est lu ou calcule
// a partir des donnees chargees dans l'application. Aucune valeur n'est
// inventee ; quand l'information manque, le moteur le dit.
// ============================================================
export type Q = QuartierFull & { geometry?: any };
export type Section = { kind: "obs" | "calc" | "interp" | "hyp" | "dispo"; lines: string[] };
export type Answer = {
  unrecognized?: boolean; title?: string; sections: Section[];
  table?: { head: string[]; rows: string[][] };
  followups?: string[];
};
export type Memory = { quartierId?: number; indId?: string };
export type Data = { quartiers: Q[]; census?: any | null; grid?: any | null };

export const LABEL: Record<Section["kind"], string> = {
  obs: "Données observées", calc: "Calculs", interp: "Interprétation", hyp: "Hypothèses (non testées)", dispo: "Disponibilité",
};

// ---------- utilitaires ----------
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/[^a-z0-9 /%.-]/g, " ").replace(/\s+/g, " ").trim();
export const nf = (v: number, d = 2) => (Math.abs(v) >= 1000 ? v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : v.toLocaleString("fr-FR", { maximumFractionDigits: d }));
const communeName = (c: string) => c.replace(/^Thies/i, "Thiès").replace("THIES", "Thiès");

// ---------- catalogue d'indicateurs ----------
export type Ind = { id: string; label: string; unit: string; get: (q: Q) => number | null; kind: "pop" | "dens" | "acc" | "inst" | "vie" | "count" | "seg"; fam?: string; d: number };
const FAM_KW: Record<string, string[]> = {
  sante: ["sante", "hopit", "hosto", "clinique", "dispensaire", "medical", "pharmacie", "maternite", "soin", "medecin", "poste de sante"],
  education: ["education", "ecole", "lycee", "college", "scolaire", "universite", "creche", "etudi", "enseignement", "classe"],
  commerce: ["commerce", "marche", "boutique", "commercial", "magasin", "supermarche", "boulangerie", "vendeur", "achat"],
  sport: ["sport", "stade", "terrain", "foot", "gymnase", "basket"],
  religion: ["religion", "mosquee", "eglise", "culte", "religieux", "paroisse", "temple", "priere", "cathedrale"],
  transport: ["transport", "gare", "bus", "station", "taxi", "arret", "garage", "mobilite"],
  banque: ["banque", "bancaire", "banques", "microfinance", "distributeur", "guichet"],
  assurance: ["assurance"],
};
export const INDS: Ind[] = [
  { id: "population", label: "Population (RGPH-5)", unit: "hab.", get: q => (q.population > 0 ? q.population : null), kind: "pop", d: 0 },
  { id: "densite_pop", label: "Densité de population", unit: "hab./km²", get: q => (q.surface_km2 && q.population > 0 ? q.population / q.surface_km2 : null), kind: "pop", d: 0 },
  ...INFRA_FAMILIES.map(f => ({ id: `dens_${f.key}`, label: `Densité d'équipements — ${f.label}`, unit: "éq./km²", get: (q: Q) => (q as any)[`dens_${f.key}`] as number | null, kind: "dens" as const, fam: f.key, d: 1 })),
  ...INFRA_FAMILIES.map(f => ({ id: `nb_${f.key}`, label: `Nombre d'équipements — ${f.label}`, unit: "éq.", get: (q: Q) => (q as any)[`nb_${f.key}`] as number | null, kind: "count" as const, fam: f.key, d: 0 })),
  ...INFRA_FAMILIES.map(f => ({ id: `acc_${f.key}`, label: `Accessibilité — ${f.label}`, unit: "indice", get: (q: Q) => (q as any)[`acc_${f.key}`] as number | null, kind: "acc" as const, fam: f.key, d: 2 })),
  { id: "acc_globale", label: "Accessibilité globale", unit: "indice", get: q => q.acc_globale, kind: "acc", d: 2 },
  { id: "acc_routiere_indice", label: "Accessibilité routière", unit: "indice 0–1", get: q => q.acc_routiere_indice, kind: "acc", d: 2 },
  { id: "ind_instruction_0_1", label: "Niveau d'instruction (ACP)", unit: "indice 0–1", get: q => q.ind_instruction_0_1, kind: "inst", d: 2 },
  { id: "ind_niveau_vie_0_1", label: "Niveau de vie matériel (ACP, indice corrigé)", unit: "indice 0–1", get: q => q.ind_niveau_vie_0_1, kind: "vie", d: 2 },
  { id: "offre_infra_0_1", label: "Offre d'infrastructures (indicateur synthétique)", unit: "indice 0–1", get: q => q.offre_infra_0_1 ?? null, kind: "seg", d: 2 },
  { id: "indice_attractivite", label: "Indice d'attractivité (mobilité)", unit: "−1 à +1", get: q => q.indice_attractivite ?? null, kind: "seg", d: 2 },
  { id: "flux_emis", label: "Flux émis", unit: "flux", get: q => q.flux_emis ?? null, kind: "seg", d: 0 },
  { id: "flux_recus", label: "Flux reçus", unit: "flux", get: q => q.flux_recus ?? null, kind: "seg", d: 0 },
  { id: "LQ_superieur", label: "Coefficient de localisation — supérieur", unit: "ratio", get: q => q.LQ_superieur ?? null, kind: "seg", d: 2 },
  { id: "LQ_sans_niveau", label: "Coefficient de localisation — sans niveau", unit: "ratio", get: q => q.LQ_sans_niveau ?? null, kind: "seg", d: 2 },
];
const ALIAS: Record<string, string> = { routier: "acc_routiere_indice", instruction: "ind_instruction_0_1", niveau_vie: "ind_niveau_vie_0_1" };
export const findInd = (id: string) => INDS.find(i => i.id === (ALIAS[id] ?? id));
const famOf = (t: string): string | null => { for (const [k, ws] of Object.entries(FAM_KW)) if (ws.some(w => t.includes(w))) return k; return null; };

export function detectInd(t: string): Ind | null {
  const fam = famOf(t);
  if (/offre d infrastructure|offre infra|offre d equipement|indicateur synthetique/.test(t)) return findInd("offre_infra_0_1")!;
  if (/attractivite|attractif/.test(t)) return findInd("indice_attractivite")!;
  if (/flux (emis|sortant)|emetteur/.test(t)) return findInd("flux_emis")!;
  if (/flux (recu|entrant)|recepteur/.test(t)) return findInd("flux_recus")!;
  if (/(coefficient de localisation|\blq\b).*(superieur|diplome)|diplomes? du superieur/.test(t)) return findInd("LQ_superieur")!;
  if (/(coefficient de localisation|\blq\b).*sans niveau|sans niveau|non scolaris/.test(t)) return findInd("LQ_sans_niveau")!;
  if (/niveau de vie|vie materiel|richesse|aise|pauvre|standing/.test(t)) return findInd("ind_niveau_vie_0_1")!;
  if (/instruction|alphabet|niveau d etude|scolarisation/.test(t)) return findInd("ind_instruction_0_1")!;
  if (/routier|route|voirie|reseau routier/.test(t) && /acces|dessert|distance|proxim|route|routier/.test(t)) return findInd("acc_routiere_indice")!;
  if (/densite de population|densite population|hab ?\/ ?km|densite demographique/.test(t)) return findInd("densite_pop")!;
  if (/accessib|dessert|acces |proximite/.test(t)) return fam ? findInd(`acc_${fam}`)! : findInd("acc_globale")!;
  if (/densite/.test(t)) return fam ? findInd(`dens_${fam}`)! : findInd("densite_pop")!;
  if (/equipement|infrastructure|combien d/.test(t) && fam) return findInd(`nb_${fam}`)!;
  if (/population|habitant|peuple|demograph/.test(t)) return findInd("population")!;
  if (fam) return findInd(`dens_${fam}`)!;
  return null;
}
function detectAllInds(t: string): Ind[] {
  // decoupe sur « et / avec / vs / entre » pour reperer deux indicateurs
  const parts = t.split(/ et | avec | vs | versus | entre | ou /).map(s => s.trim()).filter(Boolean);
  const out: Ind[] = [];
  for (const p of parts) { const i = detectInd(p); if (i && !out.find(o => o.id === i.id)) out.push(i); }
  return out;
}

// ---------- statistiques ----------
type Row = { q: Q; v: number };
const rowsOf = (qs: Q[], ind: Ind): Row[] => qs.map(q => ({ q, v: ind.get(q) as number })).filter(r => r.v !== null && r.v !== undefined && Number.isFinite(r.v));
const rankOf = (rows: Row[], id: number) => { const s = [...rows].sort((a, b) => b.v - a.v); const i = s.findIndex(r => r.q.quartier_id === id); return i < 0 ? null : { rank: i + 1, of: s.length }; };
const median = (v: number[]) => computeStats(v)?.median ?? NaN;
const QLAB = ["Q1 (valeurs les plus faibles)", "Q2", "Q3", "Q4 (valeurs les plus élevées)"];
export function pearson(a: number[], b: number[]) {
  const n = a.length; if (n < 4) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : null;
}
const corrWord = (r: number) => { const a = Math.abs(r); const w = a >= 0.7 ? "forte" : a >= 0.4 ? "modérée" : a >= 0.2 ? "faible" : "quasi nulle"; return `${w} ${r >= 0 ? "positive" : "négative"}`; };

// ---------- geometrie : centroides, voisinage, distance au barycentre ----------
const geoCache = new WeakMap<Q[], { cx: Map<number, [number, number]>; center: [number, number] }>();
function geo(qs: Q[]) {
  let g = geoCache.get(qs); if (g) return g;
  const cx = new Map<number, [number, number]>(); let sx = 0, sy = 0, sw = 0;
  for (const q of qs) {
    const gm = q.geometry; if (!gm) continue;
    const polys: number[][][][] = gm.type === "Polygon" ? [gm.coordinates] : gm.coordinates;
    let best = polys[0]; let ba = -1;
    for (const p of polys) { const r = p[0]; let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9; r.forEach(([x, y]) => { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }); const a = (mxx - mnx) * (mxy - mny); if (a > ba) { ba = a; best = p; } }
    const r = best[0]; let x = 0, y = 0; r.forEach(([a, b]) => { x += a; y += b; }); x /= r.length; y /= r.length;
    cx.set(q.quartier_id, [x, y]);
    if (q.population > 0) { sx += x * q.population; sy += y * q.population; sw += q.population; }
  }
  g = { cx, center: sw ? [sx / sw, sy / sw] : [0, 0] }; geoCache.set(qs, g); return g;
}
const km = (a: [number, number], b: [number, number]) => { const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180); return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111.32; };
const distCenter = (qs: Q[], q: Q) => { const g = geo(qs); const c = g.cx.get(q.quartier_id); return c ? km(c, g.center) : null; };
function neighbours(qs: Q[], q: Q, n = 5): Q[] {
  const g = geo(qs); const c = g.cx.get(q.quartier_id); if (!c) return [];
  return qs.filter(o => o.quartier_id !== q.quartier_id && g.cx.has(o.quartier_id)).map(o => ({ o, d: km(c, g.cx.get(o.quartier_id)!) })).sort((a, b) => a.d - b.d).slice(0, n).map(x => x.o);
}


// ---------- tolerance aux fautes : correction par similarite de mots ----------
const lev = (a: string, b: string, max: number): number => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length; let p2: number[] = [], p1 = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i]; let mn = i;
    for (let j = 1; j <= n; j++) {
      let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1); // transposition
      cur[j] = v; mn = Math.min(mn, v);
    }
    if (mn > max) return max + 1;
    p2 = p1; p1 = cur;
  }
  return p1[n];
};
const KEYWORDS = ("quartier quartiers commune communes population habitant habitants peuple peuples demographie densite accessibilite accessible acces desservi desservis desserte equipement equipements infrastructure infrastructures sante hopital hopitaux clinique dispensaire education ecole ecoles lycee college universite commerce commerces marche marches boutique sport stade religion mosquee mosquees eglise transport gare bus banque banques assurance assurances routier route routes voirie instruction alphabetisation niveau vie pauvre pauvres riche riches richesse aise standing compare comparer comparaison difference differences correlation lien relation pourquoi cause causes raison explique expliquer definition signifie classement classer meilleur meilleurs pire pires faible faibles eleve eleves elevee elevees plus moins mieux mal bien synthese resume bilan statistique statistiques chiffres carte analyser analyse interpreter piste pistes action actions recommandation priorite prioriser ameliorer investir thies nord est ouest segregation gini lisa dissimilarite entropie revenu revenus salaire chomage emploi evolution tendance profil territoire indicateur indicateurs equipes surface zone zones peupl dense denses repartition ecart ecarts defavorise defavorises favorise favorises").split(" ");
const STOP = new Set("de la le les des du un une et ou en au aux a ce cet cette ces mon ma mes ton ta son sa ses il elle on nous vous je tu que qui quoi dans sur par pour avec sans est sont etre ete avoir ai as fait faire dit dis moi toi lui y ne pas non oui si mais donc car ni se leur leurs tout tous toute toutes tres peu trop assez entre vers chez sous quel quels quelle quelles comment combien quand donne montre affiche liste cite veux voudrais peux peut cherche trouve dire savoir voir ici la ou d l c n s t m j qu vs et".split(" "));
const vocabCache = new WeakMap<Q[], { all: string[]; names: Set<string> }>();
function vocab(qs: Q[]) {
  let v = vocabCache.get(qs); if (v) return v;
  const names = new Set<string>(); qs.forEach(q => norm(q.nom).replace(/\(.*?\)/g, " ").split(" ").filter(w => w.length > 2).forEach(w => names.add(w)));
  v = { all: Array.from(new Set([...KEYWORDS, ...names])), names }; vocabCache.set(qs, v); return v;
}
const maxDist = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);
/** Corrige chaque mot proche (faute de frappe) vers le mot du vocabulaire le plus proche. */
const SMS: Record<string, string> = { vi: "vie", nivo: "niveau", nivau: "niveau", niv: "niveau", kartier: "quartier", kartiers: "quartiers", kel: "quels", kels: "quels", kil: "quel", pop: "population", acces: "acces", dens: "densite", hosto: "hopital", ecol: "ecole", cmpar: "compare", cmp: "compare" };
function correct(t: string, qs: Q[]): string {
  const v = vocab(qs); const set = new Set(v.all);
  return t.split(" ").map(w => {
    if (SMS[w]) return SMS[w];
    if (w.length <= 3 || set.has(w) || STOP.has(w) || /\d/.test(w)) return w;
    const sing = w.replace(/(s|x)$/, ""); if (set.has(sing)) return sing;
    const md = maxDist(w.length); let best = w, bd = md + 1;
    for (const c of v.all) { const d = lev(w, c, md); if (d < bd) { bd = d; best = c; if (d === 1) { /* continue pour chercher mieux */ } } }
    return bd <= md ? best : w;
  }).join(" ");
}
/** Synonymes et formulations courantes ramenes a la forme canonique comprise par les regles. */
function canon(t: string): string {
  return t
    .replace(/\b(c ?koi|ckoi|kesako|ca veut dire quoi|ca veut dire|c est quoi|cest quoi|qu est ce que c est|qu est ce que)\b/g, "c est quoi")
    .replace(/\b(pk|pq|pourkoi|pourqoi|porquoi)\b/g, "pourquoi")
    .replace(/\b(mal desservis?|defavorises?|delaisses?|abandonnes?|enclaves?|isoles?|peripheriques?|sous equipes?|manque d?\b)/g, "moins desservis")
    .replace(/\b(bien desservis?|favorises?|privilegies?|bien equipes?|les mieux)\b/g, "mieux desservis")
    .replace(/\b(les pauvres?|plus pauvres?|plus defavorises?)\b/g, "niveau de vie plus faible")
    .replace(/\b(les riches?|plus riches?|plus aises?)\b/g, "niveau de vie plus eleve")
    .replace(/\b(quel est le (nombre|total) d|combien d)\b/g, "combien d")
    .replace(/\b(qui est|lesquels|lesquelles|quelles? sont les|quels sont les)\b/g, "quels")
    .replace(/\b(diff|differencie|differencient|oppose|opposent|se distingue|se distinguent)\b/g, "difference")
    .replace(/\b(rapport|lien|influence|depend)\b/g, "correlation")
    .replace(/\s+/g, " ").trim();
}

// ---------- detection des quartiers / communes ----------
export function findQuartiers(t: string, qs: Q[]): Q[] {
  const out: { q: Q; pos: number }[] = [];
  const padded = ` ${t} `; let rest = t;
  const found: { q: Q; len: number; pos: number; name: string }[] = [];
  for (const q of qs) {
    const n = norm(q.nom).replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim(); if (n.length < 3) continue;
    const i = padded.indexOf(` ${n} `);
    if (i >= 0) found.push({ q, len: n.length, pos: i, name: n });
  }
  // retire les noms contenus dans un nom plus long deja trouve (« mbour » dans « mbour i »)
  const keep = found.filter(f => !found.some(g => g !== f && g.len > f.len && g.pos <= f.pos && g.pos + g.len >= f.pos + f.len));
  for (const f of keep) { out.push({ q: f.q, pos: (padded.slice(0, f.pos).match(/ /g) || []).length - 1 }); rest = (" " + rest + " ").replace(` ${f.name} `, " ~ ").trim(); }
  // approximatif : fenetres de mots de la reste de la question comparees aux noms (fautes d'orthographe)
  const toks = rest.split(" "); const have = new Set(out.map(o => o.q.quartier_id)); const best: { q: Q; d: number; pos: number }[] = [];
  for (const q of qs) {
    if (have.has(q.quartier_id)) continue;
    const n = norm(q.nom).replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim(); const nws = n.split(" "); const nw = nws.length; if (n.length < 5) continue;
    const md = n.length >= 9 ? 2 : 1; let bd = md + 1, bp = -1;
    for (let i = 0; i + nw <= toks.length; i++) {
      const win = toks.slice(i, i + nw); if (win.some(w => w === "~" || STOP.has(w) || (KEYWORDS.includes(w) && !nws.includes(w)))) continue;
      const d = lev(win.join(" "), n, md); if (d > 0 && d < bd) { bd = d; bp = i; }
    }
    if (bp >= 0) best.push({ q, d: bd, pos: bp });
  }
  best.sort((a, b) => a.d - b.d || a.pos - b.pos);
  const used = new Set<number>();
  for (const b of best) { if (used.has(b.pos)) continue; used.add(b.pos); out.push({ q: b.q, pos: b.pos }); if (out.length >= 3) break; }
  if (out.length) return out.sort((a, b) => a.pos - b.pos).map(o => o.q);
  // repli : tous les mots significatifs du nom sont dans la question
  const words = t.split(" ").filter(w => w.length > 2);
  const fb = qs.map(q => { const nw = norm(q.nom).split(" ").filter(w => w.length > 2); const hit = nw.filter(w => words.includes(w)).length; return { q, score: nw.length ? hit / nw.length : 0, hit }; })
    .filter(x => x.hit >= 1 && x.score >= 0.99).sort((a, b) => b.hit - a.hit);
  return fb.slice(0, 2).map(x => x.q);
}
export function findCommune(t: string): string | null {
  if (/thies nord|commune nord|\bnord\b/.test(t)) return "Thies Nord";
  if (/thies ouest|commune ouest|\bouest\b/.test(t)) return "Thies Ouest";
  if (/thies est|commune est\b/.test(t)) return "Thies Est";
  return null;
}
const inCommune = (qs: Q[], c: string) => qs.filter(q => norm(q.commune) === norm(c));

// ---------- briques de reponse ----------
const unitStr = (i: Ind, v: number) => `${nf(v, i.d)} ${i.unit}`;
function summaryLines(ind: Ind, qs: Q[]): { st: NonNullable<ReturnType<typeof computeStats>>; rows: Row[] } | null {
  const rows = rowsOf(qs, ind); const st = computeStats(rows.map(r => r.v)); return st ? { st, rows } : null;
}
function communeBreakdown(ind: Ind, qs: Q[]): string[] {
  return ["Thies Nord", "Thies Est", "Thies Ouest"].map(c => {
    const r = rowsOf(inCommune(qs, c), ind); if (!r.length) return `${communeName(c)} : aucune valeur.`;
    const st = computeStats(r.map(x => x.v))!; const sum = r.reduce((a, x) => a + x.v, 0);
    return ind.id === "population" ? `${communeName(c)} : ${nf(sum, 0)} hab. sur ${r.length} quartiers renseignés (moyenne ${nf(st.mean, 0)}).` : `${communeName(c)} : moyenne ${unitStr(ind, st.mean)}, médiane ${unitStr(ind, st.median)} (${r.length} quartiers).`;
  });
}
const NOTE: Record<Ind["kind"], string> = {
  pop: "Population : recensement RGPH-5 (ANSD, 2023) rattaché aux quartiers par appariement des localités.",
  dens: "Densité d'équipements : nombre d'équipements de la famille rapporté à la surface du quartier (km²).",
  count: "Nombre d'équipements de la famille recensés dans le quartier (couches thématiques de l'application).",
  acc: "Indice d'accessibilité fourni par les données (calculé à l'échelle de la grille 200 m puis moyenné par quartier). Il est affiché tel quel, sans recalcul ; la convention de l'application est « valeur élevée = mieux desservi ».",
  inst: "Score issu d'une Analyse en Composantes Principales (ACP) sur les données du recensement, mis à l'échelle 0–1. Affiché tel que fourni, non recalculé.",
  vie: "Indice de niveau de vie corrigé (1 − ancien indice) : ACP sur 27 taux d'équipement des ménages, mis à l'échelle 0–1. Valeur validée par l'encadreur, affichée telle quelle.",
  seg: "Résultat de l'analyse de ségrégation validée (offre d'infrastructures, mobilité, coefficients de localisation). Affiché tel que fourni, non recalculé.",
};

export function explainInd(ind: Ind, d: Data): Answer {
  const s = summaryLines(ind, d.quartiers);
  const sections: Section[] = [{ kind: "obs", lines: [NOTE[ind.kind]] }];
  if (s) sections.push({ kind: "calc", lines: [`Sur ${s.rows.length} quartiers renseignés : min ${unitStr(ind, s.st.min)}, médiane ${unitStr(ind, s.st.median)}, moyenne ${unitStr(ind, s.st.mean)}, max ${unitStr(ind, s.st.max)}.`] });
  sections.push({ kind: "interp", lines: [
    ind.kind === "acc" ? "Plus l'indice est élevé, plus le quartier est bien desservi par rapport aux autres quartiers de Thiès. Il ne mesure pas la qualité des services." :
    ind.kind === "dens" ? "Une densité élevée signifie beaucoup d'équipements par km² ; elle peut refléter un quartier central dense autant qu'une offre abondante." :
    ind.kind === "inst" || ind.kind === "vie" ? "Un score proche de 1 signale un niveau relativement élevé par rapport aux autres quartiers ; c'est un indicateur relatif, pas un pourcentage de personnes." :
    ind.kind === "seg" ? "Un coefficient de localisation supérieur à 1 signale un groupe surreprésenté dans le quartier par rapport à la ville ; l'indice d'attractivité va de −1 (quartier émetteur) à +1 (quartier attractif)." :
    ind.kind === "pop" ? "La population dépend de la taille du quartier ; la densité permet de comparer des quartiers de surfaces différentes." : "Compte brut : à rapprocher de la population ou de la surface pour comparer les quartiers." ] });
  return { title: ind.label, sections, followups: [`Résume « ${ind.label} »`, `Quels sont les quartiers les plus élevés pour ${ind.label.toLowerCase()} ?`] };
}

export function summarizeInd(ind: Ind, d: Data): Answer {
  const s = summaryLines(ind, d.quartiers); const qs = d.quartiers;
  if (!s) return unavailable(`l'indicateur « ${ind.label} » (aucune valeur renseignée)`);
  const top = [...s.rows].sort((a, b) => b.v - a.v);
  const nbMissing = qs.length - s.rows.length;
  const dc = rowsOf(qs, ind).map(r => ({ v: r.v, dist: distCenter(qs, r.q) })).filter(x => x.dist !== null);
  const r = pearson(dc.map(x => x.v), dc.map(x => x.dist as number));
  const inter: string[] = [];
  const communeMeans = ["Thies Nord", "Thies Est", "Thies Ouest"].map(c => ({ c, m: median(rowsOf(inCommune(qs, c), ind).map(x => x.v)) })).filter(x => Number.isFinite(x.m)).sort((a, b) => b.m - a.m);
  if (communeMeans.length > 1) inter.push(`Par la médiane des quartiers, ${communeName(communeMeans[0].c)} est la plus élevée (${unitStr(ind, communeMeans[0].m)}) et ${communeName(communeMeans[communeMeans.length - 1].c)} la plus basse (${unitStr(ind, communeMeans[communeMeans.length - 1].m)}).`);
  if (r !== null) inter.push(`Corrélation entre cet indicateur et la distance au barycentre de la population : r = ${nf(r, 2)} (${corrWord(r)}). ${Math.abs(r) >= 0.4 ? (r < 0 ? "Les valeurs tendent à baisser quand on s'éloigne du centre." : "Les valeurs tendent à augmenter quand on s'éloigne du centre.") : "La position par rapport au centre n'explique pas à elle seule la répartition."}`);
  return {
    title: `Synthèse — ${ind.label}`,
    sections: [
      { kind: "obs", lines: [`${s.rows.length} quartiers renseignés sur ${qs.length}${nbMissing ? ` (${nbMissing} sans valeur dans les données)` : ""}.`, `Minimum ${unitStr(ind, s.st.min)} (${top[top.length - 1].q.nom}), maximum ${unitStr(ind, s.st.max)} (${top[0].q.nom}).`] },
      { kind: "calc", lines: [`Moyenne ${unitStr(ind, s.st.mean)} ; médiane ${unitStr(ind, s.st.median)} ; quartiles Q1 ${nf(s.st.q1, ind.d)} · Q3 ${nf(s.st.q3, ind.d)}.`, ...communeBreakdown(ind, qs)] },
      { kind: "interp", lines: inter.length ? inter : ["Pas d'élément d'interprétation supplémentaire dans les données."] },
    ],
    followups: [`Quels quartiers sont les plus élevés pour ${ind.label.toLowerCase()} ?`, `Quels sont les moins élevés ?`, `Explique « ${ind.label} »`],
  };
}

export function ranking(ind: Ind, d: Data, n: number, dir: "top" | "bottom"): Answer {
  const rows = rowsOf(d.quartiers, ind); if (!rows.length) return unavailable(`l'indicateur « ${ind.label} »`);
  const sorted = [...rows].sort((a, b) => (dir === "top" ? b.v - a.v : a.v - b.v)).slice(0, n);
  return {
    title: `${dir === "top" ? "Valeurs les plus élevées" : "Valeurs les plus faibles"} — ${ind.label}`,
    sections: [
      { kind: "obs", lines: [`Classement de ${rows.length} quartiers renseignés (${d.quartiers.length - rows.length} sans valeur).`] },
      { kind: "interp", lines: ind.kind === "acc" || ind.kind === "dens" || ind.kind === "count" ? [dir === "top" ? "Ces quartiers cumulent le plus d'équipements / la meilleure desserte selon cet indicateur." : "Ces quartiers sont les moins équipés / desservis selon cet indicateur : ce sont des cibles possibles pour une analyse plus fine."] : ["Classement relatif : à lire avec la taille et la structure de chaque quartier."] },
    ],
    table: { head: ["#", "Quartier", "Commune", ind.unit], rows: sorted.map((r, i) => [String(i + 1), r.q.nom, communeName(r.q.commune), nf(r.v, ind.d)]) },
    followups: [`Pourquoi ${sorted[0].q.nom} est-il dans ce classement ?`, `Profil de ${sorted[0].q.nom}`],
  };
}

export function quartierProfile(q: Q, d: Data, focus?: Ind | null): Answer {
  const qs = d.quartiers; const lines: string[] = []; const calc: string[] = [];
  const list = focus ? [focus] : [findInd("population")!, findInd("densite_pop")!, findInd("acc_globale")!, findInd("acc_routiere_indice")!, findInd("ind_instruction_0_1")!, findInd("ind_niveau_vie_0_1")!];
  for (const ind of list) {
    const v = ind.get(q); const rows = rowsOf(qs, ind);
    if (v === null || v === undefined) { lines.push(`${ind.label} : non renseigné dans les données.`); continue; }
    const st = computeStats(rows.map(r => r.v)); const rk = rankOf(rows, q.quartier_id); const cl = quartileClass(v, st);
    lines.push(`${ind.label} : ${unitStr(ind, v)}${rk ? ` — rang ${rk.rank}/${rk.of}` : ""}${cl !== null ? `, ${QLAB[cl]}` : ""}.`);
  }
  const head = [`Commune : ${communeName(q.commune)}.`, q.surface_km2 ? `Surface : ${nf(q.surface_km2, 2)} km².` : "Surface : non renseignée.", `Équipements recensés : ${INFRA_FAMILIES.map(f => `${f.label} ${(q as any)[`nb_${f.key}`] ?? 0}`).join(" · ")}.`];
  if (q.classe) calc.push(`Profil de la classification (K-means, 5 classes) : ${q.classe}. ${q.nom_classe}. Clusters LISA — instruction : ${q.LISA_instruction_0_1 ?? "—"}, niveau de vie : ${q.LISA_niveau_vie_0_1_corrige ?? "—"}, offre d'infrastructures : ${q.LISA_offre_infra_0_1 ?? "—"}.`);
  const dc = distCenter(qs, q); if (dc !== null) calc.push(`Distance du centroïde du quartier au barycentre de la population : ${nf(dc, 1)} km (médiane des quartiers : ${nf(median(qs.map(x => distCenter(qs, x)).filter((x): x is number => x !== null)), 1)} km).`);
  return { title: q.nom, sections: [{ kind: "obs", lines: [...head, ...lines] }, ...(calc.length ? [{ kind: "calc" as const, lines: calc }] : [])],
    followups: [`Pourquoi l'accessibilité de ${q.nom} est-elle ${(q.acc_globale ?? 0) < (computeStats(qs.map(x => x.acc_globale).filter((v): v is number => v !== null))?.median ?? 0) ? "faible" : "élevée"} ?`, `Compare ${q.nom} avec un autre quartier`] };
}

export function compareQuartiers(a: Q, b: Q, d: Data): Answer {
  const list = [findInd("population")!, findInd("densite_pop")!, ...INFRA_FAMILIES.map(f => findInd(`dens_${f.key}`)!), findInd("acc_globale")!, findInd("acc_routiere_indice")!, findInd("ind_instruction_0_1")!, findInd("ind_niveau_vie_0_1")!];
  const rows: string[][] = []; let aHigher = 0, bHigher = 0;
  for (const ind of list) {
    const va = ind.get(a), vb = ind.get(b);
    const fa = va === null || va === undefined ? "—" : nf(va, ind.d), fb = vb === null || vb === undefined ? "—" : nf(vb, ind.d);
    rows.push([ind.label, fa, fb]);
    if (va != null && vb != null && va !== vb && ind.kind !== "pop") { if (va > vb) aHigher++; else bHigher++; }
  }
  const dc = (q: Q) => distCenter(d.quartiers, q);
  const da = dc(a), db = dc(b);
  return {
    title: `${a.nom} ↔ ${b.nom}`,
    sections: [
      { kind: "obs", lines: [`${a.nom} : ${communeName(a.commune)} ; ${b.nom} : ${communeName(b.commune)}.`] },
      { kind: "calc", lines: [`Sur les indicateurs comparables (hors population), ${a.nom} est supérieur sur ${aHigher} et ${b.nom} sur ${bHigher}.`, ...(da !== null && db !== null ? [`Distance au barycentre de la population : ${a.nom} ${nf(da, 1)} km, ${b.nom} ${nf(db, 1)} km.`] : [])] },
      { kind: "interp", lines: [aHigher === bHigher ? "Les deux quartiers se distinguent de façon équilibrée selon les indicateurs disponibles." : `${aHigher > bHigher ? a.nom : b.nom} est mieux placé sur la majorité des indicateurs d'équipement, d'accessibilité et socio-économiques disponibles.`, "Cette comparaison décrit des écarts ; elle n'établit pas leurs causes."] },
    ],
    table: { head: ["Indicateur", a.nom, b.nom], rows },
    followups: [`Pourquoi ces différences ?`],
  };
}

export function compareInds(a: Ind, b: Ind, d: Data): Answer {
  const pairs = d.quartiers.map(q => [a.get(q), b.get(q)] as [number | null, number | null]).filter((p): p is [number, number] => p[0] !== null && p[1] !== null && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const r = pearson(pairs.map(p => p[0]), pairs.map(p => p[1]));
  if (r === null) return unavailable(`la corrélation entre « ${a.label} » et « ${b.label} » (pas assez de quartiers renseignés pour les deux)`);
  const sa = computeStats(pairs.map(p => p[0]))!, sb = computeStats(pairs.map(p => p[1]))!;
  let both = 0, bothLow = 0; pairs.forEach(p => { const ca = quartileClass(p[0], sa), cb = quartileClass(p[1], sb); if (ca === 3 && cb === 3) both++; if (ca === 0 && cb === 0) bothLow++; });
  return {
    title: `${a.label} ↔ ${b.label}`,
    sections: [
      { kind: "obs", lines: [`${pairs.length} quartiers renseignés pour les deux indicateurs.`] },
      { kind: "calc", lines: [`Corrélation de Pearson r = ${nf(r, 2)} (${corrWord(r)}).`, `${both} quartiers sont dans le quartile le plus élevé des deux indicateurs ; ${bothLow} dans le plus faible des deux.`] },
      { kind: "interp", lines: [Math.abs(r) >= 0.4 ? `Les deux indicateurs varient ${r > 0 ? "dans le même sens" : "en sens inverse"} d'un quartier à l'autre.` : "Les deux indicateurs sont peu liés à l'échelle des quartiers.", "Une corrélation décrit une association statistique, pas une relation de cause à effet."] },
      { kind: "hyp", lines: ["Un lien observé pourrait venir d'un facteur commun (centralité, ancienneté du quartier, taille) que ces données ne permettent pas d'isoler."] },
    ],
  };
}

export function explainWhy(q: Q, ind: Ind, d: Data): Answer {
  const qs = d.quartiers; const rows = rowsOf(qs, ind); const v = ind.get(q);
  if (v === null || v === undefined) return unavailable(`la valeur de « ${ind.label} » pour ${q.nom}`);
  const st = computeStats(rows.map(r => r.v))!; const rk = rankOf(rows, q.quartier_id)!; const cl = quartileClass(v, st)!;
  const com = rowsOf(inCommune(qs, q.commune), ind); const cm = median(com.map(r => r.v));
  const nb = neighbours(qs, q, 5); const nbVals = nb.map(n => ind.get(n)).filter((x): x is number => x !== null && x !== undefined); const nbMean = nbVals.length ? nbVals.reduce((s, x) => s + x, 0) / nbVals.length : null;
  const obs = [`${q.nom} (${communeName(q.commune)}) : ${ind.label} = ${unitStr(ind, v)}, rang ${rk.rank}/${rk.of}, ${QLAB[cl]}. Médiane de la ville : ${nf(st.median, ind.d)} ; médiane de la commune : ${nf(cm, ind.d)}.`];
  const calc: string[] = []; const facts: string[] = [];
  if (nbMean !== null) { calc.push(`Moyenne des ${nbVals.length} quartiers les plus proches (centroïdes) : ${nf(nbMean, ind.d)} — ${v < nbMean ? "valeur inférieure à son voisinage" : "valeur supérieure à son voisinage"}.`); }
  if (ind.kind === "acc" || ind.kind === "dens" || ind.kind === "count") {
    const lows: string[] = []; const zeros: string[] = [];
    for (const f of INFRA_FAMILIES) {
      const nbv = (q as any)[`nb_${f.key}`] as number; const av = (q as any)[`acc_${f.key}`] as number | null;
      if (nbv === 0) zeros.push(f.label.toLowerCase());
      if (av !== null) { const m = median(qs.map(x => (x as any)[`acc_${f.key}`]).filter((x): x is number => x !== null)); if (av < m) lows.push(f.label.toLowerCase()); }
    }
    if (zeros.length) facts.push(`aucun équipement recensé dans le quartier pour : ${zeros.join(", ")}`);
    if (lows.length) facts.push(`accessibilité inférieure à la médiane de la ville pour ${lows.length} famille(s) sur 8 (${lows.join(", ")})`);
    if (q.acc_routiere_dist_m != null) { const md = median(qs.map(x => x.acc_routiere_dist_m).filter((x): x is number => x !== null)); facts.push(`distance moyenne au réseau routier de ${nf(q.acc_routiere_dist_m, 0)} m (médiane de la ville : ${nf(md, 0)} m)`); }
    if (q.surface_km2 && q.population > 0) { const dd = q.population / q.surface_km2; const md = median(qs.map(x => (x.surface_km2 && x.population > 0 ? x.population / x.surface_km2 : NaN)).filter(Number.isFinite)); facts.push(`densité de population de ${nf(dd, 0)} hab./km² (médiane : ${nf(md, 0)})`); }
    const dcq = distCenter(qs, q);
    if (dcq !== null) {
      const dcAll = qs.map(x => ({ x, dc: distCenter(qs, x), v: ind.get(x) })).filter(o => o.dc !== null && o.v != null) as { x: Q; dc: number; v: number }[];
      const r = pearson(dcAll.map(o => o.v), dcAll.map(o => o.dc));
      calc.push(`Distance au barycentre de la population : ${nf(dcq, 1)} km (médiane des quartiers : ${nf(median(dcAll.map(o => o.dc)), 1)} km).`);
      if (r !== null) calc.push(`Sur l'ensemble des quartiers, corrélation entre « ${ind.label} » et la distance au centre : r = ${nf(r, 2)} (${corrWord(r)}).`);
    }
  }
  const interp: string[] = [];
  if (facts.length) interp.push(`Éléments qui coïncident avec cette valeur : ${facts.join(" ; ")}.`);
  interp.push(cl <= 1 ? "La valeur se situe dans la moitié basse de la distribution des quartiers." : "La valeur se situe dans la moitié haute de la distribution des quartiers.");
  interp.push("Ces éléments décrivent des facteurs associés, ils ne prouvent pas une cause.");
  const hyp = ind.kind === "acc" ? ["Une position périphérique, une urbanisation plus récente ou un réseau de voirie moins dense pourraient jouer, mais ces causes ne sont pas démontrées par les données chargées."] : ["Des facteurs absents des données (ancienneté du quartier, statut foncier, politiques locales) peuvent aussi intervenir."];
  return { title: `Pourquoi ${q.nom} ?`, sections: [{ kind: "obs", lines: obs }, ...(calc.length ? [{ kind: "calc" as const, lines: calc }] : []), { kind: "interp", lines: interp }, { kind: "hyp", lines: hyp }], followups: [`Profil de ${q.nom}`, `Quels quartiers ont la même situation ?`] };
}

export function actionLeads(ind: Ind, d: Data): Answer {
  const qs = d.quartiers; const rows = rowsOf(qs, ind); if (!rows.length) return unavailable(`l'indicateur « ${ind.label} »`);
  const st = computeStats(rows.map(r => r.v))!; const low = rows.filter(r => r.v <= st.q1).sort((a, b) => a.v - b.v);
  const lines: string[] = [`${low.length} quartiers sont dans le quartile le plus faible de « ${ind.label} » (≤ ${nf(st.q1, ind.d)}).`];
  const popLow = low.reduce((s, r) => s + (r.q.population || 0), 0);
  const calc = [`Ces quartiers rassemblent ${nf(popLow, 0)} habitants recensés (${nf((popLow / Math.max(1, qs.reduce((s, q) => s + (q.population || 0), 0))) * 100, 1)} % de la population rattachée).`];
  const byFam = INFRA_FAMILIES.map(f => ({ f, n: low.filter(r => ((r.q as any)[`nb_${f.key}`] ?? 0) === 0).length })).sort((a, b) => b.n - a.n).slice(0, 3);
  const prio = [...low].sort((a, b) => (b.q.population || 0) - (a.q.population || 0)).slice(0, 5);
  return {
    title: `Pistes d'action — ${ind.label}`,
    sections: [
      { kind: "obs", lines },
      { kind: "calc", lines: [...calc, `Familles d'équipements les plus souvent absentes dans ces quartiers : ${byFam.map(x => `${x.f.label.toLowerCase()} (${x.n} quartiers sans équipement)`).join(" ; ")}.`] },
      { kind: "interp", lines: ["Pistes à examiner (hiérarchisées par population concernée) :", `1) Prioriser un diagnostic de terrain dans : ${prio.map(r => `${r.q.nom} (${nf(r.q.population || 0, 0)} hab.)`).join(", ")}.`, `2) Cibler d'abord les familles d'équipements absentes (${byFam.map(x => x.f.label.toLowerCase()).join(", ")}).`, "3) Compléter par des données d'usage (fréquentation, temps d'accès réel) avant tout arbitrage d'investissement."] },
      { kind: "hyp", lines: ["Ces pistes sont des hypothèses de travail déduites des seules données quantitatives ; elles ne remplacent pas une étude de faisabilité."] },
    ],
    table: { head: ["#", "Quartier", "Commune", "Valeur", "Population"], rows: prio.map((r, i) => [String(i + 1), r.q.nom, communeName(r.q.commune), nf(r.v, ind.d), nf(r.q.population || 0, 0)]) },
  };
}

// ---------- resultats valides de la segregation (fichier resultats_indices.json) ----------
type SegInd = { dimension: string; indicateur: string; unite: string; gini: number | null; gini_pond: number | null; theil: number | null; D: number | null; IS: number | string | null; H: number | null; moran: number | null; p: number | null; lisa: string | null };
let RES: { indices: SegInd[]; correlations: any[]; classification: { noms: string[] } } | null = null;
if (typeof window !== "undefined") fetch("/data/resultats_indices.json").then(r => (r.ok ? r.json() : null)).then(j => { RES = j; }).catch(() => {});
const f3 = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
function segSummaryLines(qs: Q[]): string[] {
  const out: string[] = [];
  const by = [1, 2, 3, 4, 5].map(c => qs.filter(q => q.classe === c));
  if (by[0].length) {
    const tot = qs.reduce((s, q) => s + (q.population || 0), 0) || 1;
    out.push(`Classification en 5 profils (K-means validé) : ${by.map((l, i) => `${l[0]?.nom_classe ?? i + 1} — ${l.length} quartiers, ${nf(l.reduce((s, q) => s + (q.population || 0), 0) / tot * 100, 0)} % des habitants`).join(" ; ")}.`);
  }
  const instr = RES?.indices.find(i => i.indicateur.startsWith("Niveau d’instruction"));
  if (instr) out.push(`Instruction : Gini ${f3(instr.gini)} (pondéré ${f3(instr.gini_pond)}), dissimilarité D ${f3(instr.D)}, Moran I ${f3(instr.moran)} (p = ${f3(instr.p)}).`);
  return out.length ? out : ["Les résultats détaillés de la ségrégation sont dans la page Analyse."];
}
const SEG_KEYS: [RegExp, (i: SegInd) => boolean][] = [
  [/instruction|scolaire/, i => i.indicateur.startsWith("Niveau d’instruction")], [/niveau de vie|richesse/, i => i.indicateur.startsWith("Niveau de vie")],
  [/offre|equipement|infrastructure/, i => /Offre d’infrastructures|Densité/.test(i.indicateur)], [/accessib/, i => i.dimension.startsWith("Accessibilité")],
  [/mobilite|flux|attractivite|deplacement/, i => i.dimension === "Mobilité"],
];
export function segregationAnswer(t: string, d: Data, named: Q[]): Answer {
  const qs = d.quartiers;
  if (named.length && /lisa|cluster|classe|profil|typolog|k means|classification/.test(t)) {
    const q = named[0];
    if (!q.classe) return unavailable(`le profil de ${q.nom}`);
    return { title: `${q.nom} — position dans l'analyse de ségrégation`, sections: [
      { kind: "obs", lines: [`Classe K-means : ${q.classe} — ${q.nom_classe}.`, `Clusters LISA — instruction : ${q.LISA_instruction_0_1 ?? "—"} ; niveau de vie : ${q.LISA_niveau_vie_0_1_corrige ?? "—"} ; offre d'infrastructures : ${q.LISA_offre_infra_0_1 ?? "—"} ; accessibilité : ${q.LISA_acces_global_moyen_0_1 ?? "—"}.`] },
      { kind: "interp", lines: ["HH : forte valeur entourée de fortes valeurs ; LL : faible entourée de faibles ; LH / HL : valeur atypique par rapport au voisinage ; NS : non significatif (p < 0,05, 999 permutations)."] }],
      followups: [`Compare ${q.nom} avec un autre quartier`, "Synthèse de la ségrégation"] };
  }
  if (/classification|typolog|k means|kmeans|classe|profils?\b/.test(t)) {
    return { title: "Les 5 profils de quartiers", sections: [{ kind: "obs", lines: segSummaryLines(qs).slice(0, 1) }, { kind: "interp", lines: ["Les classes 1 (résidentiels aisés) et 3 (populaires denses, peu instruits) forment les deux pôles de la ségrégation ; la classe 2 concentre les équipements. Méthode : 9 indicateurs retenus par le test KMO (0,70), ACP (2 axes, 66,8 %), K-means k = 5 (silhouette 0,48), accord de 90 % avec Ward."] }],
      followups: ["Quels sont les quartiers du profil 3 ?", "Gini de l'instruction"] };
  }
  const hit = SEG_KEYS.find(([re]) => re.test(t));
  const list = (RES?.indices ?? []).filter(i => (hit ? hit[1](i) : /Niveau d’instruction|Niveau de vie|Offre d’infrastructures|Accessibilité globale moyenne/.test(i.indicateur))).slice(0, 8);
  if (!list.length) return unavailable("les indices de ségrégation (fichier de résultats non chargé)");
  const rows = list.map(i => [i.indicateur, f3(i.gini), i.theil === null ? "—" : f3(i.theil), i.D === null ? "—" : f3(i.D), f3(i.moran), i.p === null ? "—" : f3(i.p)]);
  return { title: "Indices de ségrégation (résultats validés)", sections: [
    { kind: "obs", lines: ["Valeurs finales validées par l'encadreur, calculées par l'équipe ; affichées telles quelles, non recalculées."] },
    { kind: "interp", lines: ["Gini et Theil : 0 = répartition égale ; D : part du groupe à déplacer pour une répartition identique ; Moran I > 0 : les quartiers voisins se ressemblent (significatif si p < 0,05)."] }],
    table: { head: ["Indicateur", "Gini", "Theil", "D", "Moran I", "p"], rows },
    followups: ["Les 5 profils de quartiers", "Synthèse du territoire"] };
}

export function globalSynthesis(d: Data): Answer {
  const qs = d.quartiers; const pop = qs.reduce((s, q) => s + (q.population || 0), 0); const surf = qs.reduce((s, q) => s + (q.surface_km2 || 0), 0);
  const equip = qs.reduce((s, q) => s + INFRA_FAMILIES.reduce((a, f) => a + (((q as any)[`nb_${f.key}`] as number) || 0), 0), 0);
  const fam = INFRA_FAMILIES.map(f => ({ f, n: qs.reduce((s, q) => s + (((q as any)[`nb_${f.key}`] as number) || 0), 0) })).sort((a, b) => b.n - a.n);
  const miss = qs.filter(q => !(q.population > 0)).length;
  return { title: "Synthèse du territoire", sections: [
    { kind: "obs", lines: [`${qs.length} quartiers répartis en 3 communes (Thiès Nord, Est, Ouest), ${nf(surf, 1)} km² cartographiés.`, `Population recensée RGPH-5 : ${d.census?.population ? nf(d.census.population, 0) : "non chargée"} habitants ; ${nf(pop, 0)} rattachés aux quartiers${miss ? ` (${miss} quartiers sans population appariée)` : ""}.`, `${nf(equip, 0)} équipements recensés dans 8 familles : ${fam.map(x => `${x.f.label.toLowerCase()} ${x.n}`).join(", ")}.`] },
    { kind: "calc", lines: [`Densité moyenne : ${nf(pop / surf, 0)} hab./km² (population rattachée / surface).`, `Famille dominante : ${fam[0].f.label.toLowerCase()} (${nf((fam[0].n / Math.max(1, equip)) * 100, 0)} % des équipements recensés).`] },
    { kind: "calc", lines: segSummaryLines(qs) },
  ], followups: ["Quels quartiers sont les moins bien desservis ?", "Explique le niveau de vie", "Compare Thiès Nord et Thiès Est"] };
}

export function communeSummary(c: string, d: Data, ind?: Ind | null): Answer {
  const qs = inCommune(d.quartiers, c); const pop = qs.reduce((s, q) => s + (q.population || 0), 0); const surf = qs.reduce((s, q) => s + (q.surface_km2 || 0), 0);
  const all = d.quartiers; const popAll = all.reduce((s, q) => s + (q.population || 0), 0);
  const lines: string[] = [`${qs.length} quartiers ; ${nf(surf, 1)} km² ; ${nf(pop, 0)} habitants rattachés (${nf((pop / popAll) * 100, 1)} % du total).`];
  const calc = [`Densité : ${nf(pop / surf, 0)} hab./km².`];
  const inds = ind ? [ind] : [findInd("acc_globale")!, findInd("ind_niveau_vie_0_1")!, findInd("ind_instruction_0_1")!];
  const rows: string[][] = inds.map(i => { const r = rowsOf(qs, i), ra = rowsOf(all, i); return [i.label, r.length ? nf(median(r.map(x => x.v)), i.d) : "—", ra.length ? nf(median(ra.map(x => x.v)), i.d) : "—"]; });
  return { title: communeName(c), sections: [{ kind: "obs", lines }, { kind: "calc", lines: calc }], table: { head: ["Indicateur (médiane)", communeName(c), "Ville"], rows }, followups: [`Compare ${communeName(c)} avec une autre commune`] };
}

export function compareCommunes(a: string, b: string, d: Data): Answer {
  const inds = [findInd("population")!, findInd("densite_pop")!, findInd("acc_globale")!, findInd("ind_niveau_vie_0_1")!, findInd("ind_instruction_0_1")!, findInd("dens_sante")!, findInd("dens_education")!];
  const rows = inds.map(i => { const f = (c: string) => { const r = rowsOf(inCommune(d.quartiers, c), i); if (!r.length) return "—"; return i.id === "population" ? nf(r.reduce((s, x) => s + x.v, 0), 0) : nf(median(r.map(x => x.v)), i.d); }; return [i.id === "population" ? "Population (total)" : `${i.label} (médiane)`, f(a), f(b)]; });
  return { title: `${communeName(a)} ↔ ${communeName(b)}`, sections: [{ kind: "obs", lines: ["Médianes calculées sur les quartiers de chaque commune (hors valeurs manquantes)."] }, { kind: "interp", lines: ["Une médiane résume la situation typique d'un quartier, pas celle de chaque habitant ; des écarts internes aux communes subsistent."] }], table: { head: ["Indicateur", communeName(a), communeName(b)], rows } };
}

export function unavailable(what: string, extra?: string[]): Answer {
  return { title: "Information non disponible", sections: [{ kind: "dispo", lines: [`Cette information n'est pas encore disponible dans les données${what ? ` : ${what}` : ""}.`, ...(extra ?? [])] }],
    followups: ["Que peux-tu analyser ?", "Synthèse du territoire"] };
}

export const HELP: Answer = {
  title: "Assistant Spatial de Thiès",
  sections: [
    { kind: "obs", lines: ["Je réponds uniquement à partir des données chargées dans l'application : 68 quartiers, 3 communes, 8 familles d'équipements, accessibilités (grille 200 m), niveau d'instruction et niveau de vie (ACP), résultats de la ségrégation (indices, LISA, profils), population RGPH-5."] },
    { kind: "interp", lines: ["Je peux : expliquer un indicateur, résumer ses statistiques, classer les quartiers, comparer deux quartiers ou deux indicateurs, interpréter la carte affichée, expliquer pourquoi un quartier a telle valeur et proposer des pistes d'action.", "Je distingue toujours données observées, calculs, interprétation et hypothèses, et je ne donne jamais une valeur qui n'est pas dans les données."] },
  ],
  followups: ["Synthèse du territoire", "Quels quartiers sont les moins bien desservis ?", "Explique le niveau de vie", "Compare Medina Fall et Cite Lamy"],
};

// ---------- analyse de la carte courante ----------
export function analyzeMap(ctx: MapCtx, d: Data): Answer {
  const ind = findInd(ctx.indicatorId);
  if (!ind) return { title: "Carte affichée", sections: [{ kind: "obs", lines: ["Aucun indicateur n'est affiché : seules les limites administratives sont visibles."] }, { kind: "interp", lines: ["Choisissez un indicateur (population, accessibilité, niveau de vie…) pour obtenir une analyse."] }], followups: ["Synthèse du territoire"] };
  const place = ctx.source === "geoportail" ? "Géoportail" : ctx.source === "cartotheque" ? "Cartothèque" : "Tableau de bord";
  const head: string[] = [`Contexte transmis : indicateur « ${ind.label} », couche ${ctx.layer === "grille" ? "grille 200 m" : "quartiers"}, page ${place}.`];
  let sections: Section[];
  if (ctx.layer === "grille") {
    const vals: number[] = d.grid ? d.grid.features.map((f: any) => f.properties[ind.id]).filter((v: any) => typeof v === "number" && Number.isFinite(v)) : [];
    const gs = computeStats(vals);
    if (!gs) return { title: `Analyse de la carte — ${ind.label}`, sections: [{ kind: "obs", lines: head }, { kind: "dispo", lines: ["La grille 200 m n'est pas disponible : je ne peux pas calculer ses statistiques."] }] };
    const by = ["Thies Nord", "Thies Est", "Thies Ouest"].map(c => { const r = rowsOf(inCommune(d.quartiers, c), ind); return r.length ? `${communeName(c)} : médiane des moyennes par quartier ${nf(median(r.map(x => x.v)), ind.d)}` : ""; }).filter(Boolean);
    sections = [
      { kind: "obs", lines: head },
      { kind: "calc", lines: [`Grille 200 m (${vals.length.toLocaleString("fr-FR")} cellules) : min ${nf(gs.min, ind.d)}, Q1 ${nf(gs.q1, ind.d)}, médiane ${nf(gs.median, ind.d)}, Q3 ${nf(gs.q3, ind.d)}, max ${nf(gs.max, ind.d)}, moyenne ${nf(gs.mean, ind.d)}.`, `Les classes de la carte (Q1–Q4) découpent ces ${vals.length.toLocaleString("fr-FR")} cellules en quatre groupes de taille égale.`] },
      { kind: "interp", lines: ["Plus la valeur est élevée, mieux la cellule est desservie (convention de l'application). Les cellules du quartile Q1 correspondent aux zones les moins bien desservies de la grille.", ...(by.length ? [`À titre de repère, valeurs par quartier fournies séparément — ${by.join(" ; ")}.`] : [])] },
      { kind: "dispo", lines: ["Les valeurs de la grille et celles par quartier ne sont pas exprimées sur la même échelle : ne les comparez pas directement."] },
    ];
  } else { sections = [...summarizeInd(ind, d).sections]; sections.unshift({ kind: "obs", lines: head }); }
  const q = ctx.quartierId != null ? d.quartiers.find(x => x.quartier_id === ctx.quartierId) : null;
  let qLine = "";
  if (q) {
    const v = ind.get(q); const rows = rowsOf(d.quartiers, ind);
    if (v != null) { const st = computeStats(rows.map(r => r.v)); const rk = rankOf(rows, q.quartier_id); const cl = quartileClass(v, st);
      qLine = `Quartier sélectionné : ${q.nom} (${communeName(q.commune)}) — valeur moyennée par quartier ${unitStr(ind, v)}, rang ${rk?.rank}/${rk?.of}, ${cl !== null ? QLAB[cl] : "—"}.`; }
    else qLine = `Quartier sélectionné : ${q.nom} — valeur non renseignée pour cet indicateur.`;
  }
  if (q) sections.splice(1, 0, { kind: "obs", lines: [qLine] });
  return { title: `Analyse de la carte — ${ind.label}`, sections, followups: q ? [`Pourquoi ${q.nom} a cette valeur ?`, `Pistes d'action pour ${ind.label.toLowerCase()}`] : [`Pistes d'action pour ${ind.label.toLowerCase()}`, `Quels quartiers sont les plus faibles ?`] };
}

// ---------- routeur d'intentions ----------
const NOT_AVAILABLE = [
  { re: /revenu|salaire|chomage|emploi|criminalite|insecurite|prix|loyer|pollution|temperature|inondation/, what: "cette variable (elle ne figure pas dans les jeux de données chargés)", extra: ["Variables disponibles : population, densités et accessibilité des 8 familles d'équipements, accessibilité routière, niveau d'instruction et niveau de vie (ACP)."] },
  { re: /evolution|tendance|prevision|projection|avant 20|depuis 20|2010|2015|2020|2030|futur/, what: "les évolutions dans le temps, sauf pour la population historique (voir la page Histoire)", extra: ["Les couches d'équipements et d'accessibilité n'ont pas d'année précisée : aucune évolution ne peut être calculée."] },
];

export function answer(textRaw: string, d: Data, mem: Memory, ctx: MapCtx | null): { a: Answer; mem: Memory } {
  const qs = d.quartiers; const t = canon(correct(canon(norm(textRaw)), qs)); let m: Memory = { ...mem };
  if (!t) return { a: HELP, mem: m };
  if (/^(bonjour|salut|bonsoir|hello|coucou|aide|help)\b|que peux|que sais|comment (ca )?marche|tu peux faire|fonctionnalit/.test(t)) return { a: HELP, mem: m };

  const na = NOT_AVAILABLE.find(x => x.re.test(t));
  const inds = detectAllInds(t); let ind: Ind | null = inds[0] ?? null;
  const here = /cette zone|ce quartier|ici|cet endroit|ce secteur/.test(t);
  let named = findQuartiers(t, qs);
  if (!named.length && here && ctx?.quartierId != null) { const cq = qs.find(q => q.quartier_id === ctx.quartierId); if (cq) named = [cq]; }
  const pronoun = /\b(son|sa|ses|lui|il|elle|meme|ce dernier)\b/.test(t);
  if (!named.length && pronoun && m.quartierId != null) { const mq = qs.find(q => q.quartier_id === m.quartierId); if (mq) named = [mq]; }
  if (!ind && ctx && /cette carte|carte affichee|cet indicateur|la carte/.test(t)) ind = findInd(ctx.indicatorId) ?? null;
  if (!ind && m.indId && /\b(et|aussi|meme|pareil)\b/.test(t) === false && (here || pronoun)) ind = findInd(m.indId) ?? null;

  if (/segregation|dissimilar|gini|theil|moran|\blisa\b|entropie|autocorrelation|cluster|typolog|k means|kmeans|classification|quelle classe|quel profil|indice de segregation|profils? de quartiers?|(5|cinq) profils?|profils? types?|\bclass(e|es|er) (de|du|d) /.test(t)) { if (named[0]) m.quartierId = named[0].quartier_id; return { a: segregationAnswer(t, d, named), mem: m }; }
  if (na) return { a: unavailable(na.what, na.extra), mem: m };

  const remember = (q?: Q | null, i?: Ind | null) => { if (q) m.quartierId = q.quartier_id; if (i) m.indId = i.id; };
  const communes = (() => { const out: string[] = []; for (const c of ["Thies Nord", "Thies Est", "Thies Ouest"]) { const re = c === "Thies Nord" ? /thies nord|\bnord\b/ : c === "Thies Ouest" ? /thies ouest|\bouest\b/ : /thies est|commune est\b/; if (re.test(t)) out.push(c); } return out; })();
  const wantCompare = /compar|versus|\bvs\b|difference|differ|oppos|contraste|ecart/.test(t);
  const n = Number((t.match(/\b(\d{1,2})\b/) || [])[1]) || 5;

  if (/analys\w* (cette |la )?carte|interpret\w* (cette |la )?carte|que montre (cette |la )carte|lis cette carte/.test(t) && ctx) { remember(null, findInd(ctx.indicatorId)); return { a: analyzeMap(ctx, d), mem: m }; }
  if (/combien|nombre d|total d/.test(t) && ind && (ind.kind === "count" || ind.kind === "dens") && ind.fam) {
    const ci = findInd(`nb_${ind.fam}`)!; const fam = INFRA_FAMILIES.find(f => f.key === ind!.fam)!;
    const sum = (list: Q[]) => list.reduce((a, q) => a + (ci.get(q) ?? 0), 0);
    remember(named[0], ci);
    if (named.length) return { a: { title: `${fam.label} — ${named[0].nom}`, sections: [{ kind: "obs", lines: [`${named[0].nom} : ${nf(ci.get(named[0]) ?? 0, 0)} équipement(s) de la famille ${fam.label.toLowerCase()} recensé(s).`] }] }, mem: m };
    const cs = communes.length ? communes : ["Thies Nord", "Thies Est", "Thies Ouest"];
    return { a: { title: `${fam.label} — nombre d'équipements`, sections: [{ kind: "obs", lines: [communes.length ? "" : `Total sur les 68 quartiers : ${nf(sum(qs), 0)} équipement(s) ${fam.label.toLowerCase()}.`, ...cs.map(c => `${communeName(c)} : ${nf(sum(inCommune(qs, c)), 0)}.`)].filter(Boolean) }, { kind: "interp", lines: ["Ce sont des comptes d'équipements recensés dans les couches de l'application, pas une mesure de leur capacité ni de leur qualité."] }], followups: [`Quels quartiers ont le plus d'équipements ${fam.label.toLowerCase()} ?`] }, mem: m };
  }
  if (/ou sont|ou se trouv|localis|repartition|reparti/.test(t) && ind && !named.length) { remember(null, ind); return { a: ranking(ind.kind === "acc" ? ind : (ind.fam ? findInd(`nb_${ind.fam}`)! : ind), d, Math.min(n, 10), "top"), mem: m }; }
  if (named.length >= 2 && (wantCompare || /\bet\b|\bavec\b/.test(t)) && !/pourquoi/.test(t)) { remember(named[1]); return { a: compareQuartiers(named[0], named[1], d), mem: m }; }
  if (communes.length >= 2 && wantCompare) return { a: compareCommunes(communes[0], communes[1], d), mem: m };
  if (inds.length >= 2 && /compar|correl|lien|relation|rapport|associ|influence|depend|va de pair/.test(t)) { remember(null, inds[0]); return { a: compareInds(inds[0], inds[1], d), mem: m }; }

  if (/pourquoi|explique\w* (la |cette )?(difference|valeur|situation)|cause|raison|comment (se fait|expliquer)/.test(t)) {
    const q = named[0]; const i = ind ?? (ctx ? findInd(ctx.indicatorId) : null) ?? (m.indId ? findInd(m.indId) : null) ?? findInd("acc_globale")!;
    if (q) { remember(q, i); return { a: explainWhy(q, i, d), mem: m }; }
    if (i) { remember(null, i); return { a: summarizeInd(i, d), mem: m }; }
  }
  if (/piste|action|recommand|prioris|ameliorer|que faire|intervenir|investir|politique/.test(t)) { const i = ind ?? (ctx ? findInd(ctx.indicatorId) : null) ?? findInd("acc_globale")!; remember(null, i); return { a: actionLeads(i, d), mem: m }; }
  if (/c est quoi|qu est ce|definition|signifi|explique|expliquer|comment (est|sont) (calcul|mesur)|que mesure|interpretation|comprendre/.test(t) && ind && !named.length) { remember(null, ind); return { a: explainInd(ind, d), mem: m }; }
  if (/(plus|moins|top|classement|meilleur|pire|mieux|mal|faible|eleve|fort|haut|bas|premier|dernier)/.test(t) && /quartier|zone|classement|top|lesquels|quel/.test(t) && (ind || !named.length)) {
    const i = ind ?? (ctx ? findInd(ctx.indicatorId) : null) ?? (/peupl/.test(t) ? findInd("population") : null) ?? findInd("acc_globale")!;
    const bottom = /moins|pire|mal |faible|bas|dernier|defavoris|sous|pauvre/.test(t) && !/moins de [a-z]+ (habitant|equip)|plus peupl/.test(t); remember(null, i);
    return { a: ranking(i, d, Math.min(n, 15), bottom ? "bottom" : "top"), mem: m };
  }
  if (named.length && !communes.length || named.length) { const q = named[0]; remember(q, ind); return { a: quartierProfile(q, d, ind), mem: m }; }
  if (communes.length === 1) { remember(null, ind); return { a: communeSummary(communes[0], d, ind), mem: m }; }
  if (/synthese|resume|bilan|vue d ensemble|statistique|chiffres cles|territoire/.test(t) && !ind) return { a: globalSynthesis(d), mem: m };
  if (ind) { remember(null, ind); return { a: summarizeInd(ind, d), mem: m }; }
  return { a: { ...unavailable("je n'ai pas reconnu de quartier, d'indicateur ou de commune dans votre question", ["Essayez par exemple : « population de Medina Fall », « quartiers les moins bien desservis », « compare Cite Lamy et Hersent »."]), unrecognized: true }, mem: m };
}
