import { after } from "next/server";
import { controleerToegang } from "@/lib/api/toegang";
import { prisma } from "@/lib/db";
import { keepDuplicate, processShareItem } from "@/lib/pipeline";
import { deletePhotos, parsePhotos } from "@/lib/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Opdracht = { doe?: unknown; tekst?: unknown };

/**
 * Iets doen met een item dat vastliep.
 *
 * Twee opdrachten, want dat zijn de twee dingen die je vanuit de inbox wilt
 * kunnen: nog eens proberen (eventueel met tekst die je er zelf bij plakt,
 * de uitweg voor Instagram achter een loginmuur), en "toch toevoegen" bij iets
 * dat als duplicaat is aangemerkt.
 *
 * `after()` eromheen, net als bij delen: opnieuw verwerken kost een
 * modelaanroep, en daar hoort een telefoon niet op te wachten.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const { id } = await context.params;

  let opdracht: Opdracht;
  try {
    opdracht = (await request.json()) as Opdracht;
  } catch {
    return Response.json({ fout: "ongeldige_body" }, { status: 400 });
  }

  const item = await prisma.shareItem.findUnique({ where: { id }, select: { id: true } });
  if (!item) return Response.json({ fout: "niet_gevonden" }, { status: 404 });

  switch (opdracht.doe) {
    case "opnieuw": {
      const tekst = typeof opdracht.tekst === "string" ? opdracht.tekst.trim() : "";
      if (tekst) {
        await prisma.shareItem.update({ where: { id }, data: { sharedText: tekst } });
      }
      after(() => processShareItem(id));
      return Response.json({ id, status: "processing" }, { status: 202 });
    }
    case "toch": {
      after(() => keepDuplicate(id));
      return Response.json({ id, status: "processing" }, { status: 202 });
    }
    default:
      return Response.json(
        { fout: "onbekende_opdracht", uitleg: 'Geef doe mee: "opnieuw" of "toch".' },
        { status: 400 },
      );
  }
}

/**
 * Een item weggooien, met het recept eraan vast.
 *
 * Dezelfde volgorde als op de website: eerst de rijen, dan de bestanden. Blijft
 * er een foto achter, dan is dat rommel op schijf; andersom hou je een item met
 * een dode foto over.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const { id } = await context.params;
  const item = await prisma.shareItem.findUnique({
    where: { id },
    select: { photos: true },
  });
  if (!item) return Response.json({ verwijderd: 0 });

  await prisma.$transaction([
    prisma.recipe.deleteMany({ where: { shareItemId: id } }),
    prisma.shareItem.deleteMany({ where: { id } }),
  ]);
  await deletePhotos(parsePhotos(item.photos));

  return Response.json({ verwijderd: 1 });
}
