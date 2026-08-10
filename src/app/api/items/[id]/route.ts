import { isAuthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Statuscheck voor de Shortcut: is het item al een recept geworden? */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await prisma.shareItem.findUnique({
    where: { id },
    include: { recipe: { select: { id: true, title: true } } },
  });

  if (!item) {
    return Response.json({ error: "Niet gevonden" }, { status: 404 });
  }

  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  return Response.json({
    id: item.id,
    status: item.status,
    error: item.error,
    recipe: item.recipe
      ? {
          id: item.recipe.id,
          title: item.recipe.title,
          url: `${base}/recepten/${item.recipe.id}`,
        }
      : null,
  });
}
