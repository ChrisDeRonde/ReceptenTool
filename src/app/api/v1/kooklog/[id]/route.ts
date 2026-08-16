import { controleerToegang } from "@/lib/api/toegang";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Een kooklogregel weghalen.
 *
 * `deleteMany` en geen `delete`, om dezelfde reden als bij het weekmenu: twee
 * keer tikken op een trage verbinding hoort geen foutmelding op te leveren.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const { id } = await context.params;
  const { count } = await prisma.cookLog.deleteMany({ where: { id } });
  return Response.json({ verwijderd: count });
}
