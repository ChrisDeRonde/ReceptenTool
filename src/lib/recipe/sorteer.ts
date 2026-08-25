/**
 * Waarop het overzicht gesorteerd staat.
 *
 * De volgorde was vast — favorieten eerst, dan nieuwste — terwijl de app de
 * gegevens voor de andere twee al lang heeft: het weekmenu rekent er elke week
 * mee. Wat hier bij komt is dus geen nieuwe som maar een knop.
 *
 * Puur, zonder database, zodat de volgorde te testen is zonder een pagina op te
 * bouwen. Sorteert een kopie en niet de invoer: de aanroeper heeft dezelfde
 * rijen ook nog nodig voor het zoeken.
 */

export const SORTERINGEN = ["vers", "cijfer", "rust"] as const;
export type Sortering = (typeof SORTERINGEN)[number];

export const SORTEER_LABELS: Record<Sortering, string> = {
  vers: "Nieuwste",
  cijfer: "Best beoordeeld",
  rust: "Lang niet gemaakt",
};

export function leesSortering(waarde: string | string[] | undefined): Sortering {
  const eerste = Array.isArray(waarde) ? waarde[0] : waarde;
  return SORTERINGEN.includes(eerste as Sortering) ? (eerste as Sortering) : "vers";
}

type Rij = {
  id: string;
  title: string;
  favorite: boolean;
  createdAt: Date;
};

/**
 * De cijfers en de laatste keer dat er gekookt is, allebei als losse kaart.
 *
 * Niet als velden op de rij: het overzicht haalt de recepten op zonder hun
 * kooklog, en die er alleen voor het sorteren bij slepen zou betekenen dat elke
 * weergave alle kookregels van de hele collectie meeneemt.
 */
export type Kennis = {
  cijfers: Map<string, number>;
  laatst: Map<string, Date>;
};

/**
 * De lijst in de gevraagde volgorde.
 *
 * Favorieten staan bovenaan bij "nieuwste" — dat was de bestaande volgorde en
 * die blijft — maar níét bij de andere twee. Vraag je om het best beoordeelde,
 * dan is een favoriet zonder sterren geen antwoord op je vraag.
 *
 * Een recept dat nog nooit gemaakt is telt bij "lang niet gemaakt" mee vanaf de
 * dag dat het binnenkwam. Zonder dat zou de hele collectie ongemaakte recepten
 * bovenaan blijven staan, en dat is precies de lijst die je al had.
 */
export function sorteer<T extends Rij>(
  rijen: readonly T[],
  op: Sortering,
  kennis: Kennis,
): T[] {
  const uit = [...rijen];

  if (op === "cijfer") {
    return uit.sort(
      (a, b) =>
        (kennis.cijfers.get(b.id) ?? -1) - (kennis.cijfers.get(a.id) ?? -1) ||
        a.title.localeCompare(b.title, "nl"),
    );
  }

  if (op === "rust") {
    const wanneer = (rij: T): number =>
      (kennis.laatst.get(rij.id) ?? rij.createdAt).getTime();
    return uit.sort(
      (a, b) => wanneer(a) - wanneer(b) || a.title.localeCompare(b.title, "nl"),
    );
  }

  return uit.sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}
