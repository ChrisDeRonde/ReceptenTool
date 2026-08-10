import { z } from "zod";

/**
 * De vorm van een verwerkt recept.
 *
 * Twee representaties die synchroon moeten blijven:
 *  - `recipeSchema`  — Zod, voor validatie van wat het model teruggeeft.
 *  - `recipeJsonSchema` — JSON Schema, gaat mee als `output_config.format`
 *    zodat de API het antwoord al tijdens generatie afdwingt.
 *
 * Structured outputs eisen dat elk object `additionalProperties: false` heeft
 * en dat álle properties in `required` staan. Optionele velden zijn daarom
 * nullable in plaats van afwezig.
 */

export const ingredientSchema = z.object({
  /** Hoeveelheid als getal, of null bij "snufje", "naar smaak". */
  quantity: z.number().nullable(),
  /** g, ml, el, tl, stuks, teentje, … of null. */
  unit: z.string().nullable(),
  /** Het ingrediënt zelf, enkelvoud waar dat natuurlijk klinkt. */
  name: z.string(),
  /** "fijngesneden", "op kamertemperatuur", "liefst Pecorino Romano". */
  note: z.string().nullable(),
});

export const ingredientGroupSchema = z.object({
  /** "Voor de saus", of null als het recept geen groepen kent. */
  name: z.string().nullable(),
  items: z.array(ingredientSchema),
});

export const stepSchema = z.object({
  /** Optionele kop, bijv. "Pasta koken". */
  title: z.string().nullable(),
  text: z.string(),
});

export const recipeSchema = z.object({
  title: z.string(),
  /** Eén of twee zinnen: wat het is en waarom het de moeite waard is. */
  description: z.string().nullable(),
  servings: z.number().int().nullable(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  totalMinutes: z.number().int().nullable(),
  ingredientGroups: z.array(ingredientGroupSchema),
  steps: z.array(stepSchema),
  /** Praktische tips, vervangingen, bewaaradvies. */
  tips: z.array(z.string()),
  /** Kleine kleinletter-tags: "pasta", "italiaans", "vegetarisch", "snel". */
  tags: z.array(z.string()),
  /** Waar dit vandaan komt: "Allerhande", "@pastagrannies", "Leuke Recepten". */
  sourceName: z.string().nullable(),
  /** Directe URL naar een foto van het gerecht, als de bron er een had. */
  imageUrl: z.string().nullable(),
  /**
   * Wat het model niet in de bron kon vinden en dus zelf heeft aangevuld.
   * Leeg als alles letterlijk uit de bron kwam.
   */
  assumptions: z.array(z.string()),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type IngredientGroup = z.infer<typeof ingredientGroupSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Recipe = z.infer<typeof recipeSchema>;

const nullableString = { type: ["string", "null"] } as const;
const nullableInt = { type: ["integer", "null"] } as const;

export const recipeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "servings",
    "prepMinutes",
    "cookMinutes",
    "totalMinutes",
    "ingredientGroups",
    "steps",
    "tips",
    "tags",
    "sourceName",
    "imageUrl",
    "assumptions",
  ],
  properties: {
    title: { type: "string" },
    description: nullableString,
    servings: nullableInt,
    prepMinutes: nullableInt,
    cookMinutes: nullableInt,
    totalMinutes: nullableInt,
    ingredientGroups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "items"],
        properties: {
          name: nullableString,
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["quantity", "unit", "name", "note"],
              properties: {
                quantity: { type: ["number", "null"] },
                unit: nullableString,
                name: { type: "string" },
                note: nullableString,
              },
            },
          },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text"],
        properties: {
          title: nullableString,
          text: { type: "string" },
        },
      },
    },
    tips: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    sourceName: nullableString,
    imageUrl: nullableString,
    assumptions: { type: "array", items: { type: "string" } },
  },
} as const;
