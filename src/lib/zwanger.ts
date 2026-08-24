/**
 * Wat je tijdens een zwangerschap beter laat staan.
 *
 * **Lees dit voor je hier iets aan verandert.**
 *
 * Dit is de enige plek in de app waar een fout iemand pijn kan doen. Overal
 * anders is een misser hooguit een voorstel dat je wegklikt; hier kan een
 * verkeerde "veilig" iemand iets laten eten dat een zwangerschap schaadt. Dat
 * verandert wat een goed antwoord is:
 *
 *  - **Twijfel is geen `veilig`.** Alles wat niet aantoonbaar op de veilige
 *    lijst staat, krijgt géén etiket. Niets zeggen is eerlijk; "veilig" zeggen
 *    op een gok is dat niet.
 *  - **De regels kijken naar de ingrediëntnaam, niet naar het dieet-etiket.**
 *    Dat etiket komt van het model en is een inschatting. Hier vergelijken we
 *    met wat er letterlijk in het recept staat, net als bij `afkeer`.
 *  - **Verhitten verandert het antwoord.** Rauwmelkse kaas in een ovenschotel
 *    is iets anders dan op een cracker. Zulke regels dragen daarom een
 *    `tenzij`, en die tekst hoort in beeld te blijven — niet weggevouwen.
 *
 * De app blijft een keukenhulpje. Hij ként dit recept niet: hij herkent woorden.
 * Een gerecht waar niets bij staat, is niet goedgekeurd — er is alleen niets
 * herkend. Dat staat ook zo op het scherm, en dat hoort zo te blijven.
 *
 * **De bron.** De indeling volgt het advies van het Voedingscentrum, het
 * Nederlandse instituut dat hierover voorlicht, aangevuld met de NHS (VK) en
 * de Amerikaanse CDC/FDA waar die concreter zijn over grenswaarden. Waar de
 * bronnen elkaar tegenspraken is de voorzichtigste gekozen. De adviezen zelf
 * veranderen soms; `BRON` en `HERZIEN` staan onderaan zodat je kunt zien
 * waartegen dit ooit is aangelegd.
 */

import { bevatIngredient } from "@/lib/recipe/search";
import { canonicalName } from "@/lib/shopping/units";

/** Waar dit tegen is aangelegd, en wanneer. Zie de kop van dit bestand. */
export const BRON = "Voedingscentrum, aangevuld met NHS en CDC/FDA";
export const HERZIEN = "2026-08";

export type Niveau = "onveilig" | "pasop" | "veilig";

export type Regel = {
  niveau: Niveau;
  /** De woorden waarop deze regel aanslaat, zoals ingrediënten worden opgeslagen. */
  termen: string[];
  /** Waarom, in één regel. Staat zo op het scherm. */
  waarom: string;
  /** Wanneer het alsnog mag. Verhitten redt verrassend veel. */
  tenzij?: string;
};

export const NIVEAU_LABEL: Record<Niveau, string> = {
  onveilig: "Niet eten",
  pasop: "Pas op",
  veilig: "Veilig",
};

/**
 * Wat de drie niveaus betekenen, in de woorden die op het scherm staan.
 *
 * "Niet eten" en niet "onveilig": het eerste zegt wat je moet doen, het tweede
 * beschrijft een eigenschap. Aan een keukentafel wil je het eerste.
 */
export const NIVEAU_UITLEG: Record<Niveau, string> = {
  onveilig: "Laat staan zolang het vinkje aanstaat.",
  pasop: "Mag soms wel — het hangt af van de bereiding of de hoeveelheid.",
  veilig: "Hier is niets mis mee; het staat erbij omdat er vaak naar gevraagd wordt.",
};

/**
 * De lijst.
 *
 * Volgorde doet ertoe: de eerste regel die aanslaat wint, dus wat specifiek is
 * staat boven wat algemeen is. "gerookte zalm" moet vóór "zalm" staan, anders
 * krijgt gerookte zalm het groene etiket van gewone zalm.
 */
