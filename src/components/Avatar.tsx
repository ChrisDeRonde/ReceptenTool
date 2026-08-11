/**
 * Een naam als rondje met een initiaal.
 *
 * Geen bestand om te beheren en niets om te uploaden: bij twee mensen is een
 * letter genoeg om in één oogopslag te zien van wie een oordeel is. De kleur
 * volgt uit de naam zelf, dus hij is overal in de app dezelfde en verandert
 * niet als er iemand bij komt.
 *
 * De tinten komen uit de bestaande pastelset, zodat er geen kleur bij komt die
 * nergens anders voorkomt, en worden toegekend op volgorde van `APP_USERS` —
 * zie `tintFor`. Daardoor krijgen twee huisgenoten gegarandeerd verschillende
 * kleuren.
 */

import { tintFor } from "@/lib/people";

/** De eerste letter, ook als de naam met een accent begint. */
function initiaal(naam: string): string {
  return [...naam.trim()][0]?.toLocaleUpperCase("nl-NL") ?? "?";
}

export function Avatar({
  name,
  size = 24,
  withName = false,
}: {
  name: string;
  size?: number;
  /** Naam ernaast tonen. Zonder dit staat hij in het label voor schermlezers. */
  withName?: boolean;
}) {
  const rondje = (
    <span
      className={`avatar t${tintFor(name)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden={withName ? true : undefined}
      aria-label={withName ? undefined : name}
      title={withName ? undefined : name}
      role={withName ? undefined : "img"}
    >
      {initiaal(name)}
    </span>
  );

  if (!withName) return rondje;

  return (
    <span className="avatar-naam">
      {rondje}
      {name}
    </span>
  );
}
