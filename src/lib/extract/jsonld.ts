import type * as cheerio from "cheerio";

type Json = unknown;

/**
 * Zoekt een schema.org/Recipe-blok in de pagina. De meeste receptensites —
 * inclusief AH Allerhande — publiceren dit, en het is veel betrouwbaarder dan
 * de HTML eromheen. We geven het ruwe object terug; het model maakt er
 * vervolgens onze eigen structuur van.
 */
export function findRecipeJsonLd($: cheerio.CheerioAPI): Json | null {
  const blocks: Json[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).text();
    if (!raw.trim()) return;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Kapotte JSON-LD komt vaker voor dan je zou hopen; gewoon overslaan.
    }
  });

  for (const block of blocks) {
    const found = searchForRecipe(block, 0);
    if (found) return found;
  }
  return null;
}

function searchForRecipe(node: Json, depth: number): Json | null {
  if (depth > 6 || node === null || typeof node !== "object") return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = searchForRecipe(child, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = node as Record<string, Json>;

  if (isRecipeType(record["@type"])) {
    return record;
  }

  // @graph is de gebruikelijke plek waar WordPress/Yoast het recept verstopt.
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    if (key in record) {
      const found = searchForRecipe(record[key], depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function isRecipeType(type: Json): boolean {
  if (typeof type === "string") return type.toLowerCase().endsWith("recipe");
  if (Array.isArray(type)) return type.some(isRecipeType);
  return false;
}

/**
 * Knipt de velden die we niet nodig hebben weg (reviews, breadcrumbs, video's)
 * zodat we geen tienduizenden tokens aan ballast meesturen.
 */
const KEEP = new Set([
  "name",
  "description",
  "recipeYield",
  "prepTime",
  "cookTime",
  "totalTime",
  "recipeIngredient",
  "ingredients",
  "recipeInstructions",
  "recipeCategory",
  "recipeCuisine",
  "keywords",
  "author",
  "image",
  "nutrition",
]);

export function compactRecipeJsonLd(recipe: Json): string {
  if (recipe === null || typeof recipe !== "object") return "";
  const record = recipe as Record<string, Json>;
  const trimmed: Record<string, Json> = {};
  for (const [key, value] of Object.entries(record)) {
    if (KEEP.has(key)) trimmed[key] = value;
  }
  return JSON.stringify(trimmed, null, 2).slice(0, 30_000);
}
