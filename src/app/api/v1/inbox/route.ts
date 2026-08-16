import { controleerToegang } from "@/lib/api/toegang";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Meer dan dit terugkijken is geschiedenis, geen inbox. */
const HOOGUIT = 50;

/**
 * Wat er binnenkwam en hoe het afliep.
 *
 * Zonder deze lijst is delen vanuit de app een gebaar zonder antwoord: je tikt
 * op deel, en dan? Hier staat of het een recept is geworden, of het bleef
 * hangen, en waarom.
 *
 * Standaard alleen wat nog aandacht vraagt. `?alles=1` geeft de hele recente
 * lijst, voor als je wilt terugkijken.
 */
export async function GET(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const alles = new URL(request.url).searchParams.get("alles") === "1";
  const open = ["pending", "processing", "failed", "needs_input", "duplicate"];

  const items = await prisma.shareItem.findMany({
    where: alles ? {} : { status: { in: open } },
    orderBy: { createdAt: "desc" },
    take: HOOGUIT,
    include: {
      recipe: { select: { id: true, title: true } },
      duplicateOf: { select: { id: true, title: true } },
    },
  });

  return Response.json({
    items: items.map((item) => ({
      id: item.id,
      status: item.status,
      binnengekomen: item.createdAt.toISOString(),
      bronType: item.sourceType,
      bronUrl: item.sourceUrl,
      // De gedeelde tekst afkappen: een Instagram-bijschrift van drieduizend
      // tekens hoort niet in een lijstweergave.
      tekst: item.sharedText?.slice(0, 280) ?? null,
      door: item.sharedBy,
      fout: item.error,
      recept: item.recipe ? { id: item.recipe.id, titel: item.recipe.title } : null,
      lijktOp: item.duplicateOf
        ? { id: item.duplicateOf.id, titel: item.duplicateOf.title }
        : null,
    })),
  });
}
