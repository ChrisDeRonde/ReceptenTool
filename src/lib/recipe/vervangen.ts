/**
 * Een ingrediënt vervangen door iets dat wél in huis is of wél mag.
 *
 * "Geen crème fraîche" en "Sanne kan geen lactose" zijn dezelfde vraag met een
 * andere aanleiding, en het antwoord hangt in beide gevallen af van wat het
 * ingrediënt in dít gerecht doet. Room in een saus binden is iets anders dan
 * room door een soep roeren, en een lijst standaardvervangingen weet dat
 * verschil niet. Vandaar het model, met het recept erbij.
 *
 * **Wat dit uitdrukkelijk niet is: een allergie-advies.** Een vervanging die
 * "lactosevrij" heet is een suggestie van een taalmodel, geen etiket van een
 * fabrikant. Dat staat ook op het scherm. Voor wie er ziek van wordt blijft de
 * verpakking de bron; hier gaat het om koken, niet om medische zekerheid.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DIET_LABELS, type Diet } from "@/lib/recipe/categories";

export type Vervanging = {
  /** Waarmee, zoals je het op een boodschappenlijst zou schrijven. */
  waarmee: string;
  /** Hoeveel, ten opzichte van het origineel: "evenveel", "de helft". */
  hoeveel: string;
  /** Wat het met het gerecht doet. Eerlijk, ook als het minder wordt. */
  gevolg: string;
};

const antwoordSchema = z.object({
  vervangingen: z.array(
    z.object({
      waarmee: z.string(),
      hoeveel: z.string(),
      gevolg: z.string(),
    }),
  ),
});

const antwoordJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["vervangingen"],
  properties: {
    vervangingen: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["waarmee", "hoeveel", "gevolg"],
        properties: {
          waarmee: { type: "string" },
          hoeveel: { type: "string" },
          gevolg: { type: "string" },
        },
      },
    },
  },
} as const;

/** Meer dan dit is geen antwoord meer maar een boodschappenlijst. */
const HOOGUIT = 3;

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

export type VervangInput = {
  /** Het gerecht, zodat het model weet wat het ingrediënt er doet. */
  gerecht: string;
  /** Het ingrediënt zoals het in het recept staat, inclusief hoeveelheid. */
  ingredient: string;
  /** De stappen waarin het voorkomt. Kort; het gaat om de functie. */
  stappen: string[];
  /** Waaraan de vervanging moet voldoen. Leeg is: iets anders, wat dan ook. */
  dieet: Diet[];
  /** Vrije reden, als die er is: "heb ik niet in huis". */
  reden?: string;
};

export async function bedenkVervangingen(
  input: VervangInput,
): Promise<Vervanging[]> {
  const response = await getClient().messages.create({
    model: process.env.RECIPE_MODEL ?? "claude-opus-5",
    // Klein antwoord, geen zoektocht: dit mag snel zijn. Adaptief denken staat
    // wel aan, want de vraag "wat doet dit ingrediënt hier" is de hele opgave.
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    system: SYSTEEM,
    output_config: { format: { type: "json_schema", schema: antwoordJsonSchema } },
    messages: [{ role: "user", content: bericht(input) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Het model heeft deze vraag geweigerd.");
  }

  const tekst = [...response.content].reverse().find((blok) => blok.type === "text");
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
  if (!gelezen.success) throw new Error("Het antwoord had niet de afgesproken vorm.");

  return gelezen.data.vervangingen
    .filter((v) => v.waarmee.trim().length > 0)
    .slice(0, HOOGUIT);
}

const SYSTEEM = `Je helpt bij het koken. Iemand mist een ingrediënt of mag het niet hebben, en wil weten wat er in de plaats kan.

Hoe je antwoordt:
- Hooguit drie vervangingen, de beste eerst.
- Kijk naar wat het ingrediënt in dít gerecht doet. Room die een saus bindt vraagt om iets anders dan room die door een soep gaat.
- Noem alleen dingen die je in een gewone Nederlandse supermarkt koopt.
- Zeg eerlijk wat het met het gerecht doet, ook als het minder wordt. "Iets minder romig" is een beter antwoord dan "net zo lekker".
- Is er geen goede vervanging, geef dan een lege lijst. Dat is een geldig antwoord; iets verzinnen is dat niet.

Wat je niet doet:
- Geen medische uitspraken. Zeg niet dat iets "veilig" of "geschikt" is voor een allergie; wie er ziek van wordt leest de verpakking, niet dit scherm.
- Geen merknamen.
- Geen uitleg buiten de drie velden om.`;

function bericht(input: VervangInput): string {
  const regels = [
    `Gerecht: ${input.gerecht}`,
    `Te vervangen: ${input.ingredient}`,
  ];

  if (input.stappen.length > 0) {
    regels.push(`Waar het in voorkomt:\n${input.stappen.map((s) => `- ${s}`).join("\n")}`);
  }
  if (input.dieet.length > 0) {
    regels.push(
      `De vervanging moet passen bij: ${input.dieet.map((d) => DIET_LABELS[d].toLowerCase()).join(", ")}.`,
    );
  }
  if (input.reden) regels.push(`Reden: ${input.reden}`);

  return regels.join("\n\n");
}

/**
 * Een fout van de API in gewone taal, net als bij de ideeën.
 *
 * Dezelfde afweging: de rauwe melding van de SDK zegt "401 {...}" en daar kan
 * niemand aan een keukentafel iets mee.
 */
export function leesbareFout(fout: unknown): string {
  if (fout instanceof Error && fout.message.includes("ANTHROPIC_API_KEY")) {
    return fout.message;
  }

  const status = (fout as { status?: number })?.status;
  if (status === 401) return "De ANTHROPIC_API_KEY werd niet geaccepteerd.";
  if (status === 429) return "Te snel achter elkaar. Probeer het straks nog eens.";
  if (typeof status === "number" && status >= 500) {
    return "De API deed het even niet. Probeer het nog eens.";
  }
  if (fout instanceof Error && fout.message) return fout.message;
  return "Het bedenken mislukte.";
}
