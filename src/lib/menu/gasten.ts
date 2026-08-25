/**
 * Wat gasten met het aantal porties doen.
 *
 * Apart en puur, want de regel is subtieler dan hij lijkt en je wilt hem
 * kunnen vastleggen: de porties schuiven mee met het aantal gasten, maar
 * alléén zolang je ze niet zelf hebt gekozen. Doe je dat wel, dan is dat een
 * beslissing — je kookt dubbel om in te vriezen — en die hoort een uitnodiging
 * niet te overschrijven.
 */

/**
 * Volgen de porties nog vanzelf?
 *
 * `null` telt als "niet gezet". Dat betekent in de database "zoals het recept
 * het bedoelde", en wie twee gasten uitnodigt bedoelt niet meer wat het recept
 * bedoelde. Zonder deze regel bleef een avond met drie gasten op twee porties
 * staan — en dat merk je pas als de boodschappen binnen zijn.
 */
export function portiesVolgenNog(
  porties: number | null,
  gastenNu: number,
  huishouden: number,
): boolean {
  if (porties === null) return true;
  return porties === huishouden + gastenNu;
}

/** Waar de porties naartoe gaan als ze nog volgen. */
export function nieuwePorties(
  huishouden: number,
  gasten: number,
  max: number,
): number {
  return Math.min(huishouden + gasten, max);
}
