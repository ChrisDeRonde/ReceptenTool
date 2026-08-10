import Anthropic from "@anthropic-ai/sdk";
import { RECIPE_SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import {
  flattenIngredients,
  recipeJsonSchema,
  recipeSchema,
  type Recipe,
} from "./schema";

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

export type ParseInput = {
  text: string;
  sourceUrl: string | null;
  sourceType: string;
  /** Foto's van de bron, in leesvolgorde. Base64, zonder data-URI-prefix. */
  images?: { mime: string; data: string }[];
};

/**
 * Zet ruwe brontekst om in een gevalideerd recept.
 *
 * We geven het JSON Schema mee als `output_config.format`, zodat de API de
 * vorm al tijdens het genereren afdwingt. De Zod-validatie erna is een
 * vangnet — en de plek waar een schemawijziging als typefout opvalt.
 */
export async function parseRecipe(input: ParseInput): Promise<Recipe> {
  const response = await getClient().messages.create({
    model: process.env.RECIPE_MODEL ?? "claude-opus-5",
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: RECIPE_SYSTEM_PROMPT,
        // De systeemprompt is identiek voor elk recept; cachen scheelt zowel
        // kosten als latency zodra er meer dan een handvol items binnenkomt.
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: recipeJsonSchema,
      },
    },
    messages: [
      {
        role: "user",
        content: buildContent(input),
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Het model heeft deze bron geweigerd te verwerken.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Het antwoord paste niet binnen max_tokens; recept is waarschijnlijk erg lang.",
    );
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Het model gaf geen tekstantwoord terug.");
  }

  let json: unknown;
  try {
    json = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Het antwoord van het model was geen geldige JSON.");
  }

  const result = recipeSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Recept voldeed niet aan het schema: ${result.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return normalize(result.data);
}

/**
 * De inhoud van het gebruikersbericht: eerst de foto's, dan de opdracht.
 *
 * De volgorde is niet vrijblijvend — met de afbeeldingen eerst weet het model
 * waar de instructie over gaat op het moment dat het die leest.
 */
function buildContent(input: ParseInput): Anthropic.ContentBlockParam[] {
  const images = input.images ?? [];
  const text = buildUserMessage({ ...input, photoCount: images.length });

  if (images.length === 0) return [{ type: "text", text }];

  return [
    ...images.map(
      (image): Anthropic.ContentBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: image.data,
        },
      }),
    ),
    { type: "text", text },
  ];
}

/**
 * Het model telt de posities in de ingrediëntenlijst zelf uit, en dat kan
 * misgaan. Een index buiten de lijst zou in de kookmodus het verkeerde
 * ingrediënt tonen of crashen, dus die gooien we weg: liever een stap zonder
 * ingrediëntenpaneel dan een stap met een verkeerde hoeveelheid.
 */
function normalize(recipe: Recipe): Recipe {
  const ingredientCount = flattenIngredients(recipe).length;

  return {
    ...recipe,
    steps: recipe.steps.map((step) => ({
      ...step,
      ingredientRefs: [...new Set(step.ingredientRefs)]
        .filter((index) => Number.isInteger(index) && index >= 0 && index < ingredientCount)
        .sort((a, b) => a - b),
      // Een timer van 0 of negatief is geen timer.
      timerMinutes:
        step.timerMinutes !== null && step.timerMinutes > 0
          ? step.timerMinutes
          : null,
    })),
  };
}
