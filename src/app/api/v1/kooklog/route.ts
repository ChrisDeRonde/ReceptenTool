import { controleerToegang } from "@/lib/api/toegang";
import { kooklog } from "@/lib/api/vorm";
import { prisma } from "@/lib/db";
import { fromParam, midnight } from "@/lib/menu/week";
import { bekendeNaam } from "@/lib/people";
import { people } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Invoer = {
  receptId?: unknown;
  gemaaktOp?: unknown;
  sterren?: unknown;
  notitie?: unknown;
  vaker?: unknown;
  wie?: unknown;
};

/**
 * Vastleggen dat je iets gemaakt hebt.
 *
 * Dit is het enige wat je op een telefoon in een keuken écht doet, dus het is
 * de eerste schrijfactie die de app krijgt. Alles mag leeg: soms wil je alleen
 * weten dát je het maakte, en een formulier dat een oordeel afdwingt vul je na
 * één keer niet meer in.
 *
 * `wie` gaat door dezelfde controle als op de website: alleen een naam die in
 * het huishouden staat komt erdoorheen. De app bepaalt niet wie er bestaat.
 */
export async function POST(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  let invoer: Invoer;
  try {
    invoer = (await request.json()) as Invoer;
  } catch {
    return Response.json({ fout: "ongeldige_body" }, { status: 400 });
  }

  const receptId = tekst(invoer.receptId);
  if (!receptId) {
    return Response.json(
      { fout: "receptId_ontbreekt", uitleg: "Geef mee welk recept je maakte." },
      { status: 400 },
    );
  }

  const bestaat = await prisma.recipe.findUnique({
    where: { id: receptId },
    select: { id: true },
  });
  if (!bestaat) return Response.json({ fout: "niet_gevonden" }, { status: 404 });

  const dag = tekst(invoer.gemaaktOp);
  const sterren = Number(invoer.sterren);

  const regel = await prisma.cookLog.create({
    data: {
      recipeId: receptId,
      // Standaard vandaag; achteraf invullen mag ook. Onzin in het veld levert
      // vandaag op, net als op de website — `fromParam` vangt dat af.
      cookedAt: dag ? midnight(fromParam(dag)) : midnight(new Date()),
      rating: Number.isInteger(sterren) && sterren >= 1 && sterren <= 5 ? sterren : null,
      note: tekst(invoer.notitie),
      again: typeof invoer.vaker === "boolean" ? invoer.vaker : null,
      who: bekendeNaam(invoer.wie, await people()),
    },
  });

  return Response.json(kooklog(regel), { status: 201 });
}

function tekst(waarde: unknown): string | null {
  if (typeof waarde !== "string") return null;
  const schoon = waarde.trim();
  return schoon.length > 0 ? schoon : null;
}
