import Link from "next/link";
import {
  addSource,
  deleteItem,
  fetchRecipeImages,
  keepAnyway,
  retryItem,
} from "@/app/actions";
import { logout } from "@/app/login/actions";
import {
  STALE_AFTER_DAYS,
  backupAgeDays,
  readBackupStatus,
} from "@/lib/backup";
import { Icon } from "@/components/Icon";
import { PhotoForm } from "@/components/PhotoForm";
import { prisma } from "@/lib/db";
import { configuredPeople, currentPerson } from "@/lib/who";
import { icons } from "@/lib/icons";
import { parsePhotos, photoUrl } from "@/lib/photos";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "In wachtrij", tone: "busy" },
  processing: { label: "Bezig", tone: "busy" },
  done: { label: "Klaar", tone: "ok" },
  failed: { label: "Mislukt", tone: "bad" },
  needs_input: { label: "Tekst nodig", tone: "bad" },
  duplicate: { label: "Heb je al", tone: "warn" },
};

export default async function InboxPage() {
  const items = await prisma.shareItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      recipe: { select: { id: true, title: true } },
      duplicateOf: { select: { id: true, title: true } },
    },
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
                  {item.sharedBy && `${item.sharedBy} · `}
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

              {item.status === "duplicate" && item.duplicateOf ? (
                <div className="dupe">
                  <p>
                    {item.error} Je hebt al{" "}
                    <Link href={`/recepten/${item.duplicateOf.id}`}>
                      {item.duplicateOf.title}
                    </Link>
                    .{" "}
                    {item.pendingData
                      ? "Het nieuwe recept staat klaar en is nog niet opgeslagen."
                      : "Er is geen modelaanroep gedaan, dus dit heeft niets gekost."}
                  </p>
                  <form action={keepAnyway}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="secondary">
                      <Icon icon={icons.plus} size={16} />
                      Toch toevoegen
                    </button>
                  </form>
                </div>
              ) : (
                item.error && <p className="trail">{item.error}</p>
              )}

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

      <RemoteImageLine />
      <BackupLine />

      {/* De inbox is de servicehoek van de app, dus hier hangen ook wisselen
          en uitloggen. */}
      <div className="signout">
        <WhoLine />
        <form action={logout}>
          <button type="submit" className="quiet">
            <Icon icon={icons.logout} size={15} />
            Uitloggen
          </button>
        </form>
      </div>
    </main>
  );
}

/** Wie ben je nu, en hoe wissel je. Alleen als er namen zijn ingesteld. */
async function WhoLine() {
  const who = await currentPerson();
  if (configuredPeople().length === 0) return null;

  return (
    <p className="whoami">
      <Icon icon={icons.people} size={15} />
      {who ? (
        <>
          Je noteert als <strong>{who}</strong>.{" "}
          <Link href="/wie?verder=%2Finbox">Wisselen</Link>
        </>
      ) : (
        <>
          Nog geen naam gekozen.{" "}
          <Link href="/wie?verder=%2Finbox">Zeg wie je bent</Link>
        </>
      )}
    </p>
  );
}

/**
 * Recepten die hun foto nog bij de bron ophalen.
 *
 * Nieuwe imports slaan hem meteen zelf op; dit is voor alles wat er al stond.
 * De regel verdwijnt zodra er niets meer te halen valt, dus hij staat er niet
 * voor eeuwig als meubilair.
 */
async function RemoteImageLine() {
  const remaining = await prisma.recipe.count({
    where: { imageUrl: { startsWith: "http" } },
  });
  if (remaining === 0) return null;

  return (
    <form action={fetchRecipeImages} className="backup">
      <Icon icon={icons.photo} size={15} />
      <span>
        {remaining === 1
          ? "Eén recept haalt zijn foto nog bij de bron op."
          : `${remaining} recepten halen hun foto nog bij de bron op.`}{" "}
        Zolang dat zo is, verdwijnt de foto als die site hem verplaatst.{" "}
        <button type="submit" className="linky">
          Nu binnenhalen
        </button>
      </span>
    </form>
  );
}

/**
 * Draait de back-up nog?
 *
 * De klassieke manier waarop een back-up faalt is niet met een foutmelding
 * maar met stilte: de cron staat uit, de schijf zit vol, en je merkt het pas
 * op de dag dat je hem nodig hebt. Eén regel hier maakt dat zichtbaar.
 */
async function BackupLine() {
  const status = await readBackupStatus();

  if (!status) {
    return (
      <p className="backup none">
        <Icon icon={icons.settings} size={15} />
        Nog geen back-up gemaakt. Draai <code>npm run db:backup</code>, of zet
        hem in de cron.
      </p>
    );
  }

  const days = backupAgeDays(status);
  const stale = days > STALE_AFTER_DAYS;

  return (
    <p className={`backup ${stale ? "none" : ""}`}>
      <Icon icon={stale ? icons.settings : icons.done} size={15} />
      Laatste back-up {relative(days)}: {status.recipes}{" "}
      {status.recipes === 1 ? "recept" : "recepten"} en {status.photos}{" "}
      {status.photos === 1 ? "foto" : "foto's"}.
      {stale && " Dat is langer geleden dan de bedoeling is."}
    </p>
  );
}

function relative(days: number): string {
  if (days < 1 / 24) return "zojuist";
  if (days < 1) return `${Math.round(days * 24)} uur geleden`;
  const whole = Math.round(days);
  return whole === 1 ? "gisteren" : `${whole} dagen geleden`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
