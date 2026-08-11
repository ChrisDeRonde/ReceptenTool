"use server";

import { after } from "next/server";
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
import { aisleFor, isStore } from "@/lib/shopping/aisles";
import { addIngredients, getStore, setStore } from "@/lib/shopping/list";
import { fillMatches } from "@/lib/shopping/lookup";
import { canonicalName } from "@/lib/shopping/units";
import { parseServings, scaleRecipe } from "@/lib/recipe/scale";
import { flattenIngredients, recipeSchema } from "@/lib/recipe/schema";

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

/* --- Boodschappenlijst ---------------------------------------------------- */

/**
 * Alle ingrediënten van een recept op de lijst zetten, in de hoeveelheid die
 * op dat moment op het scherm staat: kook je voor zes, dan koop je voor zes.
 */
export async function addRecipeToList(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  const row = await prisma.recipe.findUnique({ where: { id } });
  if (!row) return;

  const parsed = recipeSchema.safeParse(JSON.parse(row.data));
  if (!parsed.success) return;

  const servings = parseServings(
    readField(formData, "porties") ?? undefined,
    parsed.data.servings,
  );
  const recipe =
    servings === null ? parsed.data : scaleRecipe(parsed.data, servings);

  const ingredients = flattenIngredients(recipe);
  await addIngredients(ingredients, recipe.title);

  // Prijzen erbij zoeken gebeurt ná het antwoord: de lijst staat er meteen,
  // de prijzen druppelen erachteraan. Wachten zou de enige trage stap in de
  // hele app introduceren.
  const store = await getStore();
  after(async () => {
    await fillMatches(store, ingredients.map((item) => item.name));
  });

  revalidatePath("/lijst");
  revalidatePath(`/recepten/${id}`);
}

/** Zelf iets toevoegen dat bij geen recept hoort: wc-papier, een fles wijn. */
export async function addListItem(formData: FormData): Promise<void> {
  const name = readField(formData, "name");
  if (!name) return;

  await prisma.shoppingItem.create({
    data: {
      name,
      key: canonicalName(name),
      quantity: null,
      unit: null,
      aisle: aisleFor(canonicalName(name)),
      fromRecipe: null,
    },
  });

  const store = await getStore();
  after(async () => {
    await fillMatches(store, [name]);
  });

  revalidatePath("/lijst");
}

export async function toggleListItem(id: string, checked: boolean): Promise<void> {
  await prisma.shoppingItem.update({ where: { id }, data: { checked } });
  revalidatePath("/lijst");
}

export async function removeListItem(id: string): Promise<void> {
  await prisma.shoppingItem.delete({ where: { id } });
  revalidatePath("/lijst");
}

/** Na de kassa: weg met wat in het karretje lag, de rest blijft staan. */
export async function clearCheckedItems(): Promise<void> {
  await prisma.shoppingItem.deleteMany({ where: { checked: true } });
  revalidatePath("/lijst");
}

export async function clearList(): Promise<void> {
  await prisma.shoppingItem.deleteMany({});
  revalidatePath("/lijst");
}

export async function chooseStore(formData: FormData): Promise<void> {
  const store = readField(formData, "store");
  if (!isStore(store)) return;
  await setStore(store);
  revalidatePath("/lijst");
}
