import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { maandNaam, seizoensproducten } from "@/lib/menu/seizoen";
import { DIET_HINTS, type Diet } from "@/lib/recipe/categories";

/**
 * Iets nieuws om te maken.
 *
 * De rest van de app kijkt naar binnen: het weekmenu stelt voor wat er in je
 * eigen collectie ligt te verstoffen. Deze kijkt naar buiten. Niet naar een
 * receptendatabase — die mag je hun recepten niet laten bewaren, en Klapper
 * bestaat er juist om ze te bewaren — maar naar wat jullie het afgelopen jaar
 * hebben gekookt en gewaardeerd. Daar komt een gerécht uit, met een reden, en
 * een link naar een echte pagina die het model met de webzoek-tool heeft
 * gevonden.
 *
 * **Het model verzint hier geen recept.** Het noemt een gerecht en levert een
 * bron aan; die link gaat daarna door dezelfde importmolen als alles wat je
 * deelt vanuit Instagram of de AH-app. Dat is niet een technisch detail maar de
 * afspraak uit de importprompt, en die geldt hier net zo goed: wat er in de
 * collectie komt, komt uit een bron.
 */

export type Idee = {
  /** Het gerecht, zoals je het zou intypen. */
  gerecht: string;
  /** Waarom dit, in één regel, met jullie eigen kooklog erin. */
  waarom: string;
  /** Een bestaande receptpagina, of null als het model er geen vond. */
  url: string | null;
  /** Hoe die site heet. */
  bron: string | null;
};

/** Wat er in de instelling staat opgeslagen, zodat de pagina niet elke keer betaalt. */
export type Ideeenblad = {
  /** Wanneer het opgehaald is, ISO. */
  opgehaald: string;
  ideeen: Idee[];
  /** Ging het mis, dan staat hier wat — en blijft de vorige oogst staan. */
  fout?: string;
};

export type Gemaakt = {
  title: string;
  cuisine: string | null;
  cookedAt: Date;
  rating: number | null;
  again: boolean | null;
  who: string | null;
};

export type IdeeInput = {
  /** Wat er de afgelopen tijd op tafel stond, nieuwste eerst. */
  gemaakt: Gemaakt[];
  /** Titels die al in de collectie staan; die hoeft het model niet te noemen. */
  bekend: string[];
  /** Waar het gerecht aan moet voldoen. */
  dieet: Diet[];
  /** Wat er niet in mag zitten. */
  afkeer: string[];
  /** Voor hoeveel mensen. */
  huishouden: number;
  vandaag: Date;
  /** Hoeveel ideeën je terug wilt. */
  aantal?: number;
};

const IDEEEN_STANDAARD = 4;

/** Verder terugkijken dan dit voegt niets toe en maakt de prompt alleen groot. */
const KOOKLOG_MAX = 40;

/** Genoeg om dubbelingen te voorkomen, kort genoeg om te versturen. */
const BEKEND_MAX = 200;

const ideeSchema = z.object({
  gerecht: z.string(),
  waarom: z.string(),
  url: z.string().nullable(),
  bron: z.string().nullable(),
});

const antwoordSchema = z.object({ ideeen: z.array(ideeSchema) });

const antwoordJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ideeen"],
  properties: {
    ideeen: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gerecht", "waarom", "url", "bron"],
        properties: {
          gerecht: { type: "string" },
          waarom: { type: "string" },
          url: { type: ["string", "null"] },
          bron: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

/**
 * Hoe vaak we een onderbroken zoekronde hervatten.
 *
 * Een grens en geen `while (true)`: elke ronde kost tijd en geld, en een model
 * dat blijft zoeken hoort ergens tegen een muur te lopen in plaats van de
 * pagina vier minuten per ronde te laten wachten.
 */
const PAUZE_MAX = 4;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY ontbreekt in de omgeving.");
    }
    client = new Anthropic();
  }
  return client;
}

