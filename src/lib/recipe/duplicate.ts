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

/** Ziet dit recept eruit als eentje die er al staat? */
export function findDuplicate(
  candidate: { sourceUrl: string | null; title: string | null },
  existing: Array<{ id: string; title: string; sourceUrl: string | null }>,
): { id: string; title: string; reason: "bron" | "titel" } | null {
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

  return null;
}
