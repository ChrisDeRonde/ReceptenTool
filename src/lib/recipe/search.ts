import { canonicalName } from "@/lib/shopping/units";
import { flattenIngredients, recipeSchema, type Recipe } from "./schema";

/**
 * Zoeken in je eigen recepten.
 *
 * De belangrijkste vraag is niet "waar staat dat woord" maar **wat kan ik maken
 * met wat er in huis is**. Typ je "paprika gehakt", dan wil je eerst de
 * recepten die allebei gebruiken, en daarna die waar je nog één ding voor mist.
 * Daarom telt deze zoekfunctie per zoekterm of hij voorkomt, en sorteert op het
 * aantal treffers in plaats van op één relevantiescore.
 *
 * Er is geen index-tabel: bij een paar honderd recepten is alles doorlopen
 * sneller dan een index die kan verouderen. Loopt de collectie ooit in de
 * duizenden, dan is een `RecipeIngredient`-tabel de volgende stap.
 */

export type SearchTerm = {
  /** Zoals je het typte, voor in de melding. */
  raw: string;
  /** Genormaliseerd: kleine letters, enkelvoud waar we het zeker weten. */
  key: string;
};

export type Hit = {
  /** Hoeveel van je zoektermen dit recept afdekt. */
  matched: number;
  /** Welke termen in de ingrediënten zitten — dat telt zwaarder dan de titel. */
  inIngredients: string[];
  /** Termen die dit recept níét heeft. */
  missing: string[];
};

/**
 * "paprika gehakt" en "paprika, gehakt" leveren allebei twee termen op.
 *
 * Zet je er een komma in, dan is die de scheiding en mag een term uit meer
 * woorden bestaan: "rode paprika, gehakt" zoekt naar rode paprika én gehakt,
 * en niet naar drie losse woorden. Zonder komma's splitst de spatie, want zo
 * typt iedereen het als het even snel moet.
 *
 * Losse letters negeren we: die passen overal op.
 */
export function parseQuery(raw: string | null | undefined): SearchTerm[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const terms: SearchTerm[] = [];

  const separator = /[,;\n]/.test(raw) ? /[,;\n]+/ : /\s+/;

  for (const part of raw.split(separator)) {
    const trimmed = part.trim();
    if (trimmed.length < 2) continue;
    const key = canonicalName(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push({ raw: trimmed, key });
  }
  return terms.slice(0, 8);
}

/** De doorzoekbare tekst van één recept, één keer opgebouwd. */
export type Haystack = {
  /** Losse woorden uit de ingrediëntnamen, genormaliseerd. */
  ingredients: string[];
  /** Losse woorden uit titel, omschrijving, tags en keuken. */
  text: string[];
};

/** Woorden eruit halen; leestekens en cijfers doen niet mee. */
function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-zà-ÿ\']+/)
    .filter((word) => word.length > 1);
}

/**
 * Past dit woord bij deze zoekterm?
 *
 * Niet met een kale `includes`: dan vindt "ui" ook "br**ui**ne suiker" en
 * "loem" ook "bloem". Wél met begin en eind van een woord, want Nederlands
 * plakt aan elkaar: "rundergehakt" is gehakt en "paprika's" is paprika. Voor
 * korte termen (twee letters, zoals "ui") alleen een exacte treffer — daar
 * levert meebuigen bijna altijd onzin op.
 */
function wordMatches(word: string, term: string): boolean {
  if (word === term) return true;
  if (term.length < 3) return false;

  // Vooraan: meervoud en bezit. "paprika" vindt "paprika's".
  if (word.startsWith(term)) return true;

  // Achteraan: de kern van een samenstelling. Wat ervóór staat moet dan wel
  // een woorddeel kunnen zijn — "runder|gehakt" telt, "b|loem" niet, anders
  // vindt elke willekeurige woordstaart iets.
  return word.endsWith(term) && word.length - term.length >= 3;
}

/**
 * Komt deze term voor in een lijst losse woorden?
 *
 * De tegenhanger van `wordMatches` voor een term die zelf uit meer woorden kan
 * bestaan: dan moeten ze er allemaal in zitten, anders sluit "rode ui" ook elk
 * recept met een gewone ui in. Gedeeld met de voorkeuren van het huishouden en
 * met de seizoenslijst, zodat een afkeer op precies hetzelfde woord aanslaat
 * als waarop je het recept kunt vinden.
 */
export function bevatTerm(woorden: readonly string[], term: string): boolean {
  const delen = term.split(" ").filter(Boolean);
  if (delen.length === 0) return false;
  return delen.every((deel) => woorden.some((woord) => wordMatches(woord, deel)));
}

export function buildHaystack(row: {
  title: string;
  description: string | null;
  tags: string;
  cuisine: string | null;
  data: string;
}): Haystack {
  let recipe: Recipe | null = null;
  try {
    const parsed = recipeSchema.safeParse(JSON.parse(row.data));
    if (parsed.success) recipe = parsed.data;
  } catch {
    // Onleesbare blob: dan zoeken we alleen in de kolommen.
  }

  const ingredients = recipe
    ? [
        ...new Set(
          flattenIngredients(recipe).flatMap((item) =>
            words(canonicalName(item.name)),
          ),
        ),
      ]
    : [];

  const text = [
    ...new Set(
      words([row.title, row.description ?? "", row.tags, row.cuisine ?? ""].join(" ")),
    ),
  ];

  return { ingredients, text };
}

/**
 * Beoordeelt één recept tegen de zoektermen.
 *
 * Een term telt als treffer zodra hij ergens voorkomt; of dat in een
 * ingrediënt was houden we apart bij, want daar zoek je meestal op.
 * `null` betekent: dit recept past bij geen van de termen.
 */
export function score(haystack: Haystack, terms: SearchTerm[]): Hit | null {
  if (terms.length === 0) return { matched: 0, inIngredients: [], missing: [] };

  const inIngredients: string[] = [];
  const missing: string[] = [];
  let matched = 0;

  for (const term of terms) {
    // Een zoekterm mag zelf uit meer woorden bestaan ("rode paprika"); dan
    // telt hij als treffer zodra elk woord ergens voorkomt.
    const parts = words(term.key);
    const needles = parts.length > 0 ? parts : [term.key];

    const inIngredient = needles.every((needle) =>
      haystack.ingredients.some((word) => wordMatches(word, needle)),
    );

    if (inIngredient) {
      inIngredients.push(term.raw);
      matched += 1;
      continue;
    }

    const inText = needles.every((needle) =>
      haystack.text.some((word) => wordMatches(word, needle)),
    );
    if (inText) {
      matched += 1;
      continue;
    }

    missing.push(term.raw);
  }

  return matched === 0 ? null : { matched, inIngredients, missing };
}

/**
 * Sorteervolgorde: eerst wat het meeste afdekt, dan wat het in de
 * ingrediënten had staan, dan favorieten, dan het nieuwste.
 */
export function compareHits(
  a: { hit: Hit; favorite: boolean; createdAt: Date },
  b: { hit: Hit; favorite: boolean; createdAt: Date },
): number {
  if (a.hit.matched !== b.hit.matched) return b.hit.matched - a.hit.matched;
  if (a.hit.inIngredients.length !== b.hit.inIngredients.length) {
    return b.hit.inIngredients.length - a.hit.inIngredients.length;
  }
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  return b.createdAt.getTime() - a.createdAt.getTime();
}
