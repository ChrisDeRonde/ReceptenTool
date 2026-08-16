import { controleerToegang } from "@/lib/api/toegang";
import { receptVol } from "@/lib/api/vorm";
import { prisma } from "@/lib/db";
import {
  normalizeCuisine,
  normalizeDiets,
  normalizeMealTypes,
  packDiets,
  packMealTypes,
} from "@/lib/recipe/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Eén recept, voor als de app er een opent dat nog niet in de cache zat. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const { id } = await context.params;
  const rij = await prisma.recipe.findUnique({
    where: { id },
    include: {
      cookLogs: { orderBy: [{ cookedAt: "desc" }, { createdAt: "desc" }] },
    },
  });

  if (!rij) {
    return Response.json({ fout: "niet_gevonden" }, { status: 404 });
  }

  const recept = receptVol(rij, rij.cookLogs);
  if (!recept) {
    // Bewust een eigen code en geen 500: er is niets stuk aan de server, dit
    // recept is opgeslagen in een vorm van vóór een schemawijziging. De app kan
    // dat melden en doorverwijzen naar de website in plaats van te doen alsof
    // er iets misging.
    return Response.json(
      {
        fout: "oude_vorm",
        uitleg: "Dit recept staat in een oudere vorm opgeslagen en is alleen op de website te openen.",
      },
      { status: 409 },
    );
  }

  return Response.json(recept);
}

type Aanpassing = {
  favoriet?: unknown;
  keuken?: unknown;
  momenten?: unknown;
  dieet?: unknown;
};

/**
 * De dingen aan een recept die je vanuit de app mag bijstellen.
 *
 * Nadrukkelijk niet het recept zélf: de titel, de ingrediënten en de stappen
 * horen bij de editor, en die is te groot om even in een `PATCH` te proppen.
 * Wat hier wel in kan is wat je met één tik verandert terwijl je ernaar kijkt —
 * een ster, een keuken die het model verkeerd gokte, een dieetkenmerk.
 *
 * Alleen wat je meestuurt verandert. Een veld weglaten is dus iets anders dan
 * het op leeg zetten: `{"keuken": null}` wist de keuken, `{}` laat hem staan.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const { id } = await context.params;

  let aanpassing: Aanpassing;
  try {
    aanpassing = (await request.json()) as Aanpassing;
  } catch {
    return Response.json({ fout: "ongeldige_body" }, { status: 400 });
  }

  const bestaat = await prisma.recipe.findUnique({ where: { id }, select: { id: true } });
  if (!bestaat) return Response.json({ fout: "niet_gevonden" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof aanpassing.favoriet === "boolean") data.favorite = aanpassing.favoriet;
  if ("keuken" in aanpassing) {
    data.cuisine = normalizeCuisine(
      typeof aanpassing.keuken === "string" ? aanpassing.keuken : null,
    );
  }
  if (Array.isArray(aanpassing.momenten)) {
    data.mealTypes = packMealTypes(normalizeMealTypes(aanpassing.momenten.map(String)));
  }
  if (Array.isArray(aanpassing.dieet)) {
    data.diets = packDiets(normalizeDiets(aanpassing.dieet.map(String)));
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      { fout: "niets_te_doen", uitleg: "Geef minstens favoriet, keuken, momenten of dieet mee." },
      { status: 400 },
    );
  }

  const rij = await prisma.recipe.update({
    where: { id },
    data,
    include: { cookLogs: { orderBy: [{ cookedAt: "desc" }, { createdAt: "desc" }] } },
  });

  const recept = receptVol(rij, rij.cookLogs);
  return recept
    ? Response.json(recept)
    : Response.json({ fout: "oude_vorm" }, { status: 409 });
}
