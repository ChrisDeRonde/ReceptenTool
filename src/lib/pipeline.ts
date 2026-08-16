import { prisma } from "@/lib/db";
import { errorMessage, extractSource } from "@/lib/extract";
import { findDuplicate } from "@/lib/recipe/duplicate";
import { storeRemoteImage } from "@/lib/images";
import { parsePhotos, readPhotoBase64 } from "@/lib/photos";
import {
  normalizeCuisine,
  normalizeDiets,
  normalizeMealTypes,
  packDiets,
  packMealTypes,
} from "@/lib/recipe/categories";
import { parseRecipe } from "@/lib/recipe/parse";
import { recipeSchema, type Recipe } from "@/lib/recipe/schema";

/**
 * Verwerkt één binnengekomen item: bron ophalen, recept eruit halen, opslaan.
 *
 * Faalt nooit hard naar de aanroeper toe — elke fout landt als `failed` of
 * `needs_input` op het item zelf, zodat je in de inbox ziet wat er misging en
 * het opnieuw kunt proberen.
 */
export async function processShareItem(
  itemId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const item = await prisma.shareItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  await prisma.shareItem.update({
    where: { id: itemId },
    data: {
      status: "processing",
      error: null,
      duplicateOfId: null,
      pendingData: null,
    },
  });

  try {
    const photos = parsePhotos(item.photos);
    if (photos.length > 0) {
      // Een gefotografeerde bron heeft geen ophaalketen: de foto's zíjn de
      // bron en gaan rechtstreeks naar het model.
      const images = await Promise.all(photos.map(readPhotoBase64));
      const note = item.sharedText ?? "";

      const recipe = await parseRecipe({
        text: note,
        sourceUrl: null,
        sourceType: "foto",
        images,
      });

      if (!options.force) {
        const known = await findKnownRecipe(
          { sourceUrl: null, title: recipe.title },
          itemId,
        );
        if (known) {
          await markDuplicate(itemId, known, {
            rawText: describePhotos(photos.length, note),
            pending: recipe,
          });
          return;
        }
      }

      await saveRecipe({
        itemId,
        recipe,
        sourceUrl: null,
        sourceType: "foto",
        fallbackImageUrl: null,
        fallbackSourceName: null,
        rawText: describePhotos(photos.length, note),
      });
      return;
    }

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

    const canonical = extracted.canonicalUrl ?? item.sourceUrl;

    // Dit is het goedkope moment om te merken dat je hem al hebt: de bron-URL
    // kennen we nu, en de modelaanroep is nog niet gedaan.
    if (!options.force) {
      const known = await findKnownRecipe({ sourceUrl: canonical, title: null }, itemId);
      if (known) {
        await markDuplicate(itemId, known, { attempts, rawText: extracted.text });
        return;
      }
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

    // En dit is het laatste moment: de titel komt uit het model, dus deze
    // controle kan pas nu. Het recept wordt niet opgeslagen, maar de uitvoer
    // bewaren we wel — anders kost "toch toevoegen" een tweede aanroep.
    if (!options.force) {
      const known = await findKnownRecipe(
        { sourceUrl: canonical, title: recipe.title },
        itemId,
      );
      if (known) {
        await markDuplicate(itemId, known, {
          attempts,
          rawText: extracted.text,
          pending: recipe,
        });
        return;
      }
    }

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

/**
 * Wat er in `rawText` komt te staan bij een fotobron. Dat veld is bedoeld om
 * in de inbox te kunnen zien wat het model kreeg; bij foto's is dat geen tekst,
 * dus zetten we er neer wát het kreeg.
 */
function describePhotos(count: number, note: string): string {
  const head = count === 1 ? "1 foto" : `${count} foto's`;
  return note.trim() ? `${head} met notitie: ${note.trim()}` : head;
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

  // De foto bij het recept naar eigen schijf halen, zodat het overzicht niet
  // leegloopt als de bron hem ooit verplaatst. Lukt het niet, dan blijft de
  // oorspronkelijke URL staan — dan werkt het zoals het hiervoor werkte.
  const remoteImage = recipe.imageUrl ?? params.fallbackImageUrl;
  const imageUrl = (await storeRemoteImage(remoteImage)) ?? remoteImage;

  const data = {
    title: recipe.title,
    description: recipe.description,
    sourceUrl: params.sourceUrl,
    sourceName: recipe.sourceName ?? params.fallbackSourceName,
    imageUrl,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    data: JSON.stringify(recipe),
    tags: recipe.tags.join(","),
    // Categorieën krijgen een eigen kolom in plaats van alleen in `data` te
    // staan: er wordt op gefilterd, en de gebruiker mag ze naderhand wijzigen
    // zonder dat we de modeloutput hoeven te herschrijven.
    mealTypes: packMealTypes(normalizeMealTypes(recipe.mealTypes)),
    cuisine: normalizeCuisine(recipe.cuisine),
    diets: packDiets(normalizeDiets(recipe.diets)),
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

/**
 * Staat dit recept er al?
 *
 * Alle titels en bron-URL's in het geheugen vergelijken in plaats van een
 * genormaliseerde kolom bij te houden: bij een paar honderd recepten is dat
 * sneller dan een index die kan verouderen, en het scheelt een kolom die bij
 * elke bewerking bijgewerkt moet worden.
 */
async function findKnownRecipe(
  candidate: { sourceUrl: string | null; title: string | null },
  itemId: string,
): Promise<{ id: string; title: string; reason: "bron" | "titel" } | null> {
  const rows = await prisma.recipe.findMany({
    // Het recept dat bij dít item hoort telt niet mee: opnieuw verwerken is
    // geen duplicaat van zichzelf.
    where: { NOT: { shareItemId: itemId } },
    select: { id: true, title: true, sourceUrl: true },
  });
  return findDuplicate(candidate, rows);
}

async function markDuplicate(
  itemId: string,
  known: { id: string; reason: "bron" | "titel" },
  extra: { attempts?: string; rawText: string; pending?: Recipe },
): Promise<void> {
  await prisma.shareItem.update({
    where: { id: itemId },
    data: {
      status: "duplicate",
      duplicateOfId: known.id,
      error:
        known.reason === "bron"
          ? "Deze bron heb je al eens verwerkt."
          : "Er staat al een recept met deze titel.",
      rawText: extra.rawText,
      attempts: extra.attempts,
      pendingData: extra.pending ? JSON.stringify(extra.pending) : null,
    },
  });
}

/**
 * "Toch toevoegen" bij een item dat als duplicaat is aangemerkt.
 *
 * Staat de modeluitvoer al klaar, dan wordt die gewoon opgeslagen — dat kost
 * niets. Zat de treffer op de bron-URL, dan was het model nog niet aan de
 * beurt en moet er alsnog verwerkt worden, nu zonder controle.
 */
export async function keepDuplicate(itemId: string): Promise<void> {
  const item = await prisma.shareItem.findUnique({ where: { id: itemId } });
  if (!item || item.status !== "duplicate") return;

  if (!item.pendingData) {
    await processShareItem(itemId, { force: true });
    return;
  }

  const parsed = recipeSchema.safeParse(JSON.parse(item.pendingData));
  if (!parsed.success) {
    await processShareItem(itemId, { force: true });
    return;
  }

  await saveRecipe({
    itemId,
    recipe: parsed.data,
    sourceUrl: item.sourceUrl,
    sourceType: item.sourceType,
    fallbackImageUrl: null,
    fallbackSourceName: null,
    rawText: item.rawText ?? "",
  });

  await prisma.shareItem.update({
    where: { id: itemId },
    data: { duplicateOfId: null, pendingData: null, error: null },
  });
}
