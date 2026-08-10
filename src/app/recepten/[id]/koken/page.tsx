import Link from "next/link";
import { notFound } from "next/navigation";
import { CookMode } from "@/components/CookMode";
import { prisma } from "@/lib/db";
import { recipeSchema } from "@/lib/recipe/schema";

export const dynamic = "force-dynamic";

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.recipe.findUnique({ where: { id } });
  if (!row) notFound();

  const parsed = recipeSchema.safeParse(JSON.parse(row.data));
  if (!parsed.success) {
    return (
      <main>
        <p className="muted">
          Dit recept kan niet in kookmodus worden getoond. Verwerk de bron
          opnieuw vanuit de <Link href="/inbox">inbox</Link>.
        </p>
      </main>
    );
  }

  return <CookMode recipe={parsed.data} recipeId={row.id} />;
}
