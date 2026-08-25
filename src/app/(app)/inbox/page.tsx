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
import { Knop } from "@/components/Knop";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Moment } from "@/components/Moment";
import { PhotoForm } from "@/components/PhotoForm";
import { Vastkop } from "@/components/Vastkop";
import { prisma } from "@/lib/db";
import { currentPerson } from "@/lib/who";
import { people } from "@/lib/settings";
import { momentTekst } from "@/lib/tijd";
import { icons } from "@/lib/icons";
import { parsePhotos, photoUrl } from "@/lib/photos";

export const dynamic = "force-dynamic";

export const metadata = { title: "Inbox" };

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
      <Vastkop titel="Inbox" />

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
          {/* Een placeholder is geen label: hij verdwijnt zodra je typt, en
              een schermlezer leest hem niet altijd voor. De naam staat er
              daarom apart bij. */}
          <input
            type="url"
            name="url"
            placeholder="https://…"
            aria-label="Link naar het recept"
          />
          <textarea
            name="text"
            placeholder="Of plak hier de recepttekst (bijvoorbeeld een Instagram-bijschrift)"
            aria-label="Recepttekst om te plakken"
          />
          <div className="row">
            <Knop>Verwerken</Knop>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Duurt ongeveer een halve minuut.
            </span>
          </div>
        </form>
      </section>

      <h2 className="section">Binnengekomen</h2>
      {items.length === 0 ? (
        // Net als op het overzicht: zeggen dát het leeg is helpt niemand
        // verder, zeggen wat je nu kunt doen wel. Dit is bovendien het scherm
        // waar iemand terechtkomt die nog nooit iets heeft gedeeld.
        <div className="empty">
          <p>Nog niets gedeeld.</p>
          <p>
            Deel een link vanuit Instagram, de AH-app of Safari naar Klapper,
            en hij komt hier binnen. Of plak er hierboven zelf een.
          </p>
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
                <span className="deler">
                  {item.sharedBy && <Avatar name={item.sharedBy} size={20} />}
                  <Moment>{momentTekst(item.createdAt, new Date())}</Moment>
                </span>
              </div>

              <div style={{ marginTop: "0.6rem" }}>
                {item.recipe ? (
                  <Link href={`/recepten/${item.recipe.id}`} className="bron-link">
                    {item.recipe.title}
                  </Link>
                ) : (
                  <span className="muted bron-tekst">
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
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bron-tekst"
                  >
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
                    <Knop className="secondary">
                      <Icon icon={icons.plus} size={16} />
                      Toch toevoegen
                    </Knop>
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
                      aria-label="Recepttekst om opnieuw te proberen"
                      defaultValue={item.sharedText ?? ""}
                    />
                  )}
                  <div className="row">
                    <Knop className="secondary">
                      <Icon icon={icons.reset} size={16} />
                      Opnieuw proberen
                    </Knop>
                  </div>
                </form>
              )}

              <form action={deleteItem} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="id" value={item.id} />
                <Knop className="quiet">
                  <Icon icon={icons.delete} size={15} />
                  Verwijderen
                </Knop>
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
          <Knop className="quiet">
            <Icon icon={icons.logout} size={15} />
            Uitloggen
          </Knop>
        </form>
      </div>
    </main>
  );
}

/** Wie ben je nu, en hoe wissel je. Alleen als er namen zijn ingesteld. */
async function WhoLine() {
  const who = await currentPerson();
  if ((await people()).length === 0) return null;

  return (
    <p className="whoami">
      <Icon icon={icons.people} size={15} />
      {/* De zin in één span: deze regel is een flexrij, en losse tekstdelen
          worden daarin eigen kolommen met een gat ertussen — dan staat de punt
          achter de naam los als "Chris ." */}
      {who ? (
        <span>
          Je noteert als <Avatar name={who} size={20} withName /> —{" "}
          <Link href="/wie?verder=%2Finbox">Wisselen</Link>
        </span>
      ) : (
        <span>
          Nog geen naam gekozen.{" "}
          <Link href="/wie?verder=%2Finbox">Zeg wie je bent</Link>
        </span>
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
        <Knop className="linky">
          Nu binnenhalen
        </Knop>
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
      <span>
        Laatste back-up <Moment>{relative(days)}</Moment>: {status.recipes}{" "}
        {status.recipes === 1 ? "recept" : "recepten"} en {status.photos}{" "}
        {status.photos === 1 ? "foto" : "foto's"}.
        {stale && " Dat is langer geleden dan de bedoeling is."}
      </span>
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
