import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/CookLog";
import { Icon } from "@/components/Icon";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import { people } from "@/lib/settings";
import { currentPerson } from "@/lib/who";

export const dynamic = "force-dynamic";

/**
 * Jouw hoek van de app.
 *
 * De kooklog verzamelt per recept wat iemand ervan vond; hier staat het
 * andersom, per persoon. Dat is de enige plek waar je "wat vind ík hier
 * eigenlijk van" kunt zien zonder recept voor recept te bladeren.
 */
export default async function ProfielPagina() {
  const wie = await currentPerson();
  const namen = await people();

  if (!wie) {
    return (
      <main>
        <div className="page-head">
          <h1>Ik</h1>
          <p>Nog geen naam gekozen.</p>
        </div>

        <p className="muted">
          {namen.length > 0 ? (
            <>
              Zeg wie je bent, dan krijgt een oordeel in de kooklog een naam.{" "}
              <Link href="/wie?verder=%2Fik">Kiezen</Link>
            </>
          ) : (
            <>
              Er zijn nog geen namen ingesteld. Zet ze bij de{" "}
              <Link href="/instellingen">instellingen</Link> en dan komt deze
              pagina tot leven.
            </>
          )}
        </p>

        <p className="beheer-link">
          <Link href="/instellingen">
            <Icon icon={icons.settings} size={16} />
            Instellingen
          </Link>
        </p>
      </main>
    );
  }

  const [logs, gedeeld, bewerkt] = await Promise.all([
    prisma.cookLog.findMany({
      where: { who: wie },
      orderBy: [{ cookedAt: "desc" }],
      include: { recipe: { select: { id: true, title: true } } },
    }),
    prisma.shareItem.count({ where: { sharedBy: wie } }),
    prisma.recipe.count({ where: { editedBy: wie } }),
  ]);

  const beoordeeld = logs.filter((log) => log.rating !== null);
  const gemiddelde =
    beoordeeld.length > 0
      ? beoordeeld.reduce((som, log) => som + (log.rating ?? 0), 0) / beoordeeld.length
      : null;

  // Wat jij het hoogst zette, nieuwste eerst bij gelijke sterren.
  const toppers = [...beoordeeld]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || +b.cookedAt - +a.cookedAt)
    .filter((log, index, alle) => alle.findIndex((x) => x.recipeId === log.recipeId) === index)
    .slice(0, 5);

  const vaker = logs
    .filter((log) => log.again === true)
    .filter((log, index, alle) => alle.findIndex((x) => x.recipeId === log.recipeId) === index)
    .slice(0, 5);

  return (
    <main>
      <div className="profiel-kop">
        <Avatar name={wie} size={64} />
        <div>
          <h1>{wie}</h1>
          <p className="muted">
            <Link href="/wie?verder=%2Fik">Wisselen</Link>
          </p>
        </div>
      </div>

      <div className="facts">
        <div className="fact">
          <span>Gekookt</span>
          <strong>{logs.length}×</strong>
        </div>
        {gemiddelde !== null && (
          <div className="fact">
            <span>Jouw gemiddelde</span>
            <strong>{gemiddelde.toFixed(1).replace(".", ",")}</strong>
          </div>
        )}
        <div className="fact">
          <span>Toegevoegd</span>
          <strong>{gedeeld}</strong>
        </div>
        {bewerkt > 0 && (
          <div className="fact">
            <span>Bijgewerkt</span>
            <strong>{bewerkt}</strong>
          </div>
        )}
      </div>

      {logs.length === 0 && (
        <p className="muted hint">
          Je hebt nog niets vastgelegd. Aan het eind van de kookmodus staat de
          knop ervoor klaar.
        </p>
      )}

      {toppers.length > 0 && (
        <section>
          <h2 className="section">Wat jij het hoogst zette</h2>
          <ul className="mijn-lijst">
            {toppers.map((log) => (
              <li key={log.id}>
                <Link href={`/recepten/${log.recipe.id}`}>{log.recipe.title}</Link>
                <Stars value={log.rating ?? 0} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {vaker.length > 0 && (
        <section>
          <h2 className="section">Wilde je vaker eten</h2>
          <ul className="mijn-lijst">
            {vaker.map((log) => (
              <li key={log.id}>
                <Link href={`/recepten/${log.recipe.id}`}>{log.recipe.title}</Link>
                <span className="again yes">
                  <Icon icon={icons.again} size={12} />
                  vaker
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="beheer-link">
        <Link href="/instellingen">
          <Icon icon={icons.settings} size={16} />
          Instellingen
        </Link>
      </p>
    </main>
  );
}
