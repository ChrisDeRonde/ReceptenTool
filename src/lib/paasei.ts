/**
 * Het verstopte recept.
 *
 * Zoek je in het overzicht naar de naam van de app zelf, dan komt er iets
 * boven dat niet in de database staat. Verder niets: de gewone resultaten
 * blijven eronder staan, en wie het niet zoekt vindt het nooit.
 *
 * Waarom via de zoekbalk en niet met een toetsencombinatie: dit is een app die
 * je met natte handen op een aanrecht gebruikt. De Konami-code haalt niemand
 * daar. Zijn eigen naam intypen doet vroeg of laat iedereen.
 *
 * De sleutel loopt door `canonicalName`, dus "Klapper", "klappers" en
 * "  KLAPPER " werken alle drie — dezelfde soepelheid als bij het echte
 * zoeken, want een paasei dat je precies goed moet spellen is geen paasei.
 */

import { canonicalName } from "@/lib/shopping/units";

export type Paasei = {
  titel: string;
  ondertitel: string;
  ingredienten: string[];
  stappen: string[];
  slot: string;
};

/** Waar het op reageert. Eén woord, de naam van de app. */
const SLEUTEL = "klapper";

export const PAASEI: Paasei = {
  titel: "Klapper",
  ondertitel: "Voor twee, maar het schaalt vanzelf mee.",
  ingredienten: [
    "1 telefoon, opgeladen",
    "2 mensen met honger",
    "een handvol links die je ooit bewaarde",
    "een keuken waar het licht aan staat",
    "geduld, naar smaak",
  ],
  stappen: [
    "Deel iets wat er lekker uitziet. Wacht niet tot je weet wanneer je het maakt.",
    "Laat het even staan. De beste recepten zijn die je vergeet en dan terugvindt.",
    "Kook het. Zet er sterren bij, ook als het tegenviel — vooral dan.",
    "Doe het over een half jaar nog eens. Dan pas weet je of het er een is.",
  ],
  slot: "Bewaartijd: onbeperkt, mits af en toe gebruikt.",
};

/**
 * Is er naar het paasei gezocht?
 *
 * Kijkt naar de losse termen en niet naar de hele zin, zodat "klapper pasta"
 * hem ook opent. Dat is met opzet: als je hem eenmaal kent, mag hij niet
 * ineens weer weg zijn omdat je er nog iets bij typte.
 *
 * Een kale meervouds-s valt eraf. `canonicalName` doet dat niet — die haalt
 * alleen `'s` weg — en "klappers" hoort hem gewoon te openen. Wél op het hele
 * woord vergelijken en niet met de soepele `wordMatches` uit het zoeken:
 * anders opent elke samenstelling die er toevallig mee begint hem ook, en dan
 * is het geen verstopte grap meer maar een bijwerking.
 */
export function isPaasei(termen: readonly { key: string }[]): boolean {
  const sleutel = canonicalName(SLEUTEL);
  return termen.some((term) => {
    const woord = term.key.endsWith("s") ? term.key.slice(0, -1) : term.key;
    return term.key === sleutel || woord === sleutel;
  });
}
