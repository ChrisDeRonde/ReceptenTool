"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { detectSourceType } from "@/lib/extract";
import {
  normalizeCuisine,
  normalizeDiets,
  normalizeMealTypes,
  packDiets,
  packMealTypes,
} from "@/lib/recipe/categories";
import { deleteImageIfUnused, localImageName, storeRemoteImage } from "@/lib/images";
import { keepDuplicate, processShareItem } from "@/lib/pipeline";
import { ingredientFromFields } from "@/lib/recipe/amount";
import { MAX_SERVINGS, MIN_SERVINGS } from "@/lib/recipe/scale";
import { isVerouderd } from "@/lib/recipe/versie";
import {
  flattenIngredients,
  recipeSchema,
  type Ingredient,
  type IngredientGroup,
  type Recipe,
  type Step,
} from "@/lib/recipe/schema";
import { deletePhotos, parsePhotos, savePhotos } from "@/lib/photos";
import { fromParam, midnight, startOfWeek, toParam } from "@/lib/menu/week";
import { currentPerson } from "@/lib/who";
import { momentTekst } from "@/lib/tijd";
import { huishouden } from "@/lib/settings";

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
      sharedBy: readField(formData, "sharedBy") ?? (await currentPerson()),
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
      sharedBy: readField(formData, "sharedBy") ?? (await currentPerson()),
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
  const diets = normalizeDiets(
    formData.getAll("diets").filter((value) => typeof value === "string"),
  );

  await prisma.recipe.update({
    where: { id },
    data: { mealTypes: packMealTypes(mealTypes), cuisine, diets: packDiets(diets) },
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
  const gekozen = Number(readField(formData, "porties") ?? "");

  await prisma.menuEntry.create({
    data: {
      recipeId,
      date: midnight(date),
      // Stond er geen aantal op je scherm, dan kook je voor het huishouden —
      // niet voor het aantal porties dat toevallig in de bron stond. Dat
      // laatste is een eigenschap van het recept, niet van jullie.
      servings:
        Number.isInteger(gekozen) && gekozen > 0 ? gekozen : await huishouden(),
    },
  });

  revalidatePath("/weekmenu");
  redirect(`/weekmenu?week=${toParam(startOfWeek(date))}`);
}

export async function removeFromMenu(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  // deleteMany en niet delete: tik je op een trage verbinding twee keer op het
  // kruisje, dan is de tweede een lege opdracht in plaats van een foutpagina.
  await prisma.menuEntry.deleteMany({ where: { id } });
  revalidatePath("/weekmenu");
}

/** Meer of minder personen voor één gerecht op één dag. */
export async function setMenuServings(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  const value = Number(readField(formData, "porties") ?? "");
  if (!id || !Number.isInteger(value)) return;

  await prisma.menuEntry.updateMany({
    where: { id },
    data: {
      // Dezelfde grenzen als de knoppen op het scherm; die komen uit dezelfde
      // constanten. Een los getal hier loopt vroeg of laat uit de pas.
      servings:
        value >= MIN_SERVINGS ? Math.min(value, MAX_SERVINGS) : null,
    },
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
 * Een recept met de hand bijwerken.
 *
 * Dit is de enige plek die `data` overschrijft. Tot nu toe bleef die blob
 * precies zoals het model hem opleverde en pasten we alleen de kolommen aan;
 * dat is een mooie garantie, maar hij staat een receptenverzameling in de weg.
 * Na twee keer koken weet je dat er een teen knoflook bij moet, en zonder
 * bewerken verhuist die kennis naar je hoofd in plaats van naar het recept.
 * Wat de bron zei blijft opvraagbaar: `ShareItem.rawText` bewaart de tekst
 * waar het model op werkte.
 *
 * De velden komen als `ing.<groep>.<regel>.<veld>` binnen, zodat er rijen bij
 * en af kunnen zonder dat het formulier van vorm verandert.
 */
export type BewerkStand =
  | { soort: "rust" }
  /**
   * Iemand was je voor. De tekst is hier al opgemaakt: het formulier hoeft niet
   * te weten wie er ingelogd is om te kunnen zeggen "je hebt dit zelf ook
   * bijgewerkt" in plaats van "Chris heeft dit bijgewerkt".
   */
  | { soort: "botsing"; wie: string; wanneer: string };

export async function updateRecipe(
  _vorige: BewerkStand,
  formData: FormData,
): Promise<BewerkStand> {
  const id = readField(formData, "id");
  if (!id) return { soort: "rust" };

  const row = await prisma.recipe.findUnique({ where: { id } });
  if (!row) return { soort: "rust" };

  const parsed = recipeSchema.safeParse(JSON.parse(row.data));
  if (!parsed.success) return { soort: "rust" };
  const before = parsed.data;

  // Is er iemand tussen geweest sinds jij dit formulier opende? Dan niet
  // opslaan maar vragen. Alleen de tweede keer — met `forceren` erbij heb je
  // die vraag al beantwoord.
  const ik = await currentPerson();
  // Bewust niet via `readField`: die maakt van een lege tekst `null`, en hier
  // is leeg juist een waarde — "dit recept was nog nooit bijgewerkt toen ik dit
  // formulier opende". Zonder dit onderscheid mist de controle precies het
  // geval dat het vaakst voorkomt: twee mensen in een vers geïmporteerd recept.
  const meegestuurd = formData.get("versie");
  if (
    formData.get("forceren") !== "1" &&
    isVerouderd(typeof meegestuurd === "string" ? meegestuurd : null, row.editedAt)
  ) {
    return {
      soort: "botsing",
      wie:
        row.editedBy === null
          ? "Iemand heeft dit recept intussen bijgewerkt"
          : row.editedBy === ik
            ? "Je hebt dit recept zelf ook bijgewerkt, in een ander venster"
            : `${row.editedBy} heeft dit recept intussen bijgewerkt`,
      wanneer: row.editedAt ? momentTekst(row.editedAt, new Date()) : "",
    };
  }

  const { groups, moved } = readIngredients(formData);
  const steps = readSteps(formData, moved);

  const recipe: Recipe = {
    ...before,
    title: readField(formData, "titel") ?? before.title,
    description: readField(formData, "omschrijving"),
    servings: readNumber(formData, "porties"),
    prepMinutes: readNumber(formData, "voorbereiden"),
    cookMinutes: readNumber(formData, "bereiden"),
    totalMinutes: readNumber(formData, "totaal"),
    ingredientGroups: groups,
    steps,
    tips: readLines(formData, "tips"),
    tags: (readField(formData, "tags") ?? "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  };

  // Verander je de ingrediënten, dan slaat het dieetkenmerk nergens meer op:
  // wie de tofu vervangt door kip houdt anders een recept over dat zichzelf
  // vegetarisch noemt. Het kenmerk gaat er dus af in plaats van mee te
  // verhuizen — een leeg kenmerk kost een filtertreffer, een verkeerd kenmerk
  // zet iemand iets voor waar hij niet tegen kan. Aanvinken kan meteen weer,
  // onder "Indeling aanpassen" op de receptpagina.
  const ingredientenGewijzigd =
    namenVan(recipe) !== namenVan(before) ? { diets: "" } : {};

  await prisma.recipe.update({
    where: { id },
    data: {
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      totalMinutes: recipe.totalMinutes,
      data: JSON.stringify(recipe),
      tags: recipe.tags.join(","),
      ...ingredientenGewijzigd,
      editedAt: new Date(),
      editedBy: ik,
    },
  });

  revalidatePath(`/recepten/${id}`);
  revalidatePath("/");
  redirect(`/recepten/${id}`);
}

/** De ingrediëntnamen als één string, om twee versies te kunnen vergelijken. */
function namenVan(recipe: Recipe): string {
  return flattenIngredients(recipe)
    .map((item) => item.name.trim().toLowerCase())
    .join("\u0000");
}

/**
 * De ingrediëntvelden terug naar groepen.
 *
 * Levert er ook bij op waar elke oorspronkelijke regel terechtkwam. De stappen
 * verwijzen naar ingrediënten met een positienummer, en dat nummer schuift
 * zodra je er eentje weghaalt; zonder deze vertaalslag wijst de kookmodus na
 * één bewerking naar het verkeerde ingrediënt.
 */
function readIngredients(formData: FormData): {
  groups: IngredientGroup[];
  moved: Map<number, number>;
} {
  const rows = new Map<number, Map<number, Record<string, string>>>();

  for (const [key, value] of formData.entries()) {
    const match = /^ing\.(\d+)\.(\d+)\.(hoeveelheid|naam|notitie|van)$/.exec(key);
    if (!match) continue;
    const group = Number(match[1]);
    const index = Number(match[2]);
    if (!rows.has(group)) rows.set(group, new Map());
    const items = rows.get(group)!;
    if (!items.has(index)) items.set(index, {});
    items.get(index)![match[3]] = String(value);
  }

  const groups: IngredientGroup[] = [];
  const moved = new Map<number, number>();
  let flat = 0;

  for (const groupIndex of [...rows.keys()].sort((a, b) => a - b)) {
    const name = readField(formData, `groep.${groupIndex}.naam`);
    const items: Ingredient[] = [];

    for (const itemIndex of [...rows.get(groupIndex)!.keys()].sort((a, b) => a - b)) {
      const fields = rows.get(groupIndex)!.get(itemIndex)!;
      const item = ingredientFromFields({
        amount: fields.hoeveelheid ?? "",
        name: fields.naam ?? "",
        note: fields.notitie ?? "",
      });
      if (!item) continue;

      const from = Number(fields.van);
      if (Number.isInteger(from) && from >= 0) moved.set(from, flat);
      items.push(item);
      flat += 1;
    }

    // Een groep zonder ingrediënten is een kop boven niets.
    if (items.length > 0) groups.push({ name, items });
  }

  return { groups, moved };
}

function readSteps(formData: FormData, moved: Map<number, number>): Step[] {
  const rows = new Map<number, Record<string, string>>();

  for (const [key, value] of formData.entries()) {
    const match = /^stap\.(\d+)\.(titel|tekst|minuten|tip|refs)$/.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    if (!rows.has(index)) rows.set(index, {});
    rows.get(index)![match[2]] = String(value);
  }

  const steps: Step[] = [];
  for (const index of [...rows.keys()].sort((a, b) => a - b)) {
    const fields = rows.get(index)!;
    const text = (fields.tekst ?? "").trim();
    if (!text) continue;

    const minutes = Number.parseInt(fields.minuten ?? "", 10);
    const title = (fields.titel ?? "").trim();
    const tip = (fields.tip ?? "").trim();

    steps.push({
      title: title ? title : null,
      text,
      // Verwijzingen naar ingrediënten die je hebt weggehaald verdwijnen
      // gewoon; de overige schuiven mee naar hun nieuwe plek.
      ingredientRefs: (fields.refs ?? "")
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value))
        .map((value) => moved.get(value))
        .filter((value): value is number => value !== undefined),
      timerMinutes: Number.isInteger(minutes) && minutes > 0 ? minutes : null,
      tip: tip ? tip : null,
    });
  }

  return steps;
}

/** Een getal uit een veld, of null als het leeg of onzin is. */
function readNumber(formData: FormData, name: string): number | null {
  const value = Number.parseInt(readField(formData, name) ?? "", 10);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/** Een textarea met één ding per regel. */
function readLines(formData: FormData, name: string): string[] {
  return (readField(formData, name) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Een item dat als duplicaat is aangemerkt tóch als recept opslaan.
 *
 * Twee varianten van hetzelfde gerecht kunnen best allebei de moeite waard
 * zijn, en de herkenning is een vermoeden — geen oordeel.
 */
export async function keepAnyway(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  await keepDuplicate(id);
  revalidatePath("/inbox");
  revalidatePath("/");
}

/* --- Kooklog -------------------------------------------------------------- */

/**
 * Vastleggen dat je dit gemaakt hebt, en hoe het beviel.
 *
 * Sterren, één regel tekst en "vaker eten?" — meer niet. Alles mag leeg: soms
 * wil je alleen weten dát je het gemaakt hebt, en een formulier dat je dwingt
 * een oordeel te geven vul je na een keer niet meer in.
 */
export async function logCook(formData: FormData): Promise<void> {
  const recipeId = readField(formData, "recipeId");
  if (!recipeId) return;

  const rating = Number.parseInt(readField(formData, "sterren") ?? "", 10);
  const again = readField(formData, "vaker");
  const day = readField(formData, "wanneer");

  await prisma.cookLog.create({
    data: {
      recipeId,
      // Standaard vandaag; achteraf invullen mag ook.
      cookedAt: day ? midnight(fromParam(day)) : midnight(new Date()),
      rating: rating >= 1 && rating <= 5 ? rating : null,
      note: readField(formData, "opmerking"),
      again: again === "ja" ? true : again === "nee" ? false : null,
      who: await currentPerson(),
    },
  });

  revalidatePath(`/recepten/${recipeId}`);
  revalidatePath("/");
  redirect(`/recepten/${recipeId}`);
}

export async function deleteCookLog(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  // Eerst kijken welk recept het was, en dan pas weg — anders weten we na de
  // verwijdering niet meer welke pagina ververst moet worden. Is de regel er al
  // niet meer (dubbel getikt), dan valt er ook niets te verversen.
  const log = await prisma.cookLog.findUnique({
    where: { id },
    select: { recipeId: true },
  });
  if (!log) return;

  await prisma.cookLog.deleteMany({ where: { id } });
  revalidatePath(`/recepten/${log.recipeId}`);
  revalidatePath("/");
}

/**
 * Een recept weggooien, vanaf het recept zelf.
 *
 * Dit kon alleen via het bijbehorende item in de Inbox, en die toont er
 * vijftig — een recept van zestig imports geleden was daarmee onbereikbaar
 * geworden. Het inbox-item gaat mee: dat is boekhouding van de import, en een
 * item dat op "klaar" staat zonder recept is een raadsel in plaats van een
 * spoor.
 *
 * Weekmenu-regels en kooklogregels verdwijnen vanzelf; die hangen met een
 * cascade aan het recept.
 */
export async function deleteRecipe(formData: FormData): Promise<void> {
  const id = readField(formData, "id");
  if (!id) return;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    select: { imageUrl: true, shareItemId: true, shareItem: { select: { photos: true } } },
  });
  if (!recipe) return;

  // Eerst de rijen weg, dan de bestanden: blijft er een bestand achter, dan is
  // dat rommel op schijf. Andersom houd je een recept met een dode foto over.
  // Het item gaat als eerste; dat zet `shareItemId` op null en daarna mag het
  // recept weg zonder dat de volgorde nog uitmaakt.
  await prisma.$transaction(async (tx) => {
    if (recipe.shareItemId) {
      await tx.shareItem.delete({ where: { id: recipe.shareItemId } });
    }
    await tx.recipe.delete({ where: { id } });
  });

  await deletePhotos(parsePhotos(recipe.shareItem?.photos));
  await deleteImageIfUnused(recipe.imageUrl);

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/weekmenu");
  redirect("/");
}
