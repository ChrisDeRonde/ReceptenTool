import { controleerToegang } from "@/lib/api/toegang";
import { receptVol, type ApiRecept } from "@/lib/api/vorm";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hooguit zoveel recepten per aanroep.
 *
 * Niet omdat de server het niet trekt, maar omdat een app die met een slechte
 * verbinding om vijfhonderd volledige recepten vraagt, één keer twintig
 * seconden hangt en daarna opnieuw begint. In brokken kan hij tonen wat er al
 * is en verdergaan waar hij gebleven was.
 */
const PER_KEER = 50;

/**
 * Volledige recepten ophalen, op id.
 *
 * Welke id's je nodig hebt, weet je uit `/api/v1/stand`. Geef je er geen op,
 * dan krijg je de nieuwste — handig om een verse installatie te vullen zonder
 * eerst te hoeven rekenen.
 */
export async function GET(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const query = new URL(request.url).searchParams;
  const gevraagd = leesIds(query.get("ids"));

  if (gevraagd && gevraagd.length > PER_KEER) {
    return Response.json(
      {
        fout: "te_veel",
        uitleg: `Vraag er hooguit ${PER_KEER} tegelijk; er stonden er ${gevraagd.length} in ids.`,
      },
      { status: 400 },
    );
  }

  const rijen = await prisma.recipe.findMany({
    where: gevraagd ? { id: { in: gevraagd } } : {},
    orderBy: { updatedAt: "desc" },
    take: PER_KEER,
    include: {
      cookLogs: { orderBy: [{ cookedAt: "desc" }, { createdAt: "desc" }] },
    },
  });

  // Een recept met een onleesbare blob levert `null` op. Dat overslaan in
  // plaats van de hele aanroep laten mislukken: één stuk oude data hoort de
  // synchronisatie niet tegen te houden. De id's staan er wel bij, zodat de
  // app weet dat hij ze niet nóg een keer hoeft te proberen.
  const recepten: ApiRecept[] = [];
  const onleesbaar: string[] = [];

  for (const rij of rijen) {
    const recept = receptVol(rij, rij.cookLogs);
    if (recept) recepten.push(recept);
    else onleesbaar.push(rij.id);
  }

  return Response.json({ recepten, onleesbaar });
}

function leesIds(waarde: string | null): string[] | null {
  if (!waarde) return null;
  const ids = [...new Set(waarde.split(",").map((id) => id.trim()).filter(Boolean))];
  return ids.length > 0 ? ids : null;
}
