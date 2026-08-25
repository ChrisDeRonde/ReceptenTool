"use client";

import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/**
 * Uitprinten.
 *
 * De printstijl stond er al, maar je moest ⌘P kennen om hem te vinden — en op
 * een telefoon werkt dat helemaal niet. Eén knop dus, bij de andere acties.
 *
 * Een client component omdat `window.print()` nu eenmaal in de browser draait.
 * Hij verstopt zichzelf niet als printen niet kan: elke browser die dit script
 * uitvoert kan ook printen of naar pdf bewaren.
 */
export function PrintKnop() {
  return (
    <button
      type="button"
      className="button secondary icon"
      onClick={() => window.print()}
      aria-label="Dit recept printen"
      title="Printen"
    >
      <Icon icon={icons.print} size={18} />
    </button>
  );
}
