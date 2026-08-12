import Link from "next/link";
import { notFound } from "next/navigation";
import { CookMode } from "@/components/CookMode";
import { prisma } from "@/lib/db";
import { huishouden } from "@/lib/settings";
import { parseServings, scaleRecipe } from "@/lib/recipe/scale";
import { recipeSchema } from "@/lib/recipe/schema";

export const dynamic = "force-dynamic";

export default async function CookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const row = await prisma.recipe.findUnique({ where: { id } });
  if (!row) notFound();

  const parsed = recipeSchema.safeParse(JSON.parse(row.data));
  if (!parsed.success) {
    return (
      <main className="shell">
        <p className="muted">
          Dit recept kan niet in kookmodus worden getoond. Verwerk de bron
          opnieuw vanuit de <Link href="/inbox">inbox</Link>.
        </p>
      </main>
    );
  }

  const base = parsed.data;

  // Het aantal personen is op de receptpagina gekozen en reist mee in de URL.
  // Hier omrekenen in plaats van in de client: dan hoeft CookMode niets van
  // schalen te weten en tonen de stappen meteen de juiste hoeveelheden.
  // Dezelfde terugval als daar, want deze pagina is ook los te openen — vanuit
  // een bladwijzer of het beginscherm — en dan mag het aantal niet ineens
  // anders zijn dan wat je op het recept zag staan.
  const servings = parseServings(query.porties, base.servings, await huishouden());
  const recipe = servings === null ? base : scaleRecipe(base, servings);

  return (
    <CookMode
      recipe={recipe}
      baseServings={base.servings}
      backHref={
        servings !== null && servings !== base.servings
          ? `/recepten/${row.id}?porties=${servings}`
          : `/recepten/${row.id}`
      }
    />
  );
}
