/**
 * Wat zullen we deze week eten?
 *
 * Niet "wat is het lekkerst" — dan krijg je elke week hetzelfde. De vraag is
 * wat er ligt te verstoffen dat jullie eigenlijk goed vonden. De signalen, met
 * dat in gedachten:
 *
 *  - **rust**: hoe lang is het geleden. Dit weegt het zwaarst; een lijst die
 *    alleen op waardering sorteert is een lijst van vijf keer hetzelfde.
 *  - **waardering**: wat jullie ervan vonden, en of iemand "vaker" zei.
 *  - **afwisseling**: staat er al iets uit dezelfde keuken op het menu, dan
 *    zakt het. Zeven dagen pasta is geen weekmenu.
 *  - **wat er ligt**: heb je in de koelkast gekeken en een paar dingen
 *    ingetypt, dan komt bovendrijven wat die gebruikt.
 *  - **seizoen**: wat er déze maand op zijn best is, krijgt een duwtje.
 *
 * En twee harde grenzen, die niet meewegen maar uitsluiten: wat niemand van de
 * aanwezigen mag eten valt af, en wat iedereen "niet meer" gaf ook.
 *
 * Elk voorstel draagt zijn reden mee. Een suggestie zonder uitleg is een
 * gokautomaat, en die vertrouw je na twee keer niet meer.
 *
 * Pure functie, zonder database ernaast, zodat de afweging te testen is.
 */

import { seizoensproducten } from "@/lib/menu/seizoen";
import { bevatTerm } from "@/lib/recipe/search";
import { dagenTussen, geleden, geledenAchteraan, hoofdletter } from "@/lib/tijd";
import { magOpTafel } from "@/lib/voorkeuren";
import type { Diet } from "@/lib/recipe/categories";

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
  /** Wat het model uit de ingrediënten afleidde. Leeg is: niets vastgesteld. */
  diets?: Diet[];
  /** De losse woorden uit de ingrediëntnamen, zoals `buildHaystack` ze geeft. */
  ingredientWoorden?: string[];
};

export type Voorstel = {
  id: string;
  title: string;
  /** Waarom dit voorstel er staat, in één regel. */
  reason: string;
  score: number;
  /** Hoeveel van je "wat ligt er in huis" dit recept afdekt. */
  treffers: number;
};

export type Wensen = {
  /** Kenmerken waar het gerecht aan moet voldoen. Leeg is: alles mag. */
  dieet?: Diet[];
  /** Ingrediënten die er niet in mogen zitten. */
  afkeer?: string[];
};

/** Nooit gemaakt, maar wel al even in huis: dan telt het als lang geleden. */
const NOOIT_GEMAAKT_DAGEN = 60;

/** Boven deze grens maakt langer geleden niet meer uit. */
const RUST_TOP = 90;

/** Zit er iets in dat déze maand op zijn best is. */
const SEIZOEN_BONUS = 18;

