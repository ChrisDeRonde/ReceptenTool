"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { detectSourceType } from "@/lib/extract";
import {
  normalizeCuisine,
  normalizeMealTypes,
  packMealTypes,
} from "@/lib/recipe/categories";
import { processShareItem } from "@/lib/pipeline";
import { deletePhotos, parsePhotos, savePhotos } from "@/lib/photos";

/**
 * Server actions voor de web-UI. De iOS-kant praat met /api/share; dit is voor
 * handmatig toevoegen, opnieuw proberen en opruimen vanuit de browser.
 */

export async function addSource(formData: FormData): Promise<void> {
  const url = readField(formData, "url");
  const text = readField(formData, "text");
  if (!url && !text) return;

  const item = await prisma.shareItem.create({
    data: {
      status: "pending",
      sourceType: detectSourceType(url),
      sourceUrl: url,
      sharedText: text,
      sharedBy: readField(formData, "sharedBy"),
    },
  });

  // Bewust awaiten: de gebruiker staat naar het scherm te kijken en wil het
  // resultaat zien, niet een lege inbox.
  await processShareItem(item.id);
  revalidatePath("/inbox");
  revalidatePath("/");
}

/**
 * Een gefotografeerd recept: kookboekpagina, kaartje, schoolbord.
 *
 * De foto's worden eerst opgeslagen en het item wordt aangemaakt vóórdat het
 * model eraan te pas komt. Gaat het parsen mis, dan staat je foto er nog en
 * kun je het opnieuw proberen zonder hem opnieuw te maken.
 */
export async function addPhotos(formData: FormData): Promise<string | null> {
  const files = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File);

  let stored;
  try {
    stored = await savePhotos(files);
  } catch (error) {
    return error instanceof Error ? error.message : "Opslaan van de foto mislukte.";
  }

  const item = await prisma.shareItem.create({
    data: {
      status: "pending",
      sourceType: "foto",
      sharedText: readField(formData, "note"),
      sharedBy: readField(formData, "sharedBy"),
      photos: JSON.stringify(stored),
    },
  });

  await processShareItem(item.id);
  revalidatePath("/inbox");
  revalidatePath("/");
  return null;
}

/**
 * Opnieuw verwerken, eventueel met tekst die de gebruiker zelf aanlevert —
 * de uitweg voor Instagram-posts achter een loginmuur.
 */
export async function retryItem(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  const text = readField(formData, "text");
  if (text) {
    await prisma.shareItem.update({
      where: { id },
      data: { sharedText: text },
    });
  }

  await processShareItem(id);
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function deleteItem(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  // Eerst de rij weg, dan de bestanden: blijft er een bestand achter, dan is
  // dat rommel op schijf. Andersom zou je een item met een dode foto krijgen.
  const item = await prisma.shareItem.findUnique({
    where: { id },
    select: { photos: true },
  });

  await prisma.$transaction([
    prisma.recipe.deleteMany({ where: { shareItemId: id } }),
    prisma.shareItem.delete({ where: { id } }),
  ]);

  await deletePhotos(parsePhotos(item?.photos));
  revalidatePath("/inbox");
  revalidatePath("/");
}

/**
 * De indeling die het model voorstelde bijstellen.
 *
 * Schrijft alleen naar de kolommen, niet naar `data`: dat blijft de onbewerkte
 * modeloutput, zodat je altijd kunt zien wat er oorspronkelijk uit de bron
 * kwam. Bij opnieuw verwerken wordt de indeling wél overschreven — dan is het
 * recept immers helemaal opnieuw afgeleid.
 */
export async function updateCategories(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  const mealTypes = normalizeMealTypes(
    formData.getAll("mealTypes").filter((value) => typeof value === "string"),
  );
  const cuisine = normalizeCuisine(readField(formData, "cuisine"));

  await prisma.recipe.update({
    where: { id },
    data: { mealTypes: packMealTypes(mealTypes), cuisine },
  });

  revalidatePath("/");
  revalidatePath(`/recepten/${id}`);
}

export async function toggleFavorite(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    select: { favorite: true },
  });
  if (!recipe) return;

  await prisma.recipe.update({
    where: { id },
    data: { favorite: !recipe.favorite },
  });
  revalidatePath("/");
  revalidatePath(`/recepten/${id}`);
}

function readField(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
