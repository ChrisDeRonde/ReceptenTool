"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizeDiets } from "@/lib/recipe/categories";
import { flattenIngredients, recipeSchema } from "@/lib/recipe/schema";
import { bedenkVervangingen, leesbareFout } from "@/lib/recipe/vervangen";

/**
 * De vraag stellen en het antwoord in de URL zetten.
 *
 * Via de URL en niet via de database: dit is een vraag van dit moment. Morgen
 * heb je wél crème fraîche in huis, en dan is het antwoord alleen nog ruis op
 * de receptpagina. Bijkomend voordeel: je kunt het naar de ander sturen.
 */
export async function zoekVervangingen(formData: FormData): Promise<void> {
  const receptId = lees(formData, "receptId");
  const ingredient = lees(formData, "ingredient");
  if (!receptId || !ingredient) return;

  const terug = `/recepten/${receptId}/vervangen`;
  const reden = lees(formData, "reden");
  const dieet = normalizeDiets(
    formData.getAll("dieet").filter((v): v is string => typeof v === "string"),
  );

  const row = await prisma.recipe.findUnique({
    where: { id: receptId },
    select: { title: true, data: true },
  });
  if (!row) redirect(terug);

  const parsed = recipeSchema.safeParse(JSON.parse(row.data));
  if (!parsed.success) redirect(terug);

  // Alleen de stappen waarin het ingrediënt genoemd wordt. Het hele recept
  // meesturen kost tokens en levert niets op: de vraag is wat dít ingrediënt
  // hier doet, niet hoe het gerecht in elkaar zit.
  const positie = flattenIngredients(parsed.data).findIndex((item) =>
    ingredient.includes(item.name),
  );
  const stappen = parsed.data.steps
    .filter((stap) => positie >= 0 && stap.ingredientRefs.includes(positie))
    .map((stap) => stap.text)
    .slice(0, 4);

  const vast = new URLSearchParams({ ing: ingredient });
  if (reden) vast.set("reden", reden);

  let uitkomst;
  try {
    uitkomst = await bedenkVervangingen({
      gerecht: row.title,
      ingredient,
      stappen,
      dieet,
      reden: reden ?? undefined,
    });
  } catch (fout) {
    vast.set("fout", leesbareFout(fout));
    redirect(`${terug}?${vast.toString()}`);
  }

  vast.set("uit", JSON.stringify(uitkomst));
  redirect(`${terug}?${vast.toString()}`);
}

function lees(formData: FormData, sleutel: string): string | null {
  const waarde = formData.get(sleutel);
  if (typeof waarde !== "string") return null;
  const schoon = waarde.trim();
  return schoon.length > 0 ? schoon : null;
}
