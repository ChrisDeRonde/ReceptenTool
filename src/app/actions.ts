"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { detectSourceType } from "@/lib/extract";
import {
  normalizeCuisine,
  normalizeMealTypes,
  packMealTypes,
} from "@/lib/recipe/categories";
import { localImageName, storeRemoteImage } from "@/lib/images";
import { processShareItem } from "@/lib/pipeline";
import { deletePhotos, parsePhotos, savePhotos } from "@/lib/photos";
import { fromParam, midnight, startOfWeek, toParam } from "@/lib/menu/week";

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
    select: { photos: true, recipe: { select: { imageUrl: true } } },
  });

  await prisma.$transaction([
    prisma.recipe.deleteMany({ where: { shareItemId: id } }),
    prisma.shareItem.delete({ where: { id } }),
  ]);

  await deletePhotos(parsePhotos(item?.photos));
  await deleteImageIfUnused(item?.recipe?.imageUrl ?? null);
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

/* --- Weekmenu ------------------------------------------------------------- */

/**
 * Een gerecht op een dag zetten.
 *
 * Het aantal personen gaat mee zoals het op dat moment op je scherm stond:
 * plan je zondag voor zes, dan telt de boodschappenlijst die zondag ook voor
 * zes mee. Null betekent "zoals het recept het bedoelde".
 */
export async function addToMenu(formData: FormData): Promise<void> {
  const recipeId = readField(formData, "recipeId");
  const day = readField(formData, "dag");
  if (!recipeId || !day) return;

  const date = fromParam(day);
  const servings = Number(readField(formData, "porties") ?? "");

  await prisma.menuEntry.create({
    data: {
      recipeId,
      date: midnight(date),
      servings: Number.isInteger(servings) && servings > 0 ? servings : null,
    },
  });

  revalidatePath("/weekmenu");
  redirect(`/weekmenu?week=${toParam(startOfWeek(date))}`);
}

export async function removeFromMenu(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  await prisma.menuEntry.delete({ where: { id } });
  revalidatePath("/weekmenu");
}

/** Meer of minder personen voor één gerecht op één dag. */
export async function setMenuServings(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  const value = Number(readField(formData, "porties") ?? "");
  if (!id || !Number.isInteger(value)) return;

  await prisma.menuEntry.update({
    where: { id },
    data: { servings: value > 0 ? Math.min(value, 24) : null },
  });
  revalidatePath("/weekmenu");
}

/** Een hele week leegmaken, bijvoorbeeld als je opnieuw begint met plannen. */
export async function clearWeek(formData: FormData): Promise<void> {
  const week = readField(formData, "week");
  if (!week) return;

  const monday = startOfWeek(fromParam(week));
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);

  await prisma.menuEntry.deleteMany({ where: { date: { gte: monday, lt: end } } });
  revalidatePath("/weekmenu");
}

/**
 * Bestaande recepten die nog naar de bron linken alsnog binnenhalen.
 *
 * Nieuwe imports doen dit vanzelf; dit is voor alles wat er al stond. Per klik
 * een handvol, zodat het antwoord niet minutenlang wegblijft — de knop in de
 * Inbox laat zien hoeveel er nog over zijn.
 */
const BACKFILL_BATCH = 25;
const BACKFILL_PARALLEL = 5;

export async function fetchRecipeImages(): Promise<void> {
  const rows = await prisma.recipe.findMany({
    where: { imageUrl: { startsWith: "http" } },
    select: { id: true, imageUrl: true },
    take: BACKFILL_BATCH,
  });

  // In kleine groepjes tegelijk: één voor één is onnodig traag, en alles
  // tegelijk is onaardig tegen de site waar het vandaan komt.
  for (let i = 0; i < rows.length; i += BACKFILL_PARALLEL) {
    await Promise.all(
      rows.slice(i, i + BACKFILL_PARALLEL).map(async (row) => {
        const stored = await storeRemoteImage(row.imageUrl);
        if (!stored) return;
        await prisma.recipe.update({
          where: { id: row.id },
          data: { imageUrl: stored },
        });
      }),
    );
  }

  revalidatePath("/inbox");
  revalidatePath("/");
}

/**
 * Een gedownloade afbeelding opruimen zodra geen enkel recept er nog naar
 * wijst. Twee recepten van dezelfde site kunnen dezelfde foto delen — de naam
 * is immers een hash van de URL — dus eerst tellen, dan pas weggooien.
 */
async function deleteImageIfUnused(imageUrl: string | null): Promise<void> {
  const name = localImageName(imageUrl);
  if (!name || !imageUrl) return;

  const others = await prisma.recipe.count({ where: { imageUrl } });
  if (others > 0) return;

  await deletePhotos([{ name, mime: "" }]);
}
