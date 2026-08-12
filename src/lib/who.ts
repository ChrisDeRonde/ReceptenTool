import { cookies } from "next/headers";
import { bekendeNaam } from "@/lib/people";
import { people } from "@/lib/settings";

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
 * De gekozen naam, of null.
 *
 * Alleen namen die in `APP_USERS` staan komen hier doorheen. Het koekje is
 * door de gebruiker te veranderen en die waarde belandt in de database en op
 * het scherm; door hem tegen de lijst te houden kan er niets anders in staan
 * dan wat jij hebt ingesteld.
 */
export async function currentPerson(): Promise<string | null> {
  const namen = await people();
  if (namen.length === 0) return null;

  return bekendeNaam((await cookies()).get(WHO_COOKIE)?.value, namen);
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
