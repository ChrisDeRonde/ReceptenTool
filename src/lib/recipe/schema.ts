import { z } from "zod";
import { MEAL_TYPES } from "./categories";

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
  /**
   * Welke ingrediënten deze stap nodig heeft, als posities in de afgevlakte
   * ingrediëntenlijst (groepen achter elkaar, vanaf 0). Verwijzingen in plaats
   * van een kopie, zodat de kookmodus gegarandeerd dezelfde hoeveelheden toont
   * als de ingrediëntenlijst.
   *
   * Default omdat recepten van vóór de kookmodus dit veld niet hebben.
   */
  ingredientRefs: z.array(z.number().int()).default([]),
  /** Minuten die deze stap duurt, als er iets te klokken valt. */
  timerMinutes: z.number().int().nullable().default(null),
  /** Korte extra uitleg bij déze stap; los van de algemene tips. */
  tip: z.string().nullable().default(null),
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
  /** Kleine kleinletter-tags: "pasta", "vegetarisch", "snel". Geen keuken of
   *  maaltijdmoment — die staan in cuisine en mealTypes. */
  tags: z.array(z.string()),
  /**
   * Wanneer je dit eet. Waarden uit MEAL_TYPES in categories.ts; meerdere mag.
   * Default omdat recepten van vóór de categorieën dit veld niet hebben.
   */
  mealTypes: z.array(z.string()).default([]),
  /** Uit welke keuken het komt, bijv. "Italiaans". Null als het nergens bij hoort. */
  cuisine: z.string().nullable().default(null),
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

/**
 * De ingrediëntgroepen achter elkaar tot één lijst. Dit is de nummering
 * waarnaar `Step.ingredientRefs` verwijst — houd beide kanten gelijk.
 */
export function flattenIngredients(recipe: Recipe): Ingredient[] {
  return recipe.ingredientGroups.flatMap((group) => group.items);
}

/** De ingrediënten die bij één stap horen, in de volgorde van de hoofdlijst. */
export function ingredientsForStep(recipe: Recipe, step: Step): Ingredient[] {
  const all = flattenIngredients(recipe);
  return [...new Set(step.ingredientRefs)]
    .filter((index) => index >= 0 && index < all.length)
    .sort((a, b) => a - b)
    .map((index) => all[index]);
}

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
    "mealTypes",
    "cuisine",
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
        required: ["title", "text", "ingredientRefs", "timerMinutes", "tip"],
        properties: {
          title: nullableString,
          text: { type: "string" },
          ingredientRefs: { type: "array", items: { type: "integer" } },
          timerMinutes: nullableInt,
          tip: nullableString,
        },
      },
    },
    tips: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    mealTypes: { type: "array", items: { type: "string", enum: [...MEAL_TYPES] } },
    cuisine: nullableString,
    sourceName: nullableString,
    imageUrl: nullableString,
    assumptions: { type: "array", items: { type: "string" } },
  },
} as const;
