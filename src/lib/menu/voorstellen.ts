import { prisma } from "@/lib/db";
import { suggest, type Voorstel } from "@/lib/menu/suggest";
import { unpackDiets } from "@/lib/recipe/categories";
import { buildHaystack, parseQuery } from "@/lib/recipe/search";
import { people, voorkeuren } from "@/lib/settings";
import { eisen } from "@/lib/voorkeuren";

/**
 * De voorstellen ophalen: alles wat de pure motor nodig heeft, uit de database.
 *
 * Stond eerst in de weekmenu-pagina zelf. Nu de app dezelfde vraag stelt via
 * `/api/v1/voorstellen`, hoort het op één plek te staan — twee kopieën van deze
 * afweging zijn twee kopieën die uit elkaar gaan lopen, en dan geeft de app
 * andere antwoorden dan de website.
 *
 * De weging zelf blijft in `suggest.ts` en blijft puur; dit is alleen het
 * ophalen eromheen.
 */
export async function haalVoorstellen(opties: {
  gepland: Array<{ id: string; cuisine: string | null }>;
  /** Wat er in de koelkast ligt, zoals iemand het intypte. */
  inHuis?: string;
  vandaag?: Date;
  aantal?: number;
}): Promise<{ voorstellen: Voorstel[]; termen: string[]; gevraagd: ReturnType<typeof eisen> }> {
  const [rows, namen, wensen] = await Promise.all([
    prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        cuisine: true,
        diets: true,
        data: true,
        favorite: true,
        createdAt: true,
        cookLogs: { select: { cookedAt: true, rating: true, again: true } },
      },
      take: 500,
    }),
    people(),
    voorkeuren(),
  ]);

  // Iedereen die in het huishouden staat eet mee. Wie er een avond niet is,
  // haal je niet uit de instellingen — dan is dit voorstel voor die ene keer te
  // streng, en dat is te overzien.
  const gevraagd = eisen(wensen, namen);
  const termen = parseQuery(opties.inHuis ?? "").map((term) => term.key);

  const voorstellen = suggest(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      cuisine: row.cuisine,
      favorite: row.favorite,
      createdAt: row.createdAt,
      diets: unpackDiets(row.diets),
      ingredientWoorden: buildHaystack(row).ingredients,
      cookedAt: row.cookLogs.map((log) => log.cookedAt),
      ratings: row.cookLogs
        .map((log) => log.rating)
        .filter((rating): rating is number => rating !== null),
      again: {
        yes: row.cookLogs.filter((log) => log.again === true).length,
        no: row.cookLogs.filter((log) => log.again === false).length,
      },
    })),
    {
      gepland: opties.gepland,
      vandaag: opties.vandaag ?? new Date(),
      wensen: gevraagd,
      inHuis: termen,
      aantal: opties.aantal,
    },
  );

  return { voorstellen, termen, gevraagd };
}
