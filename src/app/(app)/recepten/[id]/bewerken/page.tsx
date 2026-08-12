import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Vastkop } from "@/components/Vastkop";
import { RecipeEditor } from "@/components/RecipeEditor";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import { recipeSchema } from "@/lib/recipe/schema";
import { versieVan } from "@/lib/recipe/versie";

export const dynamic = "force-dynamic";

/**
 * De titel van het tabblad is de naam van het gerecht. Dat is precies wat je
 * zoekt als je drie tabbladen openhebt of terugbladert in je geschiedenis, en
 * het is het eerste wat een schermlezer voorleest bij het openen.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await prisma.recipe.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: row ? `${row.title} bewerken` : "Bewerken" };
}

export default async function EditRecipePage({
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
        <h1>{row.title}</h1>
        <p className="muted">
          Dit recept staat in een oudere vorm opgeslagen en kan niet bewerkt
          worden. Verwerk de bron opnieuw vanuit de{" "}
          <Link href="/inbox">inbox</Link>.
        </p>
      </main>
    );
  }

  return (
    <main>
      <Link href={`/recepten/${id}`} className="back">
        <Icon icon={icons.back} size={16} />
        Terug naar het recept
      </Link>

      <div className="page-head">
        <h1>Bewerken</h1>
        <p>
          Wat het model ervan maakte klopt meestal, maar niet altijd — en na
          twee keer koken weet jij het beter.
        </p>
      </div>
      <Vastkop titel="Bewerken" meta={parsed.data.title} />

      {/* De versie waarop dit formulier gebaseerd is; zie lib/recipe/versie.ts. */}
      <RecipeEditor id={id} recipe={parsed.data} versie={versieVan(row.editedAt)} />
    </main>
  );
}
