"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/**
 * De ster die een recept tot favoriet maakt.
 *
 * Het knopje zit in een gewoon formulier met een server action erachter, en
 * dat blijft zo: zonder JavaScript werkt het dan nog steeds. Wat dit
 * component toevoegt is het antwoord tussendoor. Tikken betekende hiervoor
 * wachten tot de server klaar was en de pagina opnieuw kwam — een halve
 * seconde waarin er niets gebeurde en je je afvroeg of je wel raak had getikt.
 *
 * `useFormStatus` weet dat het formulier onderweg is. Zolang dat zo is tonen we
 * alvast de uitkomst. Klopt die (en dat doet hij, want de server doet precies
 * dit), dan zie je geen sprongetje als het antwoord binnenkomt.
 */
export function FavorietKnop({ favoriet }: { favoriet: boolean }) {
  const { pending } = useFormStatus();
  const aan = pending ? !favoriet : favoriet;

  return (
    <button
      type="submit"
      className={`icon secondary ${aan ? "on" : ""}`}
      aria-pressed={aan}
      aria-label={aan ? "Uit favorieten halen" : "Favoriet maken"}
      title={aan ? "Uit favorieten halen" : "Favoriet maken"}
    >
      <Icon icon={icons.favorite} size={19} />
    </button>
  );
}