export async function bedenkIdeeen(input: IdeeInput): Promise<Idee[]> {
  const aantal = input.aantal ?? IDEEEN_STANDAARD;

  // Streamend, en dat is hier geen overdaad: adaptief denken plus acht
  // zoekopdrachten kan minuten duren, en een gewone `create` van die lengte
  // loopt tegen de verzoektijd aan. `finalMessage()` geeft daarna hetzelfde
  // bericht terug als een niet-streamende aanroep, dus de rest verandert niet.
  const params = {
    model: process.env.RECIPE_MODEL ?? "claude-opus-5",
    // Ruim, want denken, zoekopdrachten én het samenvatten van wat er gevonden
    // is komen allemaal uit dit ene budget. Op achtduizend haalde een zoektocht
    // langs zes pagina's het einde niet, en dan is de hele — betaalde —
    // aanroep weg met "het zoeken liep vast".
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    system: systeemPrompt(aantal),
    // De webzoek-tool draait aan de kant van de API: er komt geen ronde langs
    // ons terug, we krijgen het eindantwoord. Het plafond staat er omdat een
    // zoektocht anders kan doorlopen tot de tokens op zijn.
    tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 8 }],
    output_config: {
      format: { type: "json_schema" as const, schema: antwoordJsonSchema },
    },
  };

  const berichten: Anthropic.MessageParam[] = [
    { role: "user", content: gebruikersBericht(input, aantal) },
  ];

  let response!: Anthropic.Message;

  // Een lange zoekronde wordt door de API onderbroken met `pause_turn`: dat is
  // geen fout maar een verzoek om verder te gaan. Sturen we de afgebroken beurt
  // niet terug, dan pakken we het laatste tekstblok — "ik zoek nu naar…" — en
  // struikelt `JSON.parse` erover, met een melding die nergens naar wijst.
  for (let ronde = 0; ronde < PAUZE_MAX; ronde += 1) {
    const stroom = getClient().messages.stream(
      { ...params, messages: berichten },
      { timeout: 4 * 60 * 1000 },
    );
    response = await stroom.finalMessage();

    if (response.stop_reason !== "pause_turn") break;
    berichten.push({ role: "assistant", content: response.content });
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Het model heeft deze vraag geweigerd.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Het zoeken liep vast voordat er een antwoord kwam.");
  }
  if (response.stop_reason === "pause_turn") {
    throw new Error("Het zoeken bleef te lang doorgaan.");
  }

  // Met een servertool erbij staan er eerst zoekopdrachten en zoekresultaten in
  // het antwoord; de JSON is het láátste tekstblok. Vandaar achteraan beginnen
  // in plaats van `find`.
  const tekst = [...response.content]
    .reverse()
    .find((block) => block.type === "text");
  if (!tekst || tekst.type !== "text") {
    throw new Error("Het model gaf geen tekstantwoord terug.");
  }

  let json: unknown;
  try {
    json = JSON.parse(tekst.text);
  } catch {
    throw new Error("Het antwoord van het model was geen geldige JSON.");
  }

  const gelezen = antwoordSchema.safeParse(json);
  if (!gelezen.success) {
    throw new Error("Het antwoord had niet de afgesproken vorm.");
  }

  return gelezen.data.ideeen.map(schoonIdee).slice(0, aantal);
}

/**
 * Een verzonnen of half overgetypte URL is erger dan geen URL: dan tikt iemand
 * op "toevoegen" en krijgt hij een mislukte import zonder te weten waarom. Wat
 * geen gewone http-link is, gooien we hier weg.
 */
function schoonIdee(idee: z.infer<typeof ideeSchema>): Idee {
  let url: string | null = null;
  try {
    const adres = idee.url ? new URL(idee.url) : null;
    if (adres && (adres.protocol === "https:" || adres.protocol === "http:")) {
      url = adres.toString();
    }
  } catch {
    // Geen geldige URL: dan blijft het een idee zonder bron, en dat mag.
  }

  return {
    gerecht: idee.gerecht.trim(),
    waarom: idee.waarom.trim(),
    url,
    bron: idee.bron?.trim() || null,
  };
}

/**
 * Een fout van de API in een zin die iets zegt.
 *
 * De SDK gooit de rauwe JSON van het antwoord mee in `message`. Dat hoort in
 * een logboek, niet op een pagina waar iemand op een knop stond te wachten:
 * "401 {"type":"error"…}" vertelt niet wat je eraan kunt doen.
 */
export function leesbareFout(fout: unknown): string {
  const status =
    typeof fout === "object" && fout !== null && "status" in fout
      ? Number((fout as { status: unknown }).status)
      : null;

  if (status === 401 || status === 403) {
    return "De API-sleutel wordt niet geaccepteerd. Kijk of ANTHROPIC_API_KEY nog klopt.";
  }
  if (status === 429) return "Te veel aanvragen achter elkaar. Probeer het straks nog eens.";
  if (status !== null && status >= 500) return "De API deed het even niet. Probeer het nog eens.";
  if (fout instanceof Error && fout.name === "APIConnectionTimeoutError") {
    return "Het zoeken duurde te lang. Probeer het nog eens.";
  }
  if (fout instanceof Error && !/^\d{3}\s/.test(fout.message)) return fout.message;
  return "Het ophalen mislukte.";
}

