/**
 * Hoe lang een recept bij jullie werkelijk duurt.
 *
 * De bron schat, en die schatting is er bijna altijd naast — meestal te
 * optimistisch, want wie een recept schrijft snijdt zijn ui sneller dan wie het
 * voor het eerst leest. Na twee of drie keer koken weet de app het beter dan
 * het recept, en dan hoort hij dat ook te zeggen.
 *
 * Puur, zodat de rekenregel te testen is zonder database.
 */

/**
 * Vanaf hoeveel metingen we er iets over durven zeggen.
 *
 * Eén keer is geen gemiddelde. Je kunt die ene keer de deurbel hebben gehad,
 * of net alles al klaar hebben staan; daar een zin over "bij jullie duurt dit"
 * op bouwen is een bewering die je na de tweede keer weer moet intrekken.
 */
export const GENOEG_METINGEN = 2;

/**
 * Vanaf hoeveel procent verschil het de moeite van het melden waard is.
 *
 * Vijf minuten op een uur is ruis. Twintig minuten op een half uur is het
 * verschil tussen op tijd eten en om negen uur beginnen.
 */
const OPVALLEND = 0.2;

export type Duur = {
  /** De mediaan van wat er gemeten is, in minuten. */
  minuten: number;
  /** Hoeveel keer er een tijd is ingevuld. */
  metingen: number;
  /** Wijkt dit genoeg af van de bron om te melden? */
  opvallend: boolean;
};

/**
 * De mediaan en niet het gemiddelde.
 *
 * Eén keer waarop je halverwege boodschappen moest doen trekt een gemiddelde
 * scheef en laat de mediaan met rust. Bij drie metingen is dat het verschil
 * tussen een bruikbaar getal en een onzingetal.
 */
export function werkelijkeDuur(
  minuten: readonly (number | null)[],
  volgensBron: number | null,
): Duur | null {
  const gemeten = minuten
    .filter((m): m is number => typeof m === "number" && m > 0)
    .sort((a, b) => a - b);

  if (gemeten.length < GENOEG_METINGEN) return null;

  const midden = Math.floor(gemeten.length / 2);
  const mediaan =
    gemeten.length % 2 === 1
      ? gemeten[midden]
      : Math.round((gemeten[midden - 1] + gemeten[midden]) / 2);

  const opvallend =
    volgensBron !== null &&
    volgensBron > 0 &&
    Math.abs(mediaan - volgensBron) / volgensBron >= OPVALLEND;

  return { minuten: mediaan, metingen: gemeten.length, opvallend };
}

/** "meestal 45 min" of "meestal 1 u 15". */
export function duurTekst(minuten: number): string {
  if (minuten < 60) return `${minuten} min`;
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest === 0 ? `${uren} u` : `${uren} u ${rest}`;
}
