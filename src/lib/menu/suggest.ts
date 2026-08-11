/**
 * Wat zullen we deze week eten?
 *
 * Niet "wat is het lekkerst" — dan krijg je elke week hetzelfde. De vraag is
 * wat er ligt te verstoffen dat jullie eigenlijk goed vonden. Drie signalen,
 * met dat in gedachten:
 *
 *  - **rust**: hoe lang is het geleden. Dit weegt het zwaarst; een lijst die
 *    alleen op waardering sorteert is een lijst van vijf keer hetzelfde.
 *  - **waardering**: wat jullie ervan vonden, en of iemand "vaker" zei.
 *  - **afwisseling**: staat er al iets uit dezelfde keuken op het menu, dan
 *    zakt het. Zeven dagen pasta is geen weekmenu.
 *
 * Elk voorstel draagt zijn reden mee. Een suggestie zonder uitleg is een
 * gokautomaat, en die vertrouw je na twee keer niet meer.
 *
 * Pure functie, zonder database ernaast, zodat de afweging te testen is.
 */

export type Kandidaat = {
  id: string;
  title: string;
  cuisine: string | null;
  favorite: boolean;
  /** Wanneer het in de collectie kwam. */
  createdAt: Date;
  /** De dagen waarop het gemaakt is, in willekeurige volgorde. */
  cookedAt: Date[];
  /** De gegeven sterren, zonder de keren dat niemand iets zei. */
  ratings: number[];
  /** Hoe vaak iemand "vaker eten" aanvinkte, en hoe vaak niet. */
  again: { yes: number; no: number };
};

export type Voorstel = {
  id: string;
  title: string;
  /** Waarom dit voorstel er staat, in één regel. */
  reason: string;
  score: number;
};

/** Nooit gemaakt, maar wel al even in huis: dan telt het als lang geleden. */
const NOOIT_GEMAAKT_DAGEN = 60;

/** Boven deze grens maakt langer geleden niet meer uit. */
const RUST_TOP = 90;

export function suggest(
  kandidaten: Kandidaat[],
  opties: {
    /** Recepten die deze week al gepland staan; die doen niet mee. */
    gepland: Array<{ id: string; cuisine: string | null }>;
    vandaag: Date;
    /** Hoeveel voorstellen je terug wilt. */
    aantal?: number;
  },
): Voorstel[] {
  const geplandeIds = new Set(opties.gepland.map((r) => r.id));
  const geplandeKeukens = new Set(
    opties.gepland.map((r) => r.cuisine).filter((c): c is string => Boolean(c)),
  );

  const voorstellen: Voorstel[] = [];

  for (const kandidaat of kandidaten) {
    if (geplandeIds.has(kandidaat.id)) continue;

    const dagenGeleden = laatstGemaakt(kandidaat, opties.vandaag);
    const gemiddelde = kandidaat.ratings.length
      ? kandidaat.ratings.reduce((som, r) => som + r, 0) / kandidaat.ratings.length
      : null;

    // Iets waar iedereen "nee, niet vaker" bij zette hoort niet voorgesteld te
    // worden. Dat is geen lage score maar een antwoord.
    if (kandidaat.again.no > 0 && kandidaat.again.yes === 0) continue;

    let score = Math.min(dagenGeleden, RUST_TOP);
    if (gemiddelde !== null) score += (gemiddelde - 3) * 12;
    if (kandidaat.again.yes > 0) score += 20;
    if (kandidaat.favorite) score += 10;
    if (kandidaat.cuisine && geplandeKeukens.has(kandidaat.cuisine)) score -= 45;

    voorstellen.push({
      id: kandidaat.id,
      title: kandidaat.title,
      reason: reden(kandidaat, dagenGeleden, gemiddelde),
      score: Math.round(score),
    });
  }

  return voorstellen
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "nl"))
    .slice(0, opties.aantal ?? 3);
}

/**
 * Hoeveel dagen geleden voor het laatst.
 *
 * Nooit gemaakt telt als lang geleden, maar niet als oneindig: iets dat je
 * gisteren opsloeg heeft nog geen achterstand, iets van vorig jaar wel.
 */
function laatstGemaakt(kandidaat: Kandidaat, vandaag: Date): number {
  const dag = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const nu = dag(vandaag);
  const dagen = (toen: number) => Math.max(0, Math.round((nu - toen) / 86_400_000));

  if (kandidaat.cookedAt.length === 0) {
    return Math.min(dagen(dag(kandidaat.createdAt)), NOOIT_GEMAAKT_DAGEN);
  }
  return dagen(Math.max(...kandidaat.cookedAt.map(dag)));
}

/** De sterkste reden in gewone taal. */
function reden(kandidaat: Kandidaat, dagenGeleden: number, gemiddelde: number | null): string {
  if (kandidaat.cookedAt.length === 0) {
    return "Nog nooit gemaakt";
  }
  if (kandidaat.again.yes > 0 && dagenGeleden >= 21) {
    return `Wilden jullie vaker, en het is ${periode(dagenGeleden)} geleden`;
  }
  if (gemiddelde !== null && gemiddelde >= 4.5) {
    return `Hoog gewaardeerd, ${periode(dagenGeleden)} geleden`;
  }
  if (kandidaat.again.yes > 0) {
    return "Wilden jullie vaker eten";
  }
  return `${hoofdletter(periode(dagenGeleden))} geleden`;
}

function periode(dagen: number): string {
  if (dagen <= 1) return "gisteren";
  if (dagen < 14) return `${dagen} dagen`;
  if (dagen < 60) return `${Math.round(dagen / 7)} weken`;
  return `${Math.round(dagen / 30)} maanden`;
}

function hoofdletter(tekst: string): string {
  return tekst.charAt(0).toLocaleUpperCase("nl-NL") + tekst.slice(1);
}
