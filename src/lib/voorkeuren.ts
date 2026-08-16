/**
 * Wat ieder van jullie wel en niet eet.
 *
 * Twee soorten voorkeur, en het verschil is niet cosmetisch:
 *
 *  - **dieet** is een keuze uit de vaste lijst en wordt vergeleken met het
 *    dieetkenmerk van een recept. Dat kenmerk is een inschatting van het model,
 *    dus deze kant is handig maar niet hard.
 *  - **afkeer** is vrije tekst en wordt vergeleken met de ingrediënten zélf.
 *    Geen model, geen etiket: als er "varkensvlees" in de lijst staat, staat
 *    het er. Dít is daarom de kant voor wat iemand écht niet mag hebben.
 *
 * Alles hier is puur — geen database, geen `next/headers` — zodat de afweging
 * te testen is en `settings.ts` alleen nog hoeft op te halen en weg te
 * schrijven.
 */

import { normalizeDiets, type Diet } from "@/lib/recipe/categories";
import { bevatTerm } from "@/lib/recipe/search";
import { canonicalName } from "@/lib/shopping/units";

export type Voorkeur = {
  /** Wat dit recept moet zijn wil deze persoon meeëten. Leeg is: alles mag. */
  dieet: Diet[];
  /** Wat deze persoon niet eet, in eigen woorden. Genormaliseerd opgeslagen. */
  afkeer: string[];
};

export type Voorkeuren = Record<string, Voorkeur>;

/** Meer dan dit is geen afkeer meer maar een boodschappenlijst. */
const AFKEER_MAX = 12;

/** Losse letters passen overal op; twee tekens is de ondergrens. */
const AFKEER_MIN_LENGTE = 2;

export const LEEG: Voorkeur = { dieet: [], afkeer: [] };

/**
 * De opgeslagen JSON terug naar voorkeuren, gefilterd op wie er nu is.
 *
 * Namen die niet meer in het huishouden staan vallen weg in plaats van te
 * blijven zweven: iemand die je uit de instellingen haalt, hoort niet stilletjes
 * het weekmenu te blijven sturen. De JSON zelf blijft wel staan, dus komt de
 * naam terug, dan komt de voorkeur mee.
 */
export function leesVoorkeuren(
  ruw: string | null | undefined,
  namen: readonly string[],
): Voorkeuren {
  let blob: unknown = null;
  try {
    blob = ruw ? JSON.parse(ruw) : null;
  } catch {
    // Onleesbaar opgeslagen: dan is er geen voorkeur, en dat is een veiliger
    // uitkomst dan half raden wat er stond.
  }

  const uit: Voorkeuren = {};
  if (!blob || typeof blob !== "object") return uit;

  for (const naam of namen) {
    const rij = (blob as Record<string, unknown>)[naam];
    if (!rij || typeof rij !== "object") continue;
    const voorkeur = maakVoorkeur(rij as Record<string, unknown>);
    if (voorkeur.dieet.length > 0 || voorkeur.afkeer.length > 0) uit[naam] = voorkeur;
  }
  return uit;
}

export function schrijfVoorkeuren(voorkeuren: Voorkeuren): string {
  return JSON.stringify(voorkeuren);
}

function maakVoorkeur(rij: Record<string, unknown>): Voorkeur {
  const dieet = Array.isArray(rij.dieet) ? rij.dieet.map(String) : [];
  const afkeer = Array.isArray(rij.afkeer) ? rij.afkeer.map(String) : [];
  return { dieet: normalizeDiets(dieet), afkeer: schoonAfkeer(afkeer.join(",")) };
}

/**
 * "varkensvlees, koriander" naar een nette lijst.
 *
 * Door `canonicalName` heen, dezelfde functie die de zoekfunctie en de
 * boodschappenlijst gebruiken: dan valt "paprika's" samen met "paprika", en
 * matcht de afkeer straks op hetzelfde woord als waarop het recept vindbaar is.
 */
export function schoonAfkeer(waarde: string): string[] {
  const gezien = new Set<string>();
  const uit: string[] = [];

  for (const stuk of waarde.split(/[,;\n]/)) {
    const woord = canonicalName(stuk);
    if (woord.length < AFKEER_MIN_LENGTE || gezien.has(woord)) continue;
    gezien.add(woord);
    uit.push(woord);
  }
  return uit.slice(0, AFKEER_MAX);
}

/**
 * Alles wat er van de aanwezigen samen gevraagd wordt.
 *
 * De dieetkenmerken worden opgeteld en niet gemiddeld: eet er iemand
 * vegetarisch mee, dan is het gerecht vegetarisch, ook al is de rest alleseter.
 * `normalizeDiets` vult de impliciete kenmerken aan, dus veganistisch plus
 * glutenvrij levert vanzelf ook vegetarisch en lactosevrij op.
 */
export function eisen(
  voorkeuren: Voorkeuren,
  namen: readonly string[],
): { dieet: Diet[]; afkeer: string[] } {
  const dieet: string[] = [];
  const afkeer = new Set<string>();

  for (const naam of namen) {
    const voorkeur = voorkeuren[naam];
    if (!voorkeur) continue;
    dieet.push(...voorkeur.dieet);
    for (const woord of voorkeur.afkeer) afkeer.add(woord);
  }

  return { dieet: normalizeDiets(dieet), afkeer: [...afkeer] };
}

/**
 * Wie van de aanwezigen dit ingrediënt niet eet.
 *
 * Geeft naam en woord terug in plaats van alleen "ja of nee": op de
 * receptpagina wil je lezen wát het is en voor wíé, niet dat er iets is.
 */
export function bezwaren(
  voorkeuren: Voorkeuren,
  ingredientWoorden: readonly string[],
): Array<{ naam: string; woorden: string[] }> {
  const uit: Array<{ naam: string; woorden: string[] }> = [];

  for (const [naam, voorkeur] of Object.entries(voorkeuren)) {
    const raak = voorkeur.afkeer.filter((woord) => bevatTerm(ingredientWoorden, woord));
    if (raak.length > 0) uit.push({ naam, woorden: raak });
  }
  return uit;
}

/** Voldoet dit recept aan alles wat de aanwezigen vragen? */
export function magOpTafel(
  recept: { diets: readonly Diet[]; ingredientWoorden: readonly string[] },
  gevraagd: { dieet: readonly Diet[]; afkeer: readonly string[] },
): boolean {
  if (!gevraagd.dieet.every((diet) => recept.diets.includes(diet))) return false;
  return !gevraagd.afkeer.some((woord) => bevatTerm(recept.ingredientWoorden, woord));
}
