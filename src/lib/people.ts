/**
 * Namen en de kleur die erbij hoort. Pure functies, zonder database of
 * omgeving eromheen — de plek die de lijst ophaalt is `settings.ts`, en het
 * `Avatar`-component knoopt de twee aan elkaar.
 */

/** Zoveel vlak-en-inkt-paren staan er in globals.css (`.avatar.t0` …). */
export const TINTEN = 4;

/**
 * De tint voor een naam, gegeven de lijst.
 *
 * De toekenning gaat op volgorde en niet op een hash van de naam. Een hash
 * lijkt netter maar botst: bij vier tinten kregen "Chris" en "Sanne" allebei
 * dezelfde kleur, en dan doet het rondje precies niet waar het voor is. De
 * lijst kennen we, dus tellen is beter dan gokken.
 *
 * Namen die er niet in staan — een `sharedBy` van vroeger bijvoorbeeld —
 * vallen terug op een hash. Die mogen best botsen; ze staan zelden naast
 * elkaar.
 */
export function tintForIn(name: string, lijst: readonly string[]): number {
  const index = lijst.indexOf(name);
  if (index >= 0) return index % TINTEN;

  let som = 0;
  for (let i = 0; i < name.length; i += 1) som = (som + name.charCodeAt(i) * (i + 1)) % 9973;
  return som % TINTEN;
}

/**
 * Alleen een naam die jij hebt ingesteld komt hier doorheen.
 *
 * De waarde komt uit een koekje of uit een formulierveld — allebei door de
 * bezoeker te veranderen — en belandt daarna in de database en op het scherm.
 * Ertegenaan houden van de lijst is dus geen formaliteit. Het staat hier los,
 * want dezelfde controle geldt op drie plekken (het koekje lezen, een naam
 * kiezen, en inloggen) en drie kopieën is er twee te veel om te vertrouwen.
 */
export function bekendeNaam(waarde: unknown, namen: readonly string[]): string | null {
  if (typeof waarde !== "string") return null;
  return namen.find((naam) => naam === waarde) ?? null;
}

/** Meer dan dit is geen naam meer maar een zin. */
const NAAM_MAX = 24;

/** Acht is ruim; meer namen dan tinten levert alleen dubbele kleuren op. */
const PERSONEN_MAX = 8;

/** Komma-gescheiden namen naar een nette lijst. */
export function schoon(waarde: string): string[] {
  const gezien = new Set<string>();
  const uit: string[] = [];

  for (const stuk of waarde.split(",")) {
    const naam = stuk.trim().replace(/\s+/g, " ");
    if (naam.length === 0 || naam.length > NAAM_MAX) continue;

    const sleutel = naam.toLocaleLowerCase("nl-NL");
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push(naam);
  }

  return uit.slice(0, PERSONEN_MAX);
}
