import * as cheerio from "cheerio";
import type { PageMeta } from "./types";

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

export function parseHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

export function readMeta($: cheerio.CheerioAPI): PageMeta {
  const meta = (selector: string) => {
    const value = $(selector).attr("content")?.trim();
    return value && value.length > 0 ? value : null;
  };
  const title =
    meta("meta[property='og:title']") ??
    meta("meta[name='twitter:title']") ??
    $("title").first().text().trim();

  return {
    title: title && title.length > 0 ? title : null,
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

  return raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    // Meer dan twee lege regels achter elkaar draagt niets bij.
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, MAX_TEXT_CHARS);
}

/**
 * schema.org-recepten in microdata-vorm (itemprop-attributen in de HTML) in
 * plaats van JSON-LD. Oudere WordPress-receptenplugins doen het zo, en dan is
 * dit veel betrouwbaarder dan de paginatekst eromheen.
 */
export function readMicrodataRecipe($: cheerio.CheerioAPI): string | null {
  const scope = $("[itemtype*='schema.org/Recipe' i]").first();
  if (scope.length === 0) return null;

  const values = (prop: string): string[] => {
    const found: string[] = [];
    scope.find(`[itemprop='${prop}' i]`).each((_, element) => {
      const $el = $(element);
      const value =
        $el.attr("content") ??
        $el.attr("datetime") ??
        $el.attr("value") ??
        $el.text();
      const cleaned = value?.replace(/\s+/g, " ").trim();
      if (cleaned) found.push(cleaned);
    });
    return found;
  };

  const single = (prop: string): string | null => values(prop)[0] ?? null;

  const recipe = {
    name: single("name"),
    recipeYield: single("recipeYield"),
    prepTime: single("prepTime"),
    cookTime: single("cookTime"),
    totalTime: single("totalTime"),
    recipeIngredient: [...values("recipeIngredient"), ...values("ingredients")],
    recipeInstructions: values("recipeInstructions"),
  };

  // Zonder ingrediënten voegt dit niets toe boven de paginatekst.
  if (recipe.recipeIngredient.length === 0) return null;

  return JSON.stringify(recipe, null, 2).slice(0, 30_000);
}
