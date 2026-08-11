/**
 * Wie de app gebruiken, en welke kleur bij wie hoort.
 *
 * Apart van `who.ts` omdat dat bestand `next/headers` aanraakt en daarmee
 * alleen op de server bruikbaar is. Hier staat alleen wat uit de omgeving
 * komt, zodat ook een component als `Avatar` het kan lezen.
 */

/** Zoveel vlak-en-inkt-paren staan er in globals.css (`.avatar.t0` …). */
export const TINTEN = 4;

/**
 * De namen uit `APP_USERS`, komma-gescheiden. Staat die leeg, dan is de hele
 * functie uit: geen vraag bij het inloggen en geen namen in beeld.
 */
export function configuredPeople(): string[] {
  return (process.env.APP_USERS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= 24)
    .slice(0, 8);
}

/**
 * Welke tint hoort bij deze naam?
 *
 * Op volgorde van `APP_USERS`, niet op een hash van de naam. Een hash lijkt
 * netter maar botst: bij vier tinten kregen "Chris" en "Sanne" allebei
 * dezelfde kleur, en dan doet het rondje precies niet waar het voor is.
 * De lijst kennen we, dus tellen is beter dan gokken.
 *
 * Namen die er niet in staan — bijvoorbeeld een `sharedBy` van vroeger — vallen
 * terug op een hash. Die mogen best botsen; ze staan zelden naast elkaar.
 */
export function tintFor(name: string): number {
  const index = configuredPeople().indexOf(name);
  if (index >= 0) return index % TINTEN;

  let som = 0;
  for (let i = 0; i < name.length; i += 1) som = (som + name.charCodeAt(i) * (i + 1)) % 9973;
  return som % TINTEN;
}
