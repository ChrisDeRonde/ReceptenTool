import type { Ingredient, Recipe } from "./schema";

/** Boven de 24 wordt het catering; dit voorkomt ook onzin-URL's. */
export const MAX_SERVINGS = 24;
export const MIN_SERVINGS = 1;

/**
 * Voor hoeveel personen tonen we dit recept?
 *
 * Drie bronnen, in deze volgorde:
 *
 *  1. Wat er in de URL staat. Jij zet hem op zes voor als er visite komt; die
 *     keuze reist mee naar de kookmodus en overleeft een refresh.
 *  2. Jullie huishouden, als dat is ingesteld. Een recept voor vier openen op
 *     vier terwijl jullie met z'n tweeën zijn betekent dat je elke keer twee
 *     keer op min tikt.
 *  3. Wat de bron zei. Dat is een eigenschap van het recept, niet van jullie,
 *     maar zonder de andere twee is het het beste dat we hebben.
 *
 * Geeft null als het recept helemaal geen porties kent — dan valt er niets te
 * schalen en heeft de teller ook geen betekenis.
 */
export function parseServings(
  raw: string | string[] | undefined,
  base: number | null,
  huishouden?: number | null,
): number | null {
  if (base === null || base <= 0) return null;

  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed)) return begrens(parsed);

  if (huishouden !== null && huishouden !== undefined && huishouden > 0) {
    return begrens(huishouden);
  }
  return base;
}

function begrens(aantal: number): number {
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, aantal));
}

/**
 * Het recept omrekenen naar een ander aantal porties.
 *
 * Alleen hoeveelheden schalen mee. Tijden bewust niet: twee keer zoveel pasta
 * kookt niet twee keer zo lang, en een oven wordt niet sneller warm van een
 * grotere schaal. Ook de staptekst blijft ongemoeid — daar getallen in
 * herschrijven is tekstmanipulatie waarbij je meer stukmaakt dan je oplost.
 */
export function scaleRecipe(recipe: Recipe, targetServings: number): Recipe {
  const base = recipe.servings;
  if (base === null || base <= 0 || targetServings === base) return recipe;

  const factor = targetServings / base;

  return {
    ...recipe,
    servings: targetServings,
    ingredientGroups: recipe.ingredientGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => scaleIngredient(item, factor)),
    })),
  };
}

export function scaleIngredient(item: Ingredient, factor: number): Ingredient {
  if (item.quantity === null) return item;
  return { ...item, quantity: roundQuantity(item.quantity * factor, item.unit) };
}

const SPOONS = /^(el|tl|eetlepel|theelepel|eetlepels|theelepels|tbsp|tsp)$/i;
const SMALL_MEASURE = /^(g|gr|gram|grammen|ml|milliliter|cc)$/i;
const LARGE_MEASURE = /^(kg|kilo|kilogram|l|liter|dl|cl)$/i;

/**
 * Afronden op een hoeveelheid waarmee je kunt koken.
 *
 * 266,67 g wordt 265 g; niemand weegt nauwkeuriger dan dat, en een recept dat
 * om 266,67 g vraagt lijkt precies terwijl het dat niet is. De stapgrootte
 * loopt op met de hoeveelheid: bij 8 g telt een halve gram, bij 800 g niet.
 */
export function roundQuantity(value: number, unit: string | null): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const step = stepFor(value, unit);
  const rounded = Math.round(value / step) * step;

  // Nooit naar nul afronden: dan verdwijnt een ingrediënt uit het recept.
  const result = rounded > 0 ? rounded : step;

  // Drijvende komma laat 0.30000000000000004 achter; twee decimalen is genoeg.
  return Math.round(result * 100) / 100;
}

function stepFor(value: number, unit: string | null): number {
  const clean = unit?.trim() ?? "";

  // Lepels: kwart lepels bestaan, achtsten niet.
  if (SPOONS.test(clean)) return 0.25;

  // Kilo's en liters: op 50 g / 50 ml nauwkeurig.
  if (LARGE_MEASURE.test(clean)) return 0.05;

  if (SMALL_MEASURE.test(clean)) {
    if (value < 10) return 0.5;
    if (value < 50) return 1;
    // Tot een halve kilo op 5 g: dat is het bereik waarin de meeste recepten
    // zitten, en elke keukenweegschaal haalt het. Daarboven tientallen.
    if (value < 500) return 5;
    return 10;
  }

  // Telbare dingen: eieren, uien, teentjes, blaadjes. Halven mogen, kwarten
  // worden onpraktisch — een kwart ei bestaat niet.
  return value < 4 ? 0.5 : 1;
}

/** "3 → 6 personen" of null als er niet geschaald is. */
export function scaleLabel(
  baseServings: number | null,
  currentServings: number | null,
): string | null {
  if (
    baseServings === null ||
    currentServings === null ||
    baseServings === currentServings
  ) {
    return null;
  }
  return `Omgerekend van ${baseServings} naar ${currentServings} personen`;
}
