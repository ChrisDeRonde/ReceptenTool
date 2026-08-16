import { after } from "next/server";
import { controleerToegang } from "@/lib/api/toegang";
import { prisma } from "@/lib/db";
import { detectSourceType } from "@/lib/extract";
import { bekendeNaam } from "@/lib/people";
import { processShareItem } from "@/lib/pipeline";
import { people } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Een link of een stuk tekst binnenbrengen, vanuit de app.
 *
 * Naast `/api/share` en niet in plaats daarvan. Dat endpoint hangt aan
 * `INGEST_TOKEN` en blijft bestaan voor de Shortcut; dit hangt aan het token dat
 * de app toch al in de Keychain heeft, zodat de deelextensie geen tweede geheim
 * hoeft te kennen. Eén geheim minder op een telefoon is er één minder om kwijt
 * te raken.
 *
 * Antwoordt met 202 zodra het veilig is opgeslagen; het ophalen en verwerken
 * gebeurt daarna via `after()`. De deelextensie mag niet dertig seconden op een
 * modelaanroep blijven wachten — dan houdt iOS hem tegen.
 */
export async function POST(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  let invoer: { url?: unknown; tekst?: unknown; door?: unknown };
  try {
    invoer = (await request.json()) as typeof invoer;
  } catch {
    return Response.json({ fout: "ongeldige_body" }, { status: 400 });
  }

  const url = tekstOf(invoer.url);
  const tekst = tekstOf(invoer.tekst);
  if (!url && !tekst) {
    return Response.json(
      { fout: "leeg", uitleg: "Geef minstens een url of tekst mee." },
      { status: 400 },
    );
  }

  const item = await prisma.shareItem.create({
    data: {
      status: "pending",
      sourceType: detectSourceType(url),
      sourceUrl: url,
      sharedText: tekst,
      // Dezelfde controle als overal: alleen een naam die in het huishouden
      // staat komt erdoorheen. De app bepaalt niet wie er bestaat.
      sharedBy: bekendeNaam(invoer.door, await people()),
    },
  });

  after(() => processShareItem(item.id));

  return Response.json({ id: item.id, status: item.status }, { status: 202 });
}

function tekstOf(waarde: unknown): string | null {
  if (typeof waarde !== "string") return null;
  const schoon = waarde.trim();
  return schoon.length > 0 ? schoon : null;
}
