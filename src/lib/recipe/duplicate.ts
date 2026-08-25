/**
 * Herkennen dat je dit recept al hebt.
 *
 * Twee mensen die allebei door dezelfde tijdlijn scrollen delen vroeg of laat
 * hetzelfde gerecht, en dan staat het er twee keer — met twee keer een
 * modelaanroep ervoor. Twee signalen zijn genoeg om dat te zien: dezelfde
 * bron-URL, of dezelfde titel.
 *
 * De URL-controle kan vóór de modelaanroep, dus die scheelt ook geld. De
 * titelcontrole kan pas erna: de titel komt uit het model.
 */

/**
 * Twee adressen naar hetzelfde recept moeten dezelfde tekenreeks opleveren.
 *
 * Wat eraf gaat: het schema, `www.`, de afsluitende slash, de fragmentnaam en
 * alle meelifterparameters die sociale media aan een gedeelde link plakken.
 * Wat blijft staan zijn parameters die er wél toe doen — sommige sites zetten
 * hun recept-id in `?p=123`.
 */
const TRACKING = /^(utm_|fbclid$|gclid$|igshid$|igsh$|si$|ref$|ref_src$|share_id$|mc_cid$|mc_eid$)/i;

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.host.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING.test(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);

  return `${host}${path}${params.length > 0 ? `?${params.join("&")}` : ""}`;
}

/**
 * Titels vergelijken zoals een mens ze zou vergelijken.
 *
 * Accenten en leestekens zeggen niets over de inhoud, dus die gaan eraf. Ook
 * de spaties: Nederlands plakt woorden aan elkaar en niet iedereen doet dat
 * hetzelfde, dus "truffel-roomsaus", "truffel roomsaus" en "truffelroomsaus"
 * moeten allemaal op hetzelfde uitkomen. Twee verschillende gerechten die ná
 * het weglaten van de spaties tóch gelijk zijn, bestaan in de praktijk niet.
 */
export function normalizeTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const clean = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  // Eén woord van twee letters is geen titel om conclusies aan te verbinden.
  return clean.length >= 3 ? clean : null;
}

/**
 * Twee titels die op elkaar lijken.
 *
 * Bron en exacte titel vangen de gemakkelijke gevallen: dezelfde link, of twee
 * keer letterlijk "Shakshuka met feta". Wat er doorheen glipt is dezelfde
 * shakshuka van twee sites, met "Shakshuka met feta en munt" en "Snelle
 * shakshuka" als titel.
 *
 * De maat is hoeveel woorden ze delen, gedeeld door de kortste van de twee.
 * Bewust niet het langste: "shakshuka" en "shakshuka met feta en munt" delen
 * één woord op vijf, maar dat ene woord ís het gerecht.
 */
export function titelGelijkenis(a: string, b: string): number {
  const woordenA = new Set(betekenisvolleWoorden(a));
  const woordenB = new Set(betekenisvolleWoorden(b));
  if (woordenA.size === 0 || woordenB.size === 0) return 0;

  let gedeeld = 0;
  for (const woord of woordenA) if (woordenB.has(woord)) gedeeld += 1;

  return gedeeld / Math.min(woordenA.size, woordenB.size);
}

/**
 * Woorden die iets zeggen over wát het gerecht is.
 *
 * "Snelle pasta" en "Snelle curry" delen "snelle", en dat is geen gerecht maar
 * een belofte. Zonder deze lijst zou elk paar receptnamen dat met "makkelijke"
 * begint als bijna-dubbel gelden.
 */
const LEEG_WOORD = new Set([
  "de", "het", "een", "en", "met", "van", "in", "op", "uit", "voor", "zonder",
  "snelle", "snel", "makkelijke", "makkelijk", "simpele", "simpel", "lekkere",
  "lekker", "beste", "perfecte", "romige", "romig", "klassieke", "echte",
  "zelfgemaakte", "recept", "mijn", "onze",
]);

function betekenisvolleWoorden(titel: string): string[] {
  return titel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((woord) => woord.length >= 3 && !LEEG_WOORD.has(woord));
}

/**
 * Vanaf hier noemen we het een bijna-dubbel.
 *
 * Hoog gezet, en dat is met opzet. Een vals duplicaat is duurder dan een
 * gemiste: het gerecht belandt in de inbox onder "heb je al" en wordt niet
 * uitgeschreven, dus je raakt een recept kwijt dat je wilde bewaren. Een
 * gemiste kost hooguit een dubbele regel in het overzicht.
 */
const LIJKT_EROP = 0.8;

/**
 * En hoeveel ingrediënten ze dan ook nog moeten delen.
 *
 * Twee voorwaarden en niet één: "Pasta met tomatensaus" en "Pasta met
 * pestosaus" delen twee van de drie woorden, maar het is niet hetzelfde
 * gerecht. Dat zie je pas aan de ingrediënten.
 */
const GENOEG_OVERLAP = 0.6;

export function ingredientOverlap(
  a: readonly string[],
  b: readonly string[],
): number {
  const setA = new Set(a.map((n) => n.toLowerCase().trim()).filter(Boolean));
  const setB = new Set(b.map((n) => n.toLowerCase().trim()).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;

  let gedeeld = 0;
  for (const naam of setA) if (setB.has(naam)) gedeeld += 1;

  return gedeeld / Math.min(setA.size, setB.size);
}

/** Ziet dit recept eruit als eentje die er al staat? */
export function findDuplicate(
  candidate: {
    sourceUrl: string | null;
    title: string | null;
    /** Genormaliseerde ingrediëntnamen; nodig voor de bijna-dubbelen. */
    ingredienten?: readonly string[];
  },
  existing: Array<{
    id: string;
    title: string;
    sourceUrl: string | null;
    ingredienten?: readonly string[];
  }>,
): { id: string; title: string; reason: "bron" | "titel" | "lijkt" } | null {
  const url = normalizeUrl(candidate.sourceUrl);
  if (url) {
    const match = existing.find((row) => normalizeUrl(row.sourceUrl) === url);
    // Dezelfde bron is het sterkste signaal: dan is het letterlijk dezelfde
    // pagina, hoe het gerecht ook heet.
    if (match) return { id: match.id, title: match.title, reason: "bron" };
  }

  const title = normalizeTitle(candidate.title);
  if (title) {
    const match = existing.find((row) => normalizeTitle(row.title) === title);
    if (match) return { id: match.id, title: match.title, reason: "titel" };
  }

  // Bijna hetzelfde: een titel die er sterk op lijkt én een ingrediëntenlijst
  // die grotendeels overlapt. Allebei nodig — zie de opmerkingen bij de
  // grenswaarden voor waarom één van de twee te weinig is.
  if (candidate.title && candidate.ingredienten && candidate.ingredienten.length > 0) {
    for (const row of existing) {
      if (!row.ingredienten || row.ingredienten.length === 0) continue;
      if (titelGelijkenis(candidate.title, row.title) < LIJKT_EROP) continue;
      if (ingredientOverlap(candidate.ingredienten, row.ingredienten) < GENOEG_OVERLAP) {
        continue;
      }
      return { id: row.id, title: row.title, reason: "lijkt" };
    }
  }

  return null;
}
