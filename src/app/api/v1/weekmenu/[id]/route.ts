import { controleerToegang } from "@/lib/api/toegang";
import { prisma } from "@/lib/db";

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
