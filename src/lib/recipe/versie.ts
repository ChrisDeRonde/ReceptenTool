/**
 * Botst deze bewerking met een andere?
 *
 * Met twee mensen op twee telefoons kan dit: jullie openen allebei hetzelfde
 * recept, jij haalt er een teen knoflook bij, zij schrijft een stap om, en wie
 * als tweede op opslaan tikt gooit het werk van de ander weg. Zonder melding,
 * want de app had geen idee.
 *
 * De oplossing is een versie meesturen. Het formulier krijgt bij het openen mee
 * wanneer het recept voor het laatst is bijgewerkt; klopt dat bij het opslaan
 * niet meer met wat er in de database staat, dan is er iemand tussen geweest.
 *
 * `editedAt` en niet `updatedAt`: die laatste verspringt ook als iemand het
 * recept alleen maar favoriet maakt, en dan zou je een botsing melden waar
 * niets botst. Een hartje is geen bewerking.
 */

/**
 * @param uitFormulier Wat het formulier meestuurde: een ISO-tijd, of een lege
 *   tekst als het recept toen nog nooit was bijgewerkt.
 * @param huidig Wat er nú in de database staat.
 */
export function isVerouderd(uitFormulier: string | null, huidig: Date | null): boolean {
  // Veld ontbreekt helemaal — een oude pagina uit de cache, of een verzoek van
  // buiten het formulier om. Dan is er niets te vergelijken, en iemand
  // tegenhouden op grond van niets is erger dan de botsing zelf.
  if (uitFormulier === null) return false;

  return uitFormulier !== versieVan(huidig);
}

/** De versie zoals hij in het formulier komt te staan. */
export function versieVan(bewerktOp: Date | null | undefined): string {
  return bewerktOp ? bewerktOp.toISOString() : "";
}
