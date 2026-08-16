import { controleerToegang } from "@/lib/api/toegang";
import { dagAlsTekst } from "@/lib/api/vorm";
import { prisma } from "@/lib/db";
import { fromParam, midnight, startOfWeek, toParam, weekRange } from "@/lib/menu/week";
import { MAX_SERVINGS, MIN_SERVINGS } from "@/lib/recipe/scale";
import { huishouden } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wat er deze week gepland staat.
 *
 * Alleen de planning, niet de recepten zelf: die heeft de app al in zijn cache
 * staan, en ze twee keer versturen maakt elke weekwissel onnodig traag. Per
 * regel gaat wél de titel mee, zodat een week met een recept dat nog niet
 * binnen is toch iets leesbaars toont.
 */
export async function GET(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const query = new URL(request.url).searchParams;
  const maandag = startOfWeek(fromParam(query.get("week") ?? undefined));

  const [regels, thuis] = await Promise.all([
    prisma.menuEntry.findMany({
      where: { date: weekRange(maandag) },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { recipe: { select: { id: true, title: true } } },
    }),
    huishouden(),
  ]);

  return Response.json({
    week: toParam(maandag),
    huishouden: thuis,
    regels: regels.map((regel) => ({
      id: regel.id,
      dag: dagAlsTekst(regel.date),
      receptId: regel.recipe.id,
      titel: regel.recipe.title,
      // Null betekent "zoals het recept het bedoelde"; de app hoeft dan niet
      // te weten wat het huishouden is om er iets van te maken.
      porties: regel.servings,
    })),
  });
}

type Invoer = { receptId?: unknown; dag?: unknown; porties?: unknown };

/** Een gerecht op een dag zetten. */
export async function POST(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  let invoer: Invoer;
  try {
    invoer = (await request.json()) as Invoer;
  } catch {
    return Response.json({ fout: "ongeldige_body" }, { status: 400 });
  }

  const receptId = typeof invoer.receptId === "string" ? invoer.receptId.trim() : "";
  const dag = typeof invoer.dag === "string" ? invoer.dag.trim() : "";
  if (!receptId || !dag) {
    return Response.json(
      { fout: "onvolledig", uitleg: "Geef receptId en dag mee (dag als 2026-08-16)." },
      { status: 400 },
    );
  }

  const bestaat = await prisma.recipe.findUnique({
    where: { id: receptId },
    select: { id: true },
  });
  if (!bestaat) return Response.json({ fout: "niet_gevonden" }, { status: 404 });

  const gevraagd = Number(invoer.porties);
  const porties = Number.isInteger(gevraagd)
    ? Math.min(Math.max(gevraagd, MIN_SERVINGS), MAX_SERVINGS)
    : await huishouden();

  const regel = await prisma.menuEntry.create({
    data: { recipeId: receptId, date: midnight(fromParam(dag)), servings: porties },
  });

  return Response.json(
    {
      id: regel.id,
      dag: dagAlsTekst(regel.date),
      receptId,
      porties: regel.servings,
      week: toParam(startOfWeek(regel.date)),
    },
    { status: 201 },
  );
}