export function suggest(
  kandidaten: Kandidaat[],
  opties: {
    /** Recepten die deze week al gepland staan; die doen niet mee. */
    gepland: Array<{ id: string; cuisine: string | null }>;
    vandaag: Date;
    /** Hoeveel voorstellen je terug wilt. */
    aantal?: number;
    /** Wat de aanwezigen wel en niet eten. */
    wensen?: Wensen;
    /** Wat er in de koelkast ligt, in jouw woorden. */
    inHuis?: string[];
    /** Het seizoen meewegen. Standaard aan; uit maakt de uitkomst voorspelbaar. */
    seizoen?: boolean;
  },
): Voorstel[] {
  const geplandeIds = new Set(opties.gepland.map((r) => r.id));
  const geplandeKeukens = new Set(
    opties.gepland.map((r) => r.cuisine).filter((c): c is string => Boolean(c)),
  );

  const gevraagd = {
    dieet: opties.wensen?.dieet ?? [],
    afkeer: opties.wensen?.afkeer ?? [],
  };
  const inHuis = opties.inHuis ?? [];
  const seizoen =
    opties.seizoen === false ? [] : seizoensproducten(opties.vandaag);

  const voorstellen: Voorstel[] = [];

  for (const kandidaat of kandidaten) {
    if (geplandeIds.has(kandidaat.id)) continue;

    const woorden = kandidaat.ingredientWoorden ?? [];

    // Wat er niet op tafel mag, hoort niet in de lijst — ook niet onderaan.
    // Een voorstel dat je elke week moet wegkijken is erger dan geen voorstel.
    if (!magOpTafel({ diets: kandidaat.diets ?? [], ingredientWoorden: woorden }, gevraagd)) {
      continue;
    }

    // Iets waar iedereen "nee, niet vaker" bij zette hoort niet voorgesteld te
    // worden. Dat is geen lage score maar een antwoord.
    if (kandidaat.again.no > 0 && kandidaat.again.yes === 0) continue;

    const dagenGeleden = laatstGemaakt(kandidaat, opties.vandaag);
    const gemiddelde = kandidaat.ratings.length
      ? kandidaat.ratings.reduce((som, r) => som + r, 0) / kandidaat.ratings.length
      : null;

    const gebruikt = inHuis.filter((term) => bevatTerm(woorden, term));
    const inSeizoen = seizoen.filter((product) => bevatTerm(woorden, product));

    let score = Math.min(dagenGeleden, RUST_TOP);
    if (gemiddelde !== null) score += (gemiddelde - 3) * 12;
    if (kandidaat.again.yes > 0) score += 20;
    if (kandidaat.favorite) score += 10;
    if (kandidaat.cuisine && geplandeKeukens.has(kandidaat.cuisine)) score -= 45;
    if (inSeizoen.length > 0) score += SEIZOEN_BONUS;

    voorstellen.push({
      id: kandidaat.id,
      title: kandidaat.title,
      reason: reden(kandidaat, {
        dagenGeleden,
        gemiddelde,
        gebruikt,
        inSeizoen,
      }),
      score: Math.round(score),
      treffers: gebruikt.length,
    });
  }

  // Heb je ingetypt wat er ligt, dan is dát de vraag, en gaat het aantal
  // treffers vóór de score. Dezelfde volgorde als bij zoeken op het overzicht:
  // eerst wat al je woorden afdekt, dan wat er een paar heeft. Als bonuspunten
  // zou het niet werken — een recept dat je drie ingrediënten gebruikt maar
  // vorige week op tafel stond, verliest dan alsnog van iets van drie maanden
  // geleden waar niets van in huis is, en dat is precies het antwoord dat je
  // niet zocht.
  return voorstellen
    .sort(
      (a, b) =>
        b.treffers - a.treffers ||
        b.score - a.score ||
        a.title.localeCompare(b.title, "nl"),
    )
    .slice(0, opties.aantal ?? 3);
}

/**
 * Hoeveel dagen geleden voor het laatst.
 *
 * Nooit gemaakt telt als lang geleden, maar niet als oneindig: iets dat je
 * gisteren opsloeg heeft nog geen achterstand, iets van vorig jaar wel.
 */
function laatstGemaakt(kandidaat: Kandidaat, vandaag: Date): number {
  if (kandidaat.cookedAt.length === 0) {
    return Math.min(dagenTussen(kandidaat.createdAt, vandaag), NOOIT_GEMAAKT_DAGEN);
  }
  return Math.min(...kandidaat.cookedAt.map((toen) => dagenTussen(toen, vandaag)));
}

/**
 * De sterkste reden in gewone taal.
 *
 * "Wat er ligt" staat bovenaan de ladder: als je net hebt ingetypt wat er in de
 * koelkast staat, is dát je vraag, en elk ander antwoord gaat erover heen.
 */
function reden(
  kandidaat: Kandidaat,
  wat: {
    dagenGeleden: number;
    gemiddelde: number | null;
    gebruikt: string[];
    inSeizoen: string[];
  },
): string {
  if (wat.gebruikt.length > 0) {
    return `Gebruikt ${opsomming(wat.gebruikt)}`;
  }
  if (kandidaat.cookedAt.length === 0) {
    return wat.inSeizoen.length > 0
      ? `Nog nooit gemaakt, en ${opsomming(wat.inSeizoen)} ${wat.inSeizoen.length === 1 ? "is" : "zijn"} nu op zijn best`
      : "Nog nooit gemaakt";
  }
  if (wat.inSeizoen.length > 0) {
    return `${hoofdletter(opsomming(wat.inSeizoen))} ${wat.inSeizoen.length === 1 ? "is" : "zijn"} nu op zijn best`;
  }
  if (kandidaat.again.yes > 0 && wat.dagenGeleden >= 21) {
    return `Wilden jullie vaker, en het is ${geleden(wat.dagenGeleden)}`;
  }
  if (wat.gemiddelde !== null && wat.gemiddelde >= 4.5) {
    return `Hoog gewaardeerd, ${geledenAchteraan(wat.dagenGeleden)}`;
  }
  if (kandidaat.again.yes > 0) {
    return "Wilden jullie vaker eten";
  }
  return hoofdletter(geledenAchteraan(wat.dagenGeleden));
}

/** Hooguit drie noemen: daarna is het geen reden meer maar een lijst. */
function opsomming(woorden: string[]): string {
  const kort = woorden.slice(0, 3);
  if (kort.length === 1) return kort[0];
  return `${kort.slice(0, -1).join(", ")} en ${kort.at(-1)}`;
}
