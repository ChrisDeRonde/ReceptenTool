import { prisma } from "@/lib/db";
import { errorMessage, extractSource } from "@/lib/extract";
import { parseRecipe } from "@/lib/recipe/parse";
import type { Recipe } from "@/lib/recipe/schema";

/**
 * Verwerkt één binnengekomen item: bron ophalen, recept eruit halen, opslaan.
 *
 * Faalt nooit hard naar de aanroeper toe — elke fout landt als `failed` of
 * `needs_input` op het item zelf, zodat je in de inbox ziet wat er misging en
 * het opnieuw kunt proberen.
 */
export async function processShareItem(itemId: string): Promise<void> {
  const item = await prisma.shareItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  await prisma.shareItem.update({
    where: { id: itemId },
    data: { status: "processing", error: null },
  });

  try {
    const extracted = await extractSource({
      url: item.sourceUrl,
      text: item.sharedText,
    });

    const attempts = JSON.stringify(extracted.attempts);

    if (extracted.status === "needs_input") {
      await prisma.shareItem.update({
        where: { id: itemId },
        data: {
          status: "needs_input",
          error: extracted.reason,
          sourceUrl: extracted.canonicalUrl ?? item.sourceUrl,
          strategy: null,
          attempts,
        },
      });
      return;
    }

    // Vóór de modelaanroep opslaan: als het parsen faalt wil je in de inbox
    // kunnen zien wélke tekst het model kreeg en hoe die is opgehaald.
    await prisma.shareItem.update({
      where: { id: itemId },
      data: {
        rawText: extracted.text,
        sourceUrl: extracted.canonicalUrl ?? item.sourceUrl,
        sourceType: extracted.sourceType,
        strategy: extracted.strategy,
        attempts,
      },
    });

    const recipe = await parseRecipe({
      text: extracted.text,
      sourceUrl: extracted.canonicalUrl,
      sourceType: extracted.sourceType,
    });

    await saveRecipe({
      itemId,
      recipe,
      sourceUrl: extracted.canonicalUrl,
      sourceType: extracted.sourceType,
      fallbackImageUrl: extracted.meta.imageUrl,
      fallbackSourceName: extracted.meta.siteName,
      rawText: extracted.text,
    });
  } catch (error) {
    await prisma.shareItem.update({
      where: { id: itemId },
      data: { status: "failed", error: errorMessage(error) },
    });
  }
}

async function saveRecipe(params: {
  itemId: string;
  recipe: Recipe;
  sourceUrl: string | null;
  sourceType: string;
  fallbackImageUrl: string | null;
  fallbackSourceName: string | null;
  rawText: string;
}): Promise<void> {
  const { recipe } = params;

  const data = {
    title: recipe.title,
    description: recipe.description,
    sourceUrl: params.sourceUrl,
    sourceName: recipe.sourceName ?? params.fallbackSourceName,
    imageUrl: recipe.imageUrl ?? params.fallbackImageUrl,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    data: JSON.stringify(recipe),
    tags: recipe.tags.join(","),
  };

  // Eén transactie: een item mag nooit op `done` staan zonder recept.
  await prisma.$transaction([
    prisma.recipe.upsert({
      where: { shareItemId: params.itemId },
      create: { ...data, shareItemId: params.itemId },
      update: data,
    }),
    prisma.shareItem.update({
      where: { id: params.itemId },
      data: {
        status: "done",
        error: null,
        rawText: params.rawText,
        sourceUrl: params.sourceUrl,
        sourceType: params.sourceType,
      },
    }),
  ]);
}
