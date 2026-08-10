import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [recipes, openItems] = await Promise.all([
    prisma.recipe.findMany({
      orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.shareItem.count({
      where: { status: { in: ["pending", "processing", "needs_input", "failed"] } },
    }),
  ]);

  return (
    <main>
      {openItems > 0 && (
        <p className="sans" style={{ marginTop: 0 }}>
          <Link href="/inbox">
            {openItems} {openItems === 1 ? "item wacht" : "items wachten"} in de
            inbox →
          </Link>
        </p>
      )}

      {recipes.length === 0 ? (
        <div className="empty">
          <p>Nog geen recepten.</p>
          <p className="sans">
            Deel een link vanuit Instagram, de AH-app of Safari, of{" "}
            <Link href="/inbox">voeg er handmatig een toe</Link>.
          </p>
        </div>
      ) : (
        recipes.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/recepten/${recipe.id}`}
            className="card"
          >
            <h2>
              {recipe.favorite && "★ "}
              {recipe.title}
            </h2>
            {recipe.description && <p>{recipe.description}</p>}
            <div className="meta">
              {recipe.sourceName && <span>{recipe.sourceName}</span>}
              {recipe.servings && <span>{recipe.servings} personen</span>}
              {recipe.totalMinutes && <span>{recipe.totalMinutes} min</span>}
              {recipe.tags && <span>{recipe.tags.split(",").join(" · ")}</span>}
            </div>
          </Link>
        ))
      )}
    </main>
  );
}
