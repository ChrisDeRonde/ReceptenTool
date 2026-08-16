import { unpackDiets, unpackMealTypes, type Diet, type MealType } from "@/lib/recipe/categories";
import { recipeSchema, type Recipe } from "@/lib/recipe/schema";

/**
 * De vorm waarin `/api/v1` dingen teruggeeft.
 *
 * Dit is een **contract**, en daarom een eigen vorm in plaats van de rijen uit
 * de database of de blob die het model opleverde. Die twee mogen veranderen —
 * er komt een kolom bij, de extractieprompt levert een veld anders aan — zonder
 * dat er ergens een telefoon stukgaat die je niet in de hand hebt. Vertalen bij
 * de deur kost een keer schrijven en scheelt daarna elke keer.
 *
 * Nederlandse veldnamen, zoals de rest van de app. De Engelse namen binnenin
 * zijn het schema van het model, niet dat van ons.
 *
 * Alles hier is puur: rij in, object uit, geen database ernaast. Dat is de
 * reden dat het te testen valt zonder server.
 */

export const API_VERSIE = 1;

export type ApiIngredient = {
  aantal: number | null;
  eenheid: string | null;
  naam: string;
  notitie: string | null;
};

export type ApiIngredientgroep = {
  naam: string | null;
  items: ApiIngredient[];
};

export type ApiStap = {
  titel: string | null;
  tekst: string;
  /** Posities in de afgevlakte ingrediëntenlijst, vanaf 0. */
  ingredienten: number[];
  timerMinuten: number | null;
  tip: string | null;
};

export type ApiKooklog = {
  id: string;
  gemaaktOp: string;
  sterren: number | null;
  notitie: string | null;
  /** Vaker eten? Null betekent: niet gezegd. */
  vaker: boolean | null;
  wie: string | null;
};

/** Wat er op een tegel past. */
export type ApiReceptKort = {
  id: string;
  titel: string;
  foto: string | null;
  favoriet: boolean;
  totaalMinuten: number | null;
  keuken: string | null;
  momenten: MealType[];
  dieet: Diet[];
  tags: string[];
  /** Het gemiddelde oordeel, of null als er nog niets gezegd is. */
  cijfer: number | null;
  bijgewerkt: string;
};

export type ApiRecept = ApiReceptKort & {
  omschrijving: string | null;
  bron: { url: string | null; naam: string | null } | null;
  porties: number | null;
  voorbereidenMinuten: number | null;
  bereidenMinuten: number | null;
  ingredientgroepen: ApiIngredientgroep[];
  stappen: ApiStap[];
  tips: string[];
  /** Wat het model zelf heeft aangevuld omdat het niet in de bron stond. */
  aannames: string[];
  kooklog: ApiKooklog[];
  toegevoegd: string;
  /** Wanneer iemand het recept zelf bijwerkte, en wie. */
  bewerkt: { op: string; door: string | null } | null;
};

/** De kolommen die een tegel nodig heeft. */
export type RijKort = {
  id: string;
  title: string;
  imageUrl: string | null;
  favorite: boolean;
  totalMinutes: number | null;
  cuisine: string | null;
  mealTypes: string;
  diets: string;
  tags: string;
  updatedAt: Date;
};

export type RijVol = RijKort & {
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  data: string;
  createdAt: Date;
  editedAt: Date | null;
  editedBy: string | null;
};

export function receptKort(rij: RijKort, cijfer: number | null = null): ApiReceptKort {
  return {
    id: rij.id,
    titel: rij.title,
    foto: rij.imageUrl,
    favoriet: rij.favorite,
    totaalMinuten: rij.totalMinutes,
    keuken: rij.cuisine,
    momenten: unpackMealTypes(rij.mealTypes),
    dieet: unpackDiets(rij.diets),
    tags: losseTags(rij.tags),
    // Afronden op één cijfer: het gemiddelde van 4 en 5 is 4,5 en niet
    // 4,499999999999999. Een client die dit toont hoort niet te hoeven denken.
    cijfer: cijfer === null ? null : Math.round(cijfer * 10) / 10,
    bijgewerkt: rij.updatedAt.toISOString(),
  };
}

/**
 * Het hele recept, inclusief wat er in de JSON-blob zit.
 *
 * Is die blob onleesbaar — een recept van vóór een schemawijziging — dan geeft
 * dit `null` in plaats van te gooien. Eén stuk kapotte data hoort niet de hele
 * synchronisatie tegen te houden; de aanroeper slaat het over en de client ziet
 * het recept gewoon niet.
 */
export function receptVol(
  rij: RijVol,
  logs: readonly ApiKooklogBron[] = [],
): ApiRecept | null {
  let recept: Recipe;
  try {
    const gelezen = recipeSchema.safeParse(JSON.parse(rij.data));
    if (!gelezen.success) return null;
    recept = gelezen.data;
  } catch {
    return null;
  }

  const sterren = logs
    .map((log) => log.rating)
    .filter((waarde): waarde is number => waarde !== null);
  const cijfer = sterren.length
    ? sterren.reduce((som, waarde) => som + waarde, 0) / sterren.length
    : null;

  return {
    ...receptKort(rij, cijfer),
    omschrijving: rij.description,
    bron:
      rij.sourceUrl || rij.sourceName
        ? { url: rij.sourceUrl, naam: rij.sourceName }
        : null,
    porties: rij.servings,
    voorbereidenMinuten: rij.prepMinutes,
    bereidenMinuten: rij.cookMinutes,
    ingredientgroepen: recept.ingredientGroups.map((groep) => ({
      naam: groep.name,
      items: groep.items.map((item) => ({
        aantal: item.quantity,
        eenheid: item.unit,
        naam: item.name,
        notitie: item.note,
      })),
    })),
    stappen: recept.steps.map((stap) => ({
      titel: stap.title,
      tekst: stap.text,
      ingredienten: stap.ingredientRefs,
      timerMinuten: stap.timerMinutes,
      tip: stap.tip,
    })),
    tips: recept.tips,
    aannames: recept.assumptions,
    kooklog: logs.map(kooklog),
    toegevoegd: rij.createdAt.toISOString(),
    bewerkt: rij.editedAt
      ? { op: rij.editedAt.toISOString(), door: rij.editedBy }
      : null,
  };
}

export type ApiKooklogBron = {
  id: string;
  cookedAt: Date;
  rating: number | null;
  note: string | null;
  again: boolean | null;
  who: string | null;
};

export function kooklog(log: ApiKooklogBron): ApiKooklog {
  return {
    id: log.id,
    gemaaktOp: dagAlsTekst(log.cookedAt),
    sterren: log.rating,
    notitie: log.note,
    vaker: log.again,
    wie: log.who,
  };
}

/**
 * "2026-08-16" — een dag zonder tijdstip.
 *
 * Een kooklogregel gaat over een dag en niet over een moment, en die als
 * volledige ISO-tijd versturen levert precies één soort bug op: een client in
 * een andere tijdzone ziet er de dag ervoor van. Lokale datumdelen, want zo
 * staat het ook in de database.
 */
export function dagAlsTekst(datum: Date): string {
  const maand = String(datum.getMonth() + 1).padStart(2, "0");
  const dag = String(datum.getDate()).padStart(2, "0");
  return `${datum.getFullYear()}-${maand}-${dag}`;
}

function losseTags(gepakt: string): string[] {
  return gepakt
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
