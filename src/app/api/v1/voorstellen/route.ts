import { controleerToegang } from "@/lib/api/toegang";
import { prisma } from "@/lib/db";
import { fromParam, startOfWeek, toParam, weekRange } from "@/lib/menu/week";
import { haalVoorstellen } from "@/lib/menu/voorstellen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wat zullen we deze week eten?
 *
 * Dit blijft op de server en gaat niet mee naar het toestel, ook al is de motor
 * een pure functie. Twee redenen: hij hangt aan de kooklog van álle telefoons
 * samen, en de weging is precies het soort ding dat je wilt kunnen bijstellen
 * zonder een nieuwe versie door TestFlight te duwen.
 *
 * Wat er al gepland staat wordt hier zelf opgezocht — een app die dat mee moet
 * sturen kan het mis hebben, en dan verschijnt er een voorstel voor iets dat
 * woensdag al op tafel staat.
 */
export async function GET(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const query = new URL(request.url).searchParams;
  const maandag = startOfWeek(fromParam(query.get("week") ?? undefined));
  const inHuis = query.get("ligt") ?? "";

  const gepland = await prisma.menuEntry.findMany({
    where: { date: weekRange(maandag) },
    select: { recipe: { select: { id: true, cuisine: true } } },
  });

  const { voorstellen, termen, gevraagd } = await haalVoorstellen({
    gepland: gepland.map((regel) => ({
      id: regel.recipe.id,
      cuisine: regel.recipe.cuisine,
    })),
    inHuis,
    aantal: aantalUit(query.get("aantal")),
  });

  return Response.json({
    week: toParam(maandag),
    // De termen zoals de motor ze heeft opgevat, niet zoals je ze typte: dan
    // kan de app tonen waarop hij eigenlijk zocht.
    gezochtOp: termen,
    voorkeuren: { dieet: gevraagd.dieet, afkeer: gevraagd.afkeer },
    voorstellen: voorstellen.map((voorstel) => ({
      receptId: voorstel.id,
      titel: voorstel.title,
      reden: voorstel.reason,
      treffers: voorstel.treffers,
    })),
  });
}

/** Meer dan tien is geen suggestie meer maar een tweede overzicht. */
function aantalUit(waarde: string | null): number | undefined {
  const getal = Number(waarde);
  if (!Number.isInteger(getal) || getal < 1) return undefined;
  return Math.min(getal, 10);
}
