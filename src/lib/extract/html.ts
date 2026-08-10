import * as cheerio from "cheerio";

const MAX_TEXT_CHARS = 40_000;

/** Ruis die nooit deel van een recept is. */
const NOISE = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "nav",
  "header",
  "footer",
  "form",
  "aside",
  "[aria-hidden='true']",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
].join(",");

export type PageMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

export function readMeta($: cheerio.CheerioAPI): PageMeta {
  const meta = (selector: string) => {
    const value = $(selector).attr("content")?.trim();
    return value && value.length > 0 ? value : null;
  };
  return {
    title:
      meta("meta[property='og:title']") ??
      meta("meta[name='twitter:title']") ??
      $("title").first().text().trim() ??
      null,
    description:
      meta("meta[property='og:description']") ??
      meta("meta[name='twitter:description']") ??
      meta("meta[name='description']"),
    imageUrl:
      meta("meta[property='og:image']") ?? meta("meta[name='twitter:image']"),
    siteName: meta("meta[property='og:site_name']"),
  };
}

/**
 * Platte, leesbare tekst uit de pagina. Geen echte readability-implementatie —
 * het model kan prima door wat navigatieresten heen kijken, en dit scheelt een
 * afhankelijkheid. Wel behouden we regeleindes, want die dragen structuur.
 */
export function readableText($: cheerio.CheerioAPI): string {
  // Op een kopie werken zodat readMeta/findRecipeJsonLd hierna nog de
  // oorspronkelijke <head> en <script>-tags kunnen lezen.
  const $clone = $.root().clone();
  $clone.find(NOISE).remove();

  // Blokelementen krijgen een harde regelovergang zodat lijstjes met
  // ingrediënten niet aan elkaar plakken.
  $clone.find("li,p,br,div,tr,h1,h2,h3,h4,h5,h6").append("\n");

  const $body = $clone.find("body");
  const raw = $body.length > 0 ? $body.text() : $clone.text();
  const cleaned = raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    // Meer dan twee lege regels achter elkaar draagt niets bij.
    .replace(/\n{3,}/g, "\n\n");

  return cleaned.slice(0, MAX_TEXT_CHARS);
}

export function parseHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}
