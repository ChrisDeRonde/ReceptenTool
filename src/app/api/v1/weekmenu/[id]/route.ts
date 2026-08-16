import { controleerToegang } from "@/lib/api/toegang";
import { dagAlsTekst } from "@/lib/api/vorm";
import { prisma } from "@/lib/db";
import { MAX_SERVINGS, MIN_SERVINGS } from "@/lib/recipe/scale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Een gerecht van het menu halen.
 *
 * `deleteMany` en niet `delete`: tikt de app op een trage verbinding twee keer,
 * dan is de tweede een lege opdracht in plaats van een fout. Dezelfde keuze als
 * op de website, om dezelfde reden.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const { id } = await context.params;
  const { count } = await prisma.menuEntry.deleteMany({ where: { id } });

  return Response.json({ verwijderd: count });
}

/**
 * Voor hoeveel mensen je het die dag maakt.
 *
 * Alleen dit veld is te wijzigen. Wil je een ander gerecht op die dag, dan haal
 * je hem weg en zet je er een nieuwe neer — dat is één tik meer en het scheelt
 * een endpoint dat twee dingen tegelijk doet.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const { id } = await context.params;

  let invoer: { porties?: unknown };
  try {
    invoer = (await request.json()) as { porties?: unknown };
  } catch {
    return Response.json({ fout: "ongeldige_body" }, { status: 400 });
  }

  const gevraagd = Number(invoer.porties);
  if (!Number.isInteger(gevraagd)) {
    return Response.json(
      { fout: "porties_ontbreekt", uitleg: "Geef porties mee als heel getal." },
      { status: 400 },
    );
  }

  const bestaat = await prisma.menuEntry.findUnique({ where: { id }, select: { id: true } });
  if (!bestaat) return Response.json({ fout: "niet_gevonden" }, { status: 404 });

  const regel = await prisma.menuEntry.update({
    where: { id },
    data: { servings: Math.min(Math.max(gevraagd, MIN_SERVINGS), MAX_SERVINGS) },
    include: { recipe: { select: { id: true, title: true } } },
  });

  return Response.json({
    id: regel.id,
    dag: dagAlsTekst(regel.date),
    receptId: regel.recipe.id,
    titel: regel.recipe.title,
    porties: regel.servings,
  });
}
