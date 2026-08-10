import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleFavorite } from "@/app/actions";
import { prisma } from "@/lib/db";
import { recipeSchema, type Ingredient } from "@/lib/recipe/schema";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.recipe.findUnique({ where: { id } });
  if (!row) notFound();

  const parsed = recipeSchema.safeParse(JSON.parse(row.data));
  if (!parsed.success) {
    // Kan alleen gebeuren als het schema wijzigt onder bestaande data. Beter
    // een eerlijke melding dan een lege pagina.
    return (
      <main>
        <h1>{row.title}</h1>
        <p className="muted">
          Dit recept is opgeslagen in een oudere vorm en kan niet worden
          getoond. Verwerk de bron opnieuw vanuit de <Link href="/inbox">inbox</Link>.
        </p>
      </main>
    );
  }
  const recipe = parsed.data;

  return (
    <main>
      <article className="recipe-hero">
        {row.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" />
        )}
        <h1>{recipe.title}</h1>
        {recipe.description && <p className="muted">{recipe.description}</p>}

        <div className="row" style={{ marginTop: "0.75rem" }}>
          <form action={toggleFavorite}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className="secondary">
              {row.favorite ? "★ Favoriet" : "☆ Favoriet maken"}
            </button>
          </form>
          {row.sourceUrl && (
            <a className="sans" href={row.sourceUrl} target="_blank" rel="noreferrer">
              Bron{row.sourceName ? `: ${row.sourceName}` : ""} ↗
            </a>
          )}
        </div>
      </article>

      <div className="facts">
        {recipe.servings !== null && (
          <div>
            <span>Porties</span>
            {recipe.servings}
          </div>
        )}
        {recipe.prepMinutes !== null && (
          <div>
            <span>Voorbereiden</span>
            {recipe.prepMinutes} min
          </div>
        )}
        {recipe.cookMinutes !== null && (
          <div>
            <span>Bereiden</span>
            {recipe.cookMinutes} min
          </div>
        )}
        {recipe.totalMinutes !== null && (
          <div>
            <span>Totaal</span>
            {recipe.totalMinutes} min
          </div>
        )}
      </div>

      {recipe.ingredientGroups.length > 0 && (
        <section>
          <h2 className="section">Ingrediënten</h2>
          {recipe.ingredientGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.name && <h3 className="group">{group.name}</h3>}
              <ul className="ingredients">
                {group.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <span className="amount">{formatAmount(item)}</span>
                    <span>
                      {item.name}
                      {item.note && (
                        <span className="muted">, {item.note}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <h2 className="section">Bereiding</h2>
          <ol className="steps">
            {recipe.steps.map((step, index) => (
              <li key={index}>
                {step.title && <strong>{step.title}</strong>}
                {step.text}
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.tips.length > 0 && (
        <div className="callout">
          <h3>Tips</h3>
          <ul>
            {recipe.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {recipe.assumptions.length > 0 && (
        <div className="callout">
          <h3>Zelf aangevuld</h3>
          <ul>
            {recipe.assumptions.map((assumption, index) => (
              <li key={index}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      {recipe.tags.length > 0 && (
        <div className="tags">
          {recipe.tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}

function formatAmount(item: Ingredient): string {
  const quantity =
    item.quantity === null ? "" : formatNumber(item.quantity);
  return [quantity, item.unit].filter(Boolean).join(" ");
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  // Half, kwart en derde lezen prettiger als breuk dan als 0,33.
  const fractions: Array<[number, string]> = [
    [0.25, "¼"],
    [0.33, "⅓"],
    [0.5, "½"],
    [0.67, "⅔"],
    [0.75, "¾"],
  ];
  const whole = Math.floor(value);
  const rest = value - whole;
  const match = fractions.find(([fraction]) => Math.abs(rest - fraction) < 0.02);
  if (match) return whole > 0 ? `${whole}${match[1]}` : match[1];
  return value.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}
