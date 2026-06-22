// =============================================================================
//  MedPulse — Script de récupération des candidats (PubMed + RSS)
// =============================================================================
//
//  RÔLE : ce script va chercher la "matière brute" (articles récents + items RSS)
//         et l'écrit dans  candidates.json.  Il NE touche JAMAIS  ../data/*.json
//         (ce sont tes brèves rédigées — protégées).
//
//  USAGE :  node medpulse/tools/fetch.mjs
//
//  AUCUNE dépendance : Node pur (fetch + parsing maison). Pas de npm install.
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL(".", import.meta.url);
const cfg = JSON.parse(readFileSync(new URL("./sources.json", ROOT), "utf8"));

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Outils dates ─────────────────────────────────────────────────────────────
const today = new Date();
const past = new Date(today);
past.setDate(today.getDate() - cfg.fenetre_jours);
const fmtPubmed = (d) =>
  `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const fmtISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dateRange = `("${fmtPubmed(past)}"[EDAT] : "${fmtPubmed(today)}"[EDAT])`;

// ── Décodage minimal des entités XML/HTML ────────────────────────────────────
function decode(s) {
  return s
    .replace(/<[^>]+>/g, "")           // supprime les balises (<i>, <sup>, …)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

// ── PubMed : recherche (esearch) → liste de PMID ─────────────────────────────
async function esearch(term, label) {
  const url = `${EUTILS}/esearch.fcgi?db=pubmed&retmax=200&retmode=json&term=${encodeURIComponent(term)}`;
  const data = await (await fetch(url)).json();
  const ids = data.esearchresult?.idlist ?? [];
  console.log(`  • ${label} : ${ids.length} résultat(s)`);
  await sleep(400); // courtoisie envers l'API NCBI (max ~3 req/s)
  return ids;
}

// ── PubMed : détails (efetch) → objets article ───────────────────────────────
async function efetch(pmids) {
  const out = [];
  for (let i = 0; i < pmids.length; i += 50) {
    const batch = pmids.slice(i, i + 50);
    const url = `${EUTILS}/efetch.fcgi?db=pubmed&id=${batch.join(",")}&retmode=xml`;
    const xml = await (await fetch(url)).text();
    for (const block of xml.split("<PubmedArticle>").slice(1)) {
      out.push(parseArticle(block));
    }
    await sleep(400);
  }
  return out;
}

function parseArticle(a) {
  const get = (tag) => {
    const m = a.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? decode(m[1]) : "";
  };
  const pmid = (a.match(/<PMID[^>]*>(\d+)<\/PMID>/) || [])[1] || "";
  const title = get("ArticleTitle");
  const journal = get("ISOAbbreviation");

  // Abstract structuré : concatène toutes les sections
  const absParts = [...a.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => decode(m[1]));
  const abstract = absParts.join(" ");

  // Types de publication (pour repérer Meta-Analysis, Review, Guideline…)
  const pubTypes = [...a.matchAll(/<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g)].map((m) => decode(m[1]));

  // DOI éventuel
  const doi = (a.match(/<ELocationID[^>]*EIdType="doi"[^>]*>([\s\S]*?)<\/ELocationID>/) || [])[1] || "";

  // Date : ArticleDate (epub, date de mise en ligne) en priorité — cohérence avec [EDAT] de la requête
  // Sinon PubDate (date de l'issue). Ainsi un article mis en ligne en mars → affiché mars.
  let y = "", mo = "", d = "";
  const ad = a.match(/<ArticleDate[^>]*>([\s\S]*?)<\/ArticleDate>/);
  const pd = a.match(/<PubDate>([\s\S]*?)<\/PubDate>/);
  const src = ad ? ad[1] : (pd ? pd[1] : "");
  y = (src.match(/<Year>(\d+)<\/Year>/) || [])[1] || "";
  mo = (src.match(/<Month>(\w+)<\/Month>/) || [])[1] || "";
  d = (src.match(/<Day>(\d+)<\/Day>/) || [])[1] || "";
  const MONTHS = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
  const moNum = MONTHS[mo.slice(0,3)] || parseInt(mo, 10) || 1;
  const date = y ? `${y}-${String(moNum).padStart(2,"0")}-${String(parseInt(d,10)||1).padStart(2,"0")}` : "";

  const estMetaOuSystematique = pubTypes.some((t) => /meta-analysis|systematic review|network meta/i.test(t));
  const estReviewPure = pubTypes.some((t) => /^review$/i.test(t)) && !estMetaOuSystematique;
  const estPhaseI = pubTypes.some((t) => /phase i$/i.test(t));

  return {
    pmid,
    titre: title,
    journal,
    date,
    abstract,
    abstract_vide: abstract.length === 0,
    types: pubTypes,
    est_meta_analyse: pubTypes.some((t) => /meta-analysis/i.test(t)),
    // Règles de tri automatique :
    //  • exclure = true  → Phase I (trop précoce pour la pratique)
    //  • section_suggeree → "mise_au_point" pour les Review pures, "etude" pour tout le reste
    exclure: estPhaseI,
    section_suggeree: estReviewPure ? "mise_au_point" : "etude",
    source_nom: "PubMed",
    source_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    doi: doi || null,
  };
}

// ── RSS : parsing de date ────────────────────────────────────────────────────
// cardiologie-pratique publie au format "mar 26/05/2026 - 12:00" (JJ/MM/AAAA).
// On essaie d'abord ce format, sinon on retombe sur Date() standard (RFC-822).
function parseRssDate(s) {
  if (!s) return "";
  const fr = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  const d = new Date(s);
  return isNaN(d) ? "" : fmtISO(d);
}

// ── RSS : récupération + parsing maison ──────────────────────────────────────
async function fetchRss(feed) {
  try {
    const xml = await (await fetch(feed.url)).text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    const parsed = items.map((it) => {
      const pick = (tag) => {
        const m = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        if (!m) return "";
        // gère <![CDATA[ ... ]]>
        return decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
      };
      const pubDate = pick("pubDate");
      const iso = parseRssDate(pubDate);
      return {
        titre: pick("title"),
        resume: pick("description"),
        date: iso,
        auteur: pick("dc:creator") || pick("author"),
        source_nom: feed.nom,
        source_url: pick("link"),
        role: feed.role,
      };
    });
    // garde uniquement les items dans la fenêtre temporelle (si date connue)
    const recents = parsed.filter((p) => !p.date || p.date >= fmtISO(past));
    console.log(`  • ${feed.nom} : ${parsed.length} item(s), ${recents.length} récent(s)`);
    await sleep(300);
    return recents;
  } catch (e) {
    console.log(`  ⚠️  ${feed.nom} : échec (${e.message})`);
    return [];
  }
}

// ── Programme principal ──────────────────────────────────────────────────────
async function main() {
  console.log(`\n📡 MedPulse — récupération du ${fmtISO(past)} au ${fmtISO(today)} (${cfg.fenetre_jours} jours)\n`);

  const p = cfg.pubmed;

  console.log("PubMed :");
  // 1) Revues cardio-spécifiques → tout
  const qCardio = `(${p.revues_cardio.map((j) => `"${j}"[TA]`).join(" OR ")}) AND ${dateRange}`;
  // 2) Revues généralistes → seulement le cardio
  const qGen = `(${p.revues_generalistes.map((j) => `"${j}"[TA]`).join(" OR ")}) AND ${p.filtre_cardio_generalistes} AND ${dateRange}`;
  // 3) Méta-analyses : whitelist + Cochrane uniquement (pas de recherche tous-journaux)
  const toutesRevues = [...p.revues_cardio, ...p.revues_generalistes, ...(p.revues_meta_analyses_extra || [])];
  const qMeta = `"meta-analysis"[PT] AND (${toutesRevues.map((j) => `"${j}"[TA]`).join(" OR ")}) AND ${dateRange}`;

  const ids = new Set();
  (await esearch(qCardio, "Revues cardio")).forEach((id) => ids.add(id));
  (await esearch(qGen, "Revues généralistes (cardio)")).forEach((id) => ids.add(id));
  if (p.inclure_meta_analyses_cardio) {
    (await esearch(qMeta, "Méta-analyses cardio")).forEach((id) => ids.add(id));
  }
  console.log(`  → ${ids.size} article(s) unique(s) à détailler`);

  const articles = ids.size ? await efetch([...ids]) : [];

  console.log("\nFlux RSS :");
  const rss = [];
  for (const feed of cfg.rss) rss.push(...(await fetchRss(feed)));

  const sortie = {
    genere_le: new Date().toISOString(),
    fenetre: { du: fmtISO(past), au: fmtISO(today), jours: cfg.fenetre_jours },
    pubmed: articles.sort((a, b) => (b.date < a.date ? -1 : 1)),
    rss,
  };
  writeFileSync(new URL("./candidates.json", ROOT), JSON.stringify(sortie, null, 2), "utf8");

  console.log(`\n✅ Terminé : ${articles.length} article(s) PubMed + ${rss.length} item(s) RSS`);
  console.log(`   → écrit dans medpulse/tools/candidates.json`);
  console.log(`   Étape suivante : demander à Claude de rédiger les brèves.\n`);
}

main().catch((e) => {
  console.error("\n❌ Erreur :", e.message, "\n");
  process.exit(1);
});