function systeemPrompt(aantal: number): string {
  const dieetuitleg = Object.entries(DIET_HINTS)
    .map(([naam, uitleg]) => `- ${naam}: ${uitleg}`)
    .join("\n");

  return `Je stelt ${aantal} gerechten voor aan een Nederlands huishouden dat een eigen receptenverzameling bijhoudt. Je krijgt hun kooklog: wat ze maakten, wanneer, en wat ze ervan vonden.

Wat je oplevert, per gerecht:
- gerecht: de naam van het gerecht, zoals een Nederlandse thuiskok het zou noemen. Geen Engelse titel als er een gewoon Nederlands woord voor is.
- waarom: één zin, gericht aan hén, met iets uit hun eigen log erin. "Jullie gaven de citroenpasta vijf sterren en eten al zes weken geen vis" is goed. "Een lekker en gezond gerecht" is waardeloos — dat had je zonder hun log ook kunnen schrijven.
- url: de directe link naar een bestaande receptpagina voor dit gerecht, gevonden met de webzoek-tool.
- bron: hoe die site heet.

Over de link:
- Zoek er echt naar. Schrijf nooit een URL op die je niet in een zoekresultaat hebt gezien — ook niet als hij logisch lijkt.
- Nederlandstalige bronnen hebben de voorkeur: Allerhande, Leuke Recepten, 24Kitchen, Jumbo, Dagelijkse Kost, foodblogs. Een Engelstalige pagina mag als er niets Nederlands is.
- Kies een pagina met een echt recept erop, geen overzichtspagina, geen categoriepagina, geen zoekresultaat.
- Vind je niets bruikbaars, zet url dan op null en houd het idee. Een gerecht zonder link is nog steeds een idee; een verzonnen link is een kapotte knop.

Wat je voorstelt:
- Iets dat nog niet in hun collectie staat. De titels krijg je mee.
- Iets dat past bij wat ze blijkbaar lekker vinden, maar niet een variant op wat ze vorige week aten. Ze vragen dit juist om uit de sleur te komen.
- Gerechten die een thuiskok op een doordeweekse avond aankan, tenzij uit de log blijkt dat ze van uitgebreid koken houden.
- Varieer over de ${aantal}: niet vier keer pasta.

Dieet — dit is een harde grens, geen voorkeur:
${dieetuitleg}
Krijg je een dieet mee, dan voldoet elk voorstel eraan. Krijg je ingrediënten mee die er niet in mogen, dan zit dat ingrediënt in geen enkel voorstel — ook niet als bijgerecht of garnering.`;
}

function gebruikersBericht(input: IdeeInput, aantal: number): string {
  const delen: string[] = [];

  const gemaakt = input.gemaakt.slice(0, KOOKLOG_MAX);
  if (gemaakt.length > 0) {
    delen.push(
      "Wat er de laatste tijd op tafel stond, nieuwste eerst:",
      gemaakt.map(regelVoorGemaakt).join("\n"),
    );
  } else {
    delen.push("Er is nog geen kooklog: ze zijn net begonnen.");
  }

  if (input.bekend.length > 0) {
    delen.push(
      "Dit staat al in hun collectie, dus stel het niet voor:",
      input.bekend.slice(0, BEKEND_MAX).join(", "),
    );
  }

  if (input.dieet.length > 0) {
    delen.push(`Elk voorstel moet zijn: ${input.dieet.join(", ")}.`);
  }
  if (input.afkeer.length > 0) {
    delen.push(`Deze ingrediënten mogen er in geen enkel voorstel in: ${input.afkeer.join(", ")}.`);
  }

  const seizoen = seizoensproducten(input.vandaag);
  delen.push(
    `Het is ${maandNaam(input.vandaag)}. Uit de volle grond komt nu onder meer: ${seizoen.join(", ")}. Dat hoeft niet, maar het telt mee.`,
    `Ze koken meestal voor ${input.huishouden} ${input.huishouden === 1 ? "persoon" : "personen"}.`,
    `Geef ${aantal} voorstellen.`,
  );

  return delen.join("\n\n");
}

function regelVoorGemaakt(keer: Gemaakt): string {
  const delen = [
    keer.cookedAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }),
    keer.title,
    keer.cuisine,
    keer.rating !== null ? `${keer.rating}/5` : null,
    keer.again === true ? "wil vaker" : keer.again === false ? "niet meer" : null,
    keer.who,
  ].filter(Boolean);
  return `- ${delen.join(" · ")}`;
}
