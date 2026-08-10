/**
 * De indeling van recepten: wanneer je het eet, en uit welke keuken het komt.
 *
 * Maaltijdmomenten zijn een gesloten lijst — een vrij tekstveld levert binnen
 * een maand "avondeten", "Avond" en "diner" naast elkaar op, en dan filtert het
 * niet meer. Keukens zijn een open lijst met suggesties, want er is geen
 * eindige verzameling en je wilt niet vastlopen op "Scandinavisch".
 */

export const MEAL_TYPES = [
  "ontbijt",
  "lunch",
  "diner",
  "bijgerecht",
  "snack",
  "borrelhapje",
  "dessert",
  "bakken",
  "drank",
  "basis",
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

/** Wat er in de UI staat; de opgeslagen waarde blijft kleine letters. */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  ontbijt: "Ontbijt",
  lunch: "Lunch",
  diner: "Diner",
  bijgerecht: "Bijgerecht",
  snack: "Snack",
  borrelhapje: "Borrelhapje",
  dessert: "Dessert",
  bakken: "Bakken",
  drank: "Drank",
  basis: "Basis",
};

/**
 * Eén emoji per moment. Puur voor de UI: op een rij filterchips scheelt een
 * icoontje meer dan kleur, en het geeft een recept zonder foto toch een gezicht.
 */
export const MEAL_TYPE_EMOJI: Record<MealType, string> = {
  ontbijt: "🍳",
  lunch: "🥪",
  diner: "🍝",
  bijgerecht: "🥗",
  snack: "🍿",
  borrelhapje: "🫒",
  dessert: "🍰",
  bakken: "🥐",
  drank: "🥤",
  basis: "🧂",
};

/** Korte uitleg bij de minder vanzelfsprekende momenten, voor de prompt. */
export const MEAL_TYPE_HINTS: Partial<Record<MealType, string>> = {
  bakken: "brood, taart, koek — het bakwerk zelf, ook als het geen nagerecht is",
  drank: "cocktails, smoothies, siropen",
  basis: "sauzen, bouillon, deeg, pickles: geen gerecht op zich",
};

/**
 * Het model en oudere data leveren varianten aan. Deze tabel vangt de
 * gebruikelijke af zodat er niet twee categorieën ontstaan die hetzelfde
 * betekenen.
 */
const MEAL_TYPE_SYNONYMS: Record<string, MealType> = {
  avondeten: "diner",
  avondmaal: "diner",
  hoofdgerecht: "diner",
  middageten: "lunch",
  brunch: "lunch",
  nagerecht: "dessert",
  toetje: "dessert",
  dessert: "dessert",
  voorgerecht: "borrelhapje",
  hapje: "borrelhapje",
  borrel: "borrelhapje",
  tussendoortje: "snack",
  bijgerechten: "bijgerecht",
  baksel: "bakken",
  gebak: "bakken",
  saus: "basis",
  drankje: "drank",
};

export function normalizeMealType(value: string): MealType | null {
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  if ((MEAL_TYPES as readonly string[]).includes(clean)) return clean as MealType;
  return MEAL_TYPE_SYNONYMS[clean] ?? null;
}

/** Ontdubbelt en zet in de vaste volgorde van MEAL_TYPES, niet die van de invoer. */
export function normalizeMealTypes(values: readonly string[]): MealType[] {
  const found = new Set<MealType>();
  for (const value of values) {
    const type = normalizeMealType(value);
    if (type) found.add(type);
  }
  return MEAL_TYPES.filter((type) => found.has(type));
}

/** Suggesties in de UI; de gebruiker mag ook iets anders intypen. */
export const CUISINE_SUGGESTIONS = [
  "Nederlands",
  "Italiaans",
  "Frans",
  "Spaans",
  "Grieks",
  "Turks",
  "Marokkaans",
  "Midden-Oosters",
  "Indiaas",
  "Thais",
  "Vietnamees",
  "Chinees",
  "Japans",
  "Koreaans",
  "Indonesisch",
  "Surinaams",
  "Mexicaans",
  "Amerikaans",
  "Duits",
  "Scandinavisch",
] as const;

/**
 * Keukens worden met een hoofdletter opgeslagen, zodat "italiaans" en
 * "Italiaans" niet als twee filters in de lijst verschijnen.
 */
export function normalizeCuisine(value: string | null | undefined): string | null {
  const clean = value?.trim().replace(/\s+/g, " ");
  if (!clean) return null;

  const match = CUISINE_SUGGESTIONS.find(
    (suggestion) => suggestion.toLowerCase() === clean.toLowerCase(),
  );
  if (match) return match;

  // Zelf getypt: alleen de eerste letter aanpassen, de rest laten staan —
  // "Midden-Oosters" mag zijn koppelteken en hoofdletter houden.
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Comma-gescheiden opslag, want SQLite kent geen arrays. */
export function packMealTypes(values: readonly MealType[]): string {
  return values.join(",");
}

export function unpackMealTypes(packed: string | null | undefined): MealType[] {
  if (!packed) return [];
  return normalizeMealTypes(packed.split(","));
}
