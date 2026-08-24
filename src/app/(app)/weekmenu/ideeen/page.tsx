import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Vastkop } from "@/components/Vastkop";
import { icons } from "@/lib/icons";
import { voorkeuren, ideeenblad } from "@/lib/settings";
import { momentTekst } from "@/lib/tijd";
import { eisen } from "@/lib/voorkeuren";
import { haalIdeeen, ideeNaarInbox } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Iets nieuws" };

/**
 * Iets om te maken dat nog niet van jullie is.
 *
 * De rest van de app kijkt naar binnen. Deze pagina is de enige die naar buiten
 * kijkt, en ze doet dat één keer per keer dat je erom vraagt — niet bij elk
 * bezoek. Vandaar de knop en de datum erbij: je ziet wat je hebt en of het nog
 * vers is, en je beslist zelf of het opnieuw mag.
 */
export default async function IdeeenPagina() {
  const [blad, wensen] = await Promise.all([
    ideeenblad(),
    voorkeuren(),
  ]);
  const gevraagd = eisen(wensen);

  return (
    <main>
      <Link href="/weekmenu" className="back">
        <Icon icon={icons.back} size={16} />
        Terug naar de week
      </Link>

      <div className="page-head">
        <h1>Iets nieuws</h1>
        <p>
          Gerechten die nog niet van jullie zijn, gekozen op wat er in de
          kooklog staat.
        </p>
      </div>
      <Vastkop titel="Iets nieuws" />

      <p className="muted hint">
        Er wordt hier geen recept verzonnen. Er wordt een gerecht voorgesteld en
        een bestaande receptpagina bij gezocht; die link gaat daarna door
        dezelfde molen als alles wat je vanuit Safari of Instagram deelt.
      </p>

      {(gevraagd.dieet.length > 0 || gevraagd.afkeer.length > 0) && (
        <p className="notice">
          Er wordt rekening gehouden met jullie{" "}
          <Link href="/instellingen">voorkeuren</Link>
          {gevraagd.dieet.length > 0 && <>: {gevraagd.dieet.join(", ")}</>}
          {gevraagd.afkeer.length > 0 && <> — geen {gevraagd.afkeer.join(", ")}</>}.
        </p>
      )}

      <form action={haalIdeeen} className="row ideeen-knop">
        <button type="submit" className="grow">
          <Icon icon={icons.ideas} size={17} />
          {blad ? "Nieuwe ideeën" : "Bedenk iets"}
        </button>
      </form>

      {blad?.fout && (
        <p className="bezwaar" role="alert">
          <Icon icon={icons.warning} size={15} />
          <span>
            {blad.fout}
            {blad.ideeen.length > 0 && " Wat je hieronder ziet, is van de vorige keer."}
          </span>
        </p>
      )}

      {blad && blad.ideeen.length > 0 ? (
        <>
          <ul className="ideeen">
            {blad.ideeen.map((idee) => (
              <li key={idee.gerecht}>
                <h2>{idee.gerecht}</h2>
                <p className="waarom">{idee.waarom}</p>

                {idee.url ? (
                  <div className="idee-voet">
                    <a href={idee.url} target="_blank" rel="noreferrer" className="bron">
                      <Icon icon={icons.source} size={14} />
                      {idee.bron ?? "Bekijk het recept"}
                    </a>
                    <form action={ideeNaarInbox}>
                      <input type="hidden" name="url" value={idee.url} />
                      <input type="hidden" name="gerecht" value={idee.gerecht} />
                      <button type="submit" className="secondary">
                        <Icon icon={icons.plus} size={15} />
                        Toevoegen
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="muted hint">
                    Hier is geen bron bij gevonden. Zoek je er zelf een, dan kun
                    je die <Link href="/inbox">in de inbox plakken</Link>.
                  </p>
                )}
              </li>
            ))}
          </ul>

          <p className="muted hint">
            Opgehaald {momentTekst(new Date(blad.opgehaald), new Date())}.
          </p>
        </>
      ) : (
        !blad?.fout && (
          <div className="empty">
            <p>Nog niets bedacht.</p>
            <p>
              Hoe voller de kooklog, hoe beter dit wordt: de voorstellen komen
              uit wat jullie maakten en wat je ervan vond.
            </p>
          </div>
        )
      )}
    </main>
  );
}
