import { controleerToegang } from "@/lib/api/toegang";
import { receptVol } from "@/lib/api/vorm";
import { prisma } from "@/lib/db";

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
