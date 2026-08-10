import Link from "next/link";
import { addSource, deleteItem, retryItem } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { PhotoForm } from "@/components/PhotoForm";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import { parsePhotos, photoUrl } from "@/lib/photos";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "In wachtrij", tone: "busy" },
  processing: { label: "Bezig", tone: "busy" },
  done: { label: "Klaar", tone: "ok" },
  failed: { label: "Mislukt", tone: "bad" },
  needs_input: { label: "Tekst nodig", tone: "bad" },
};

export default async function InboxPage() {
  const items = await prisma.shareItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { recipe: { select: { id: true, title: true } } },
  });

  return (
    <main>
      <div className="page-head">
        <h1>Inbox</h1>
        <p>Alles wat je deelt komt hier binnen — ook als het misgaat.</p>
      </div>

      <section>
        <h2 className="section" style={{ marginTop: 0 }}>
          Recept fotograferen
        </h2>
        <p className="muted" style={{ margin: "-0.4rem 0 0.9rem", fontSize: "0.88rem" }}>
          Een kookboekpagina, een kaartje, het schoolbord in een restaurant. Twee
          pagina&apos;s? Maak er twee foto&apos;s van, dan worden het samen één recept.
        </p>
        <PhotoForm />
      </section>

      <section>
        <h2 className="section">Link of tekst</h2>
        <form action={addSource} className="stack">
          <input type="url" name="url" placeholder="https://…" />
          <textarea
            name="text"
            placeholder="Of plak hier de recepttekst (bijvoorbeeld een Instagram-bijschrift)"
          />
          <div className="row">
            <button type="submit">Verwerken</button>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Duurt ongeveer een halve minuut.
            </span>
          </div>
        </form>
      </section>

      <h2 className="section">Binnengekomen</h2>
      {items.length === 0 ? (
        <div className="empty">
          <p>Nog niets gedeeld.</p>
        </div>
      ) : (
        items.map((item) => {
          const status = STATUS[item.status] ?? {
            label: item.status,
            tone: "",
          };
          const photos = parsePhotos(item.photos);

          return (
            <div key={item.id} className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className={`status ${status.tone}`}>{status.label}</span>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {item.createdAt.toLocaleString("nl-NL")}
                </span>
              </div>

              <div style={{ marginTop: "0.6rem" }}>
                {item.recipe ? (
                  <Link
                    href={`/recepten/${item.recipe.id}`}
                    style={{ fontWeight: 500 }}
                  >
                    {item.recipe.title}
                  </Link>
                ) : (
                  <span className="muted">
                    {item.sourceUrl ?? truncate(item.sharedText ?? "", 120)}
                  </span>
                )}
              </div>

              {photos.length > 0 && (
                <div className="shots">
                  {photos.map((photo) => (
                    <a
                      key={photo.name}
                      href={photoUrl(photo)}
                      target="_blank"
                      rel="noreferrer"
                      className="shot"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(photo)} alt="" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}

              {item.sourceUrl && item.recipe && (
                <p className="trail">
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    {item.sourceUrl}
                  </a>
                </p>
              )}

              {item.strategy && (
                <p className="trail">opgehaald via {item.strategy}</p>
              )}

              {item.error && <p className="trail">{item.error}</p>}

              {(item.status === "failed" || item.status === "needs_input") && (
                <form
                  action={retryItem}
                  className="stack"
                  style={{ marginTop: "0.75rem" }}
                >
                  <input type="hidden" name="id" value={item.id} />
                  {item.status === "needs_input" && (
                    <textarea
                      name="text"
                      placeholder="Plak hier de recepttekst en probeer opnieuw"
                      defaultValue={item.sharedText ?? ""}
                    />
                  )}
                  <div className="row">
                    <button type="submit" className="secondary">
                      <Icon icon={icons.reset} size={16} />
                      Opnieuw proberen
                    </button>
                  </div>
                </form>
              )}

              <form action={deleteItem} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="quiet">
                  <Icon icon={icons.delete} size={15} />
                  Verwijderen
                </button>
              </form>
            </div>
          );
        })
      )}
    </main>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
