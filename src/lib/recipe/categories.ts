/**
 * De indeling van recepten: wanneer je het eet, uit welke keuken het komt, en
 * wat het qua dieet is.
 *
 * Maaltijdmomenten zijn een gesloten lijst — een vrij tekstveld levert binnen
 * een maand "avondeten", "Avond" en "diner" naast elkaar op, en dan filtert het
 * niet meer. Keukens zijn een open lijst met suggesties, want er is geen
 * eindige verzameling en je wilt niet vastlopen op "Scandinavisch".
 * Dieetkenmerken zijn weer gesloten, om dezelfde reden als de momenten.
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

/* ==========================================================================
   Dieet
   ========================================================================== */

/**
 * Wat een gerecht qua dieet is.
 *
 * **Dit is een inschatting, geen keurmerk.** Het wordt afgeleid uit de
 * ingrediëntenlijst, en die is soms onvolledig: "bouillon" zegt niets over de
 * vis erin, en een merknaam verzwijgt de melkpoeder. Prima om op te filteren
 * als je liever vegetarisch eet; niet goed genoeg voor een allergie. De app
 * schrijft daarom overal "waarschijnlijk" waar ze dit toont, en wie iets écht
 * moet vermijden zet dat als afkeer bij zijn eigen naam — dan kijkt de app naar
 * de ingrediënten zelf in plaats van naar dit etiket.
 *
 * Vijf waarden en niet meer: elke waarde die het model niet betrouwbaar uit een
 * ingrediëntenlijst kan halen, levert alleen maar een filter op dat de helft
 * mist.
 */
export const DIETS = [
  "vegetarisch",
  "veganistisch",
  "glutenvrij",
  "lactosevrij",
  "notenvrij",
] as const;

export type Diet = (typeof DIETS)[number];

export const DIET_LABELS: Record<Diet, string> = {
  vegetarisch: "Vegetarisch",
  veganistisch: "Veganistisch",
  glutenvrij: "Glutenvrij",
  lactosevrij: "Lactosevrij",
  notenvrij: "Notenvrij",
};

/** Wat elke waarde precies betekent — voor de prompt en voor de uitleg. */
export const DIET_HINTS: Record<Diet, string> = {
  vegetarisch: "geen vlees, gevogelte, vis of schaaldieren; ei en zuivel mogen wel",
  veganistisch: "helemaal geen dierlijke producten, dus ook geen ei, zuivel of honing",
  glutenvrij: "geen tarwe, spelt, rogge, gerst, couscous, bulgur, paneermeel of gewone pasta",
  lactosevrij: "geen melk, room, boter, kaas, yoghurt of karnemelk",
  notenvrij: "geen noten en geen pinda's; zaden en pitten tellen niet mee",
};

/**
 * Wat wat impliceert.
 *
 * Veganistisch is per definitie ook vegetarisch en lactosevrij. Dat hier
 * uitschrijven scheelt drie plekken waar het anders alsnog geregeld moet
 * worden: de opslag, het filter en de voorkeuren van het huishouden.
 */
const DIET_IMPLIES: Partial<Record<Diet, Diet[]>> = {
  veganistisch: ["vegetarisch", "lactosevrij"],
};

const DIET_SYNONYMS: Record<string, Diet> = {
  vega: "vegetarisch",
  vegetarian: "vegetarisch",
  vleesloos: "vegetarisch",
  vegan: "veganistisch",
  plantaardig: "veganistisch",
  veganistisch: "veganistisch",
  "gluten-vrij": "glutenvrij",
  glutenvrei: "glutenvrij",
  zuivelvrij: "lactosevrij",
  melkvrij: "lactosevrij",
  "lactose-vrij": "lactosevrij",
  notevrij: "notenvrij",
  pindavrij: "notenvrij",
  "noten-vrij": "notenvrij",
};

export function normalizeDiet(value: string): Diet | null {
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  if ((DIETS as readonly string[]).includes(clean)) return clean as Diet;
  return DIET_SYNONYMS[clean] ?? null;
}

/**
 * Ontdubbelt, vult impliciete waarden aan en zet in de vaste volgorde.
 *
 * Het aanvullen gebeurt hier en niet bij het tonen: een veganistisch recept dat
 * niet als vegetarisch is opgeslagen, mist het vegetarisch-filter, en dat is
 * precies het soort gat waar je pas na een maand achter komt.
 */
export function normalizeDiets(values: readonly string[]): Diet[] {
  const found = new Set<Diet>();
  for (const value of values) {
    const diet = normalizeDiet(value);
    if (!diet) continue;
    found.add(diet);
    for (const extra of DIET_IMPLIES[diet] ?? []) found.add(extra);
  }
  return DIETS.filter((diet) => found.has(diet));
}

export function packDiets(values: readonly Diet[]): string {
  return values.join(",");
}

export function unpackDiets(packed: string | null | undefined): Diet[] {
  if (!packed) return [];
  return normalizeDiets(packed.split(","));
}
