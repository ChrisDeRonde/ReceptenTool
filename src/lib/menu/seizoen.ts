/**
 * Wat er deze maand op zijn best is.
 *
 * Een korte, Nederlandse lijst: wat je in de supermarkt en op de markt uit de
 * volle grond kunt krijgen. Niet uitputtend en dat hoeft ook niet — het is een
 * duwtje in de voorstellen, geen inkoopsysteem. Alles is het hele jaar te koop;
 * de vraag is wanneer het de moeite waard is.
 *
 * Alleen belonen, nooit straffen. Een recept met tomaten in december zakt niet:
 * dan zou de motor gaan vertellen wat je niet mag eten, en dat is niet zijn
 * werk. Wat wél in het seizoen zit, komt bovendrijven — dat is genoeg.
 *
 * De namen staan in enkelvoud en kleine letters, zoals `canonicalName` ze
 * oplevert, zodat ze aansluiten op de ingrediëntwoorden van een recept.
 */

/** Per maand (0 = januari), wat er dan uit Nederland komt. */
const PER_MAAND: readonly (readonly string[])[] = [
  // januari
  ["boerenkool", "spruitje", "witlof", "prei", "pastinaak", "knolselderij", "rode kool", "winterpeen", "veldsla", "mandarijn"],
  // februari
  ["boerenkool", "spruitje", "witlof", "prei", "pastinaak", "knolselderij", "rode kool", "winterpeen", "veldsla"],
  // maart
  ["prei", "witlof", "spinazie", "rabarber", "radijs", "veldsla", "pastinaak"],
  // april
  ["asperge", "rabarber", "spinazie", "radijs", "postelein", "bleekselderij", "raapstelen"],
  // mei
  ["asperge", "aardbei", "rabarber", "spinazie", "doperwt", "tuinboon", "radijs", "bloemkool"],
  // juni
  ["aardbei", "doperwt", "tuinboon", "courgette", "bloemkool", "sperzieboon", "kers", "bosbes", "komkommer", "venkel"],
  // juli
  ["courgette", "tomaat", "paprika", "aubergine", "sperzieboon", "snijboon", "abrikoos", "framboos", "bosbes", "kers", "komkommer"],
  // augustus
  ["tomaat", "courgette", "aubergine", "paprika", "mais", "pruim", "perzik", "braam", "snijboon", "andijvie", "komkommer"],
  // september
  ["pompoen", "prei", "appel", "peer", "druif", "paddenstoel", "champignon", "pruim", "mais", "spinazie", "andijvie", "biet"],
  // oktober
  ["pompoen", "appel", "peer", "paddenstoel", "champignon", "boerenkool", "prei", "knolselderij", "spruitje", "pastinaak", "biet", "witlof"],
  // november
  ["boerenkool", "spruitje", "pompoen", "prei", "witlof", "knolselderij", "pastinaak", "rode kool", "peer", "winterpeen"],
  // december
  ["boerenkool", "spruitje", "witlof", "prei", "rode kool", "knolselderij", "pastinaak", "winterpeen", "mandarijn"],
];

/** Wat er in de maand van deze datum in het seizoen zit. */
export function seizoensproducten(datum: Date): readonly string[] {
  return PER_MAAND[datum.getMonth()] ?? [];
}

/** De maandnaam, voor in de reden onder een voorstel. */
export function maandNaam(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", { month: "long" });
}
