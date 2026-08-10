import Link from "next/link";
import { addSource, deleteItem, retryItem } from "@/app/actions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "In wachtrij",
  processing: "Bezig",
  done: "Klaar",
  failed: "Mislukt",
  needs_input: "Tekst nodig",
};

export default async function InboxPage() {
  const items = await prisma.shareItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { recipe: { select: { id: true, title: true } } },
  });

  return (
    <main>
      <section>
        <h2 className="section" style={{ marginTop: 0 }}>
          Handmatig toevoegen
        </h2>
        <form action={addSource} className="stack">
          <input type="url" name="url" placeholder="https://…" />
          <textarea
            name="text"
            placeholder="Of plak hier de recepttekst (bijvoorbeeld een Instagram-bijschrift)"
          />
          <div className="row">
            <button type="submit">Verwerken</button>
            <span className="muted sans" style={{ fontSize: "0.85rem" }}>
              Duurt ongeveer een halve minuut.
            </span>
          </div>
        </form>
      </section>

      <h2 className="section">Binnengekomen</h2>
      {items.length === 0 ? (
        <p className="empty">Nog niets gedeeld.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className={`badge ${item.status === "failed" ? "failed" : ""}`}>
                {STATUS_LABEL[item.status] ?? item.status}
              </span>
              <span className="muted sans" style={{ fontSize: "0.8rem" }}>
                {item.createdAt.toLocaleString("nl-NL")}
              </span>
            </div>

            <div style={{ marginTop: "0.6rem" }}>
              {item.recipe ? (
                <Link href={`/recepten/${item.recipe.id}`}>
                  {item.recipe.title}
                </Link>
              ) : (
                <span className="muted">
                  {item.sourceUrl ?? truncate(item.sharedText ?? "", 120)}
                </span>
              )}
            </div>

            {item.sourceUrl && item.recipe && (
              <div className="meta">
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {item.sourceUrl}
                </a>
              </div>
            )}

            {item.error && (
              <p className="muted sans" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                {item.error}
              </p>
            )}

            {(item.status === "failed" || item.status === "needs_input") && (
              <form action={retryItem} className="stack" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                <input type="hidden" name="id" value={item.id} />
                {item.status === "needs_input" && (
                  <textarea
                    name="text"
                    placeholder="Plak hier de recepttekst en probeer opnieuw"
                    defaultValue={item.sharedText ?? ""}
                  />
                )}
                <div className="row">
                  <button type="submit">Opnieuw proberen</button>
                </div>
              </form>
            )}

            <form action={deleteItem} style={{ marginTop: "0.5rem" }}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="secondary">
                Verwijderen
              </button>
            </form>
          </div>
        ))
      )}
    </main>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