export const REGELS: Regel[] = [
  // --- Rauw en gedroogd vlees: toxoplasma en listeria -----------------------
  {
    niveau: "onveilig",
    termen: [
      "filet américain", "filet americain", "tartaar", "carpaccio", "rauwe ham",
      "parmaham", "serranoham", "coppa", "ossenworst", "theeworst", "metworst",
      "boerenmetworst", "cervelaat", "salami", "chorizo", "droge worst",
      "rauwe worst", "rosbief rauw",
    ],
    waarom: "Rauw of gedroogd vlees kan toxoplasma of listeria bevatten.",
    tenzij: "Goed doorbakken of meegekookt in een gerecht mag het wel.",
  },
  {
    niveau: "onveilig",
    termen: [
      "lever", "leverworst", "leverpastei", "paté", "pate", "ganzenlever",
      "foie gras",
    ],
    waarom: "Lever zit vol vitamine A, en te veel daarvan schaadt de baby.",
  },

  // --- Rauwmelkse en zachte kazen: listeria --------------------------------
  {
    niveau: "onveilig",
    termen: ["rauwmelkse kaas", "au lait cru", "rauwe melk", "ongepasteuriseerde melk"],
    waarom: "Van rauwe melk; kan listeria bevatten.",
    tenzij: "Staat er 'gepasteuriseerd' op de verpakking, dan mag het wel.",
  },
  {
    niveau: "pasop",
    termen: [
      "brie", "camembert", "roquefort", "gorgonzola", "blauwaderkaas",
      "blauwe kaas", "danish blue", "stilton", "taleggio", "chaource",
    ],
    waarom: "Zachte en blauwe kaas is alleen veilig als hij gepasteuriseerd is.",
    tenzij:
      "Gepasteuriseerd, of tot boven de 70 °C verhit — in een ovenschotel of saus dus wel.",
  },
  {
    niveau: "pasop",
    termen: ["feta", "geitenkaas", "mozzarella", "burrata", "ricotta", "halloumi"],
    waarom: "Kan van rauwe melk zijn; kijk op de verpakking.",
    tenzij: "Gepasteuriseerd of verhit is het geen probleem.",
  },

  // --- Vis: kwik, dioxine, listeria ----------------------------------------
  {
    niveau: "onveilig",
    termen: ["zwaardvis", "haai", "marlijn", "koningsmakreel", "grote oceaanbaars"],
    waarom: "Roofvis met veel kwik; dat verstoort de aanleg van het zenuwstelsel.",
  },
  {
    niveau: "onveilig",
    termen: [
      "gerookte zalm", "gerookte forel", "gerookte makreel", "gerookte paling",
      "rauwe haring", "maatjesharing", "hollandse nieuwe", "sushi", "sashimi",
      "ceviche", "rauwe vis", "oester", "rauwe oesters",
    ],
    waarom: "Rauwe en gerookte vis kan listeria of parasieten bevatten.",
    tenzij: "Meegebakken in de oven of doorverhit kan het wel.",
  },
  {
    niveau: "pasop",
    termen: ["tonijn", "tonijnsteak", "verse tonijn"],
    waarom: "Bevat kwik; hooguit één portie per week.",
  },
  {
    niveau: "pasop",
    termen: ["paling", "sardine", "makreel", "garnaal", "krab", "kreeft", "mossel"],
    waarom: "Kan meer kwik, dioxine of PFAS bevatten; niet te vaak, en goed gaar.",
    tenzij: "Doorverhit en met mate is het geen bezwaar.",
  },

  // --- Rauw ei: salmonella --------------------------------------------------
  {
    niveau: "onveilig",
    termen: [
      "rauw ei", "rauwe eieren", "zachtgekookt ei", "spiegelei zacht",
      "tiramisu", "crème brûlée", "creme brulee", "zelfgemaakte mayonaise",
      "rauwe eidooier", "eiwitschuim rauw", "mousse au chocolat",
    ],
    waarom: "Rauw ei kan salmonella bevatten.",
    tenzij: "Helemaal doorgegaard — een hardgekookt ei of een gebakken cake is prima.",
  },

  // --- Drank ----------------------------------------------------------------
  {
    niveau: "onveilig",
    termen: [
      "alcohol", "wijn", "rode wijn", "witte wijn", "bier", "cognac", "rum",
      "likeur", "sherry", "port", "wodka", "whisky", "calvados", "marsala",
    ],
    waarom: "Er is geen hoeveelheid alcohol waarvan bekend is dat die veilig is.",
    tenzij: "In een gerecht dat lang doorkookt verdampt het grootste deel — maar niet alles.",
  },
  {
    niveau: "pasop",
    termen: ["koffie", "espresso", "cafeïne", "cola", "energiedrank", "zwarte thee", "groene thee"],
    waarom: "Hooguit 200 mg cafeïne per dag, ongeveer twee kopjes koffie.",
  },
  {
    niveau: "pasop",
    termen: ["drop", "zoethout", "sterke kruidenthee", "venkelthee"],
    waarom: "Zoethout in grote hoeveelheden wordt afgeraden.",
  },

  // --- Groente en kruiden ---------------------------------------------------
  {
    niveau: "pasop",
    termen: ["taugé", "tauge", "kiemgroente", "alfalfa", "kiemen"],
    waarom: "Rauwe kiemgroente kan salmonella of listeria bevatten.",
    tenzij: "Kort meebakken of wokken lost het op.",
  },
  // Hier stond een regel voor kaneel, nootmuskaat, salie en lijnzaad. Die is
  // eruit, en dat is een bewuste keuze. Ze worden alleen in medicinale
  // hoeveelheden afgeraden, en in een recept staan ze altijd als keukenkruid —
  // dus de regel sloeg aan op zowat elk baksel om er vervolgens bij te zetten
  // dat het geen probleem was. Een waarschuwing die bijna altijd loos alarm is,
  // leert je oranje te negeren, en daarmee maakt hij de regels die er wél toe
  // doen minder waard. Liever niets zeggen dan ruis maken.

  // --- Wat wél mag ----------------------------------------------------------
  // Alleen dingen waar mensen zich zorgen over maken. Alles groen maken zou de
  // twee rode regels eronder bedelven, en dan is de lijst niets meer waard.
  {
    niveau: "veilig",
    termen: [
      "gouda", "jonge kaas", "belegen kaas", "oude kaas", "cheddar", "parmezaan",
      "pecorino", "emmentaler", "gruyère", "hüttenkäse", "huttenkase",
      "roomkaas", "smeerkaas", "kwark", "yoghurt", "griekse yoghurt",
    ],
    waarom: "Harde en verhitte kaas is veilig; deze zijn van gepasteuriseerde melk.",
  },
  {
    niveau: "veilig",
    termen: [
      "zalm", "kabeljauw", "schol", "schelvis", "forel", "koolvis", "tilapia",
      "pangasius", "victoriabaars",
    ],
    waarom: "Gewone vis, gaar bereid — twee porties per week wordt juist aangeraden.",
  },
  {
    niveau: "veilig",
    termen: ["gekookt ei", "hardgekookt ei", "gebakken ei", "omelet"],
    waarom: "Doorgegaard ei is veilig.",
  },
  {
    // Bewust `pasop` en niet `veilig`. Het hangt volledig aan de bereiding, en
    // juist bij biefstuk en lamsvlees is rosé eerder regel dan uitzondering.
    // "Veilig" naast een biefstuk zetten zou precies de overmoed zijn waar de
    // kop van dit bestand voor waarschuwt.
    niveau: "pasop",
    termen: ["kip", "kipfilet", "rundergehakt", "gehakt", "biefstuk", "varkenshaas", "lamsvlees"],
    waarom: "Alleen helemaal doorbakken — geen rosé of rood van binnen.",
  },
];

