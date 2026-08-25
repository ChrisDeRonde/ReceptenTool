"use client";

import { useFormStatus } from "react-dom";

/**
 * Een verzendknop die laat zien dat hij bezig is.
 *
 * Dit was het grootste gat in de app. De helft van wat je hier doet gaat via
 * een server action, en die neemt op een servertje thuis — helemaal via
 * Tailscale van buitenaf — zomaar een halve seconde. In die halve seconde
 * gebeurde er niets: geen kleurverschil, geen spinner, niets. Wat een mens dan
 * doet is nog een keer tikken, en bij een portieknop staan er daarna twee
 * personen extra aan tafel.
 *
 * Twee dingen dus, en het tweede is het belangrijkste:
 *
 *  1. **Zeggen dat er iets gebeurt.** `aria-busy` voor wie luistert, een
 *     gedempte staat voor wie kijkt.
 *  2. **De tweede tik tegenhouden.** `disabled` zolang het verzoek loopt. Dat
 *     is geen versiering maar de eigenlijke reparatie.
 *
 * Werkt zonder JavaScript gewoon door: `useFormStatus` geeft dan altijd
 * `pending: false` en er blijft een doodgewone submit-knop over. Dat is de
 * reden dat dit een knop is en geen `onClick`-afhandeling.
 *
 * Moet er tijdens het wachten iets ánders komen te staan — "Bezig…" in plaats
 * van "Opslaan" — geef dan `bezigLabel` mee. Bij icoonknoppen doe je dat niet:
 * daar is het icoon de hele inhoud en zou verwisselen alleen maar wiebelen.
 */
export function Knop({
  children,
  className = "",
  bezigLabel,
  disabled,
  ...rest
}: React.ComponentProps<"button"> & { bezigLabel?: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={[className, pending ? "bezig" : ""].filter(Boolean).join(" ")}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending && bezigLabel ? bezigLabel : children}
    </button>
  );
}
