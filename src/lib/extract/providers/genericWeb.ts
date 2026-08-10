import { browserEnabled, renderPage } from "../browser";
import { fetchPage } from "../fetchPage";
import {
  parseHtml,
  readMeta,
  readMicrodataRecipe,
  readableText,
} from "../html";
import { compactRecipeJsonLd, findRecipeJsonLd } from "../jsonld";
import {
  MIN_USEFUL_CHARS,
  type Note,
  type Provider,
  type SourceDocument,
} from "../types";

/**
 * De strategie voor gewone webpagina's: AH Allerhande, receptenblogs, kranten.
 *
 * Zoekt in volgorde van betrouwbaarheid naar gestructureerde data en valt
 * terug op de paginatekst. Levert dat te weinig op en staat de browser-fallback
 * aan, dan wordt de pagina nog een keer gerenderd met JavaScript.
 */
export const genericWebProvider: Provider = {
  name: "web",

  canHandle() {
    return true;
  },

  async run(url, _sharedText, note) {
    const target = url.toString();

    let html: string | null = null;
    let finalUrl = target;
    let via = "web";

    try {
      const page = await fetchPage(target);
      html = page.html;
      finalUrl = page.url;
      via = `web-${page.via}`;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      note({ strategy: "web-fetch", ok: false, detail });
      // Ophalen mislukt. Een browser komt soms wél binnen waar fetch stukloopt,
      // dus dit is nog geen eindstation.
      if (!browserEnabled()) throw error;
    }

    let document = html ? buildDocument(html, finalUrl, via) : null;
    if (document) return document;

    if (html) {
      note({
        strategy: via,
        ok: false,
        detail: "te weinig bruikbare tekst in de HTML",
      });
    }

    if (!browserEnabled()) return null;

    const rendered = await renderPage(target);
    if (!rendered.ok) {
      note({ strategy: "web-browser", ok: false, detail: rendered.reason });
      return null;
    }

    document = buildDocument(rendered.html, rendered.url, "web-browser");
    if (!document) {
      note({
        strategy: "web-browser",
        ok: false,
        detail: "ook na renderen te weinig tekst",
      });
    }
    return document;
  },
};

function buildDocument(
  html: string,
  url: string,
  strategy: string,
): SourceDocument | null {
  const $ = parseHtml(html);
  const meta = readMeta($);
  const parts: string[] = [];

  const jsonLd = findRecipeJsonLd($);
  const microdata = jsonLd ? null : readMicrodataRecipe($);

  if (jsonLd) {
    parts.push(
      `# schema.org/Recipe uit de bron (betrouwbaarste data)\n${compactRecipeJsonLd(jsonLd)}`,
    );
  } else if (microdata) {
    parts.push(
      `# schema.org/Recipe uit microdata (betrouwbaarste data)\n${microdata}`,
    );
  }

  const body = readableText($);
  if (body) parts.push(`# Paginatekst\n${body}`);

  const text = parts.join("\n\n---\n\n").trim();
  if (text.length < MIN_USEFUL_CHARS) return null;

  // Dat de bron gestructureerde data leverde is het vermelden waard in het
  // spoor: dan weet je dat het recept niet uit losse paginatekst is geraden.
  const suffix = jsonLd ? "+jsonld" : microdata ? "+microdata" : "";

  return { strategy: `${strategy}${suffix}`, text, meta, canonicalUrl: url };
}
