import { cookies } from "next/headers";

/**
 * Wie zit er achter het scherm?
 *
 * Nadrukkelijk géén tweede slot. Het slot is de voordeur (`session.ts`) en die
 * delen jullie; binnen valt niets te bewijzen en niets af te schermen. Dit is
 * een naamkaartje, zodat de app "Chris: 4 sterren, wil vaker" kan zeggen in
 * plaats van een gemiddelde waar niemand zich in herkent.
 *
 * Iedereen kan elke naam kiezen en wisselen kost één tik. Dat is de bedoeling.
 */

export const WHO_COOKIE = "wie";

/** Een jaar; je wisselt van naam als je dat wilt, niet omdat het verloopt. */
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * De namen uit `APP_USERS`, komma-gescheiden. Staat die leeg, dan is de hele
 * functie uit: geen vraag bij het inloggen, geen namen in beeld, en alles
 * werkt zoals het zonder werkte.
 */
export function configuredPeople(): string[] {
  return (process.env.APP_USERS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= 24)
    .slice(0, 8);
}

/**
 * De gekozen naam, of null.
 *
 * Alleen namen die in `APP_USERS` staan komen hier doorheen. Het koekje is
 * door de gebruiker te veranderen en die waarde belandt in de database en op
 * het scherm; door hem tegen de lijst te houden kan er niets anders in staan
 * dan wat jij hebt ingesteld.
 */
export async function currentPerson(): Promise<string | null> {
  const people = configuredPeople();
  if (people.length === 0) return null;

  const value = (await cookies()).get(WHO_COOKIE)?.value;
  if (!value) return null;

  return people.find((name) => name === value) ?? null;
}

export function personCookie(name: string) {
  return {
    name: WHO_COOKIE,
    value: name,
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: (process.env.APP_BASE_URL ?? "").startsWith("https://"),
    path: "/" as const,
    maxAge: MAX_AGE_SECONDS,
  };
}
