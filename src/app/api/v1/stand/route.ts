import { controleerToegang } from "@/lib/api/toegang";
import { API_VERSIE } from "@/lib/api/vorm";
import { prisma } from "@/lib/db";
import { huishouden, people, voorkeuren } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wat er is, en hoe oud het is.
 *
 * Dit is het hele synchronisatiemechanisme: één lijst van alle recept-id's met
 * hun `bijgewerkt`. De app vergelijkt die met wat hij lokaal heeft en weet dan
 * drie dingen tegelijk — wat er nieuw is, wat er veranderd is, en wat er weg is
 * (namelijk alles wat hij wél heeft en hier niet in staat).
 *
 * Geen tijdstempel-vraag met een grafveld erbij, dus. Dat zou minder bytes
 * schelen en een hele klasse bugs opleveren: een verwijderd recept moet je
 * bijhouden in een tabel die je nooit mag opschonen, en een client die een
 * ronde mist ziet het nooit meer. Bij een paar honderd recepten is de hele
 * lijst een paar kilobyte, en dan is "alles vergelijken" simpelweg beter — zoals
 * ook het zoeken en de duplicaatcontrole in deze app dat al doen.
 */
export async function GET(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const [recepten, thuis, namen, wensen, open] = await Promise.all([
    prisma.recipe.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    huishouden(),
    people(),
    voorkeuren(),
    prisma.shareItem.count({
      where: { status: { in: ["pending", "processing", "failed", "needs_input", "duplicate"] } },
    }),
  ]);

  return Response.json({
    versie: API_VERSIE,
    nu: new Date().toISOString(),
    recepten: recepten.map((rij) => ({
      id: rij.id,
      bijgewerkt: rij.updatedAt.toISOString(),
    })),
    instellingen: {
      huishouden: thuis,
      personen: namen,
      // De voorkeuren gaan mee in de stand en niet als eigen aanroep: ze zijn
      // klein, ze veranderen zelden, en de app heeft ze nodig vóór hij een
      // scherm kan tekenen waar iets van afhangt.
      voorkeuren: Object.fromEntries(
        Object.entries(wensen).map(([naam, wens]) => [
          naam,
          { dieet: wens.dieet, afkeer: wens.afkeer, zwanger: wens.zwanger },
        ]),
      ),
    },
    inbox: { open },
  });
}