export type Bevinding = {
  /** Het ingrediënt zoals het in het recept staat. */
  ingredient: string;
  niveau: Niveau;
  waarom: string;
  tenzij?: string;
};

/**
 * Eén ingrediënt langs de lijst.
 *
 * De eerste regel die aanslaat wint; zie de opmerking bij `REGELS` over
 * volgorde. Niets gevonden is `null` en niet "veilig" — zie de kop.
 */
export function beoordeelIngredient(naam: string): Bevinding | null {
  const schoon = canonicalName(naam);
  if (!schoon) return null;

  for (const regel of REGELS) {
    for (const term of regel.termen) {
      if (bevatIngredient([schoon], canonicalName(term))) {
        return {
          ingredient: naam,
          niveau: regel.niveau,
          waarom: regel.waarom,
          tenzij: regel.tenzij,
        };
      }
    }
  }
  return null;
}

export type Oordeel = {
  onveilig: Bevinding[];
  pasop: Bevinding[];
  veilig: Bevinding[];
  /** Het zwaarste dat gevonden is, of null als er niets herkend werd. */
  zwaarste: Niveau | null;
};

/** Een heel recept langs de lijst. */
export function beoordeelRecept(ingredientNamen: readonly string[]): Oordeel {
  const uit: Oordeel = { onveilig: [], pasop: [], veilig: [], zwaarste: null };

  for (const naam of ingredientNamen) {
    const bevinding = beoordeelIngredient(naam);
    if (bevinding) uit[bevinding.niveau].push(bevinding);
  }

  if (uit.onveilig.length > 0) uit.zwaarste = "onveilig";
  else if (uit.pasop.length > 0) uit.zwaarste = "pasop";
  else if (uit.veilig.length > 0) uit.zwaarste = "veilig";

  return uit;
}

/** Is er iemand in het huishouden voor wie dit telt? */
export function iemandZwanger(
  voorkeuren: Record<string, { zwanger?: boolean }>,
): string[] {
  return Object.entries(voorkeuren)
    .filter(([, voorkeur]) => voorkeur.zwanger === true)
    .map(([naam]) => naam);
}
