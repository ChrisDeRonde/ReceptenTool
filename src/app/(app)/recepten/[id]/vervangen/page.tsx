import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Knop } from "@/components/Knop";
import { Vastkop } from "@/components/Vastkop";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import { DIETS, DIET_LABELS } from "@/lib/recipe/categories";
import { formatAmount } from "@/lib/recipe/format";
import { flattenIngredients, recipeSchema } from "@/lib/recipe/schema";
import { voorkeuren } from "@/lib/settings";
import { eisen } from "@/lib/voorkeuren";
import { zoekVervangingen } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Vervangen" };

/**
 * Waarmee kun je dit ingrediënt vervangen?
 *
 * Een eigen pagina en geen uitklap op de receptpagina. Twee redenen: het
 * antwoord komt van het model en duurt dus even, en de vraag heeft een
 * voorkant nodig — welk dieet moet het halen, en waarom vervang je het. Dat
 * past niet naast een regel in een ingrediëntenlijst.
 *
 * Het antwoord staat in de URL en niet in de database. Het is een vraag van
 * dit moment: morgen heb je wél crème fraîche in huis.
 */
export default async function VervangenPagina({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const row = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true, title: true, data: true },
  });
  if (!row) notFound();

  const parsed = recipeSchema.safeParse(JSON.parse(row.data));
  if (!parsed.success) notFound();

  const ingredienten = flattenIngredients(parsed.data);
  const gekozen = readOne(query.ing);
  const wensen = await voorkeuren();
  const gevraagd = eisen(wensen);

  return (
    <main>
      <Link href={`/recepten/${row.id}`} className="back">
        <Icon icon={icons.back} size={16} />
        Terug naar het recept
      </Link>

      <div className="page-head">
        <h1>Vervangen</h1>
        <p>{row.title}</p>
      </div>
      <Vastkop titel="Vervangen" meta={row.title} />

      <form action={zoekVervangingen} className="editor">
        <input type="hidden" name="receptId" value={row.id} />

        <section>
          <h2 className="section" style={{ marginTop: 0 }}>
            Wat wil je vervangen?
          </h2>
          <div className="vervang-lijst">
            {ingredienten.map((item, index) => {
              const label = [formatAmount(item), item.name].filter(Boolean).join(" ");
              return (
                <label key={index} className="check">
                  <input
                    type="radio"
                    name="ingredient"
                    value={label}
                    defaultChecked={gekozen ? gekozen === label : index === 0}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="section">Waar moet het aan voldoen?</h2>
          {/* De voorkeuren van het huishouden staan alvast aan: dat is de
              vraag die je negen van de tien keer stelt. */}
          <p className="muted hint">
            Wat hier aanstaat komt uit jullie instellingen. Vink af of bij wat
            voor déze keer geldt.
          </p>
          <div className="checks">
            {DIETS.map((diet) => (
              <label key={diet} className="check">
                <input
                  type="checkbox"
                  name="dieet"
                  value={diet}
                  defaultChecked={gevraagd.dieet.includes(diet)}
                />
                <span>{DIET_LABELS[diet]}</span>
              </label>
            ))}
          </div>

          <label className="field">
            <span className="eyebrow">Waarom (mag leeg)</span>
            <input
              type="text"
              name="reden"
              placeholder="Heb ik niet in huis"
              autoComplete="off"
              maxLength={120}
              defaultValue={readOne(query.reden) ?? ""}
            />
          </label>
        </section>

        <div className="editor-bar">
          <Knop className="grow" bezigLabel="Even denken…">
            <Icon icon={icons.ideas} size={17} />
            Zoek een vervanging
          </Knop>
        </div>
      </form>

      {readOne(query.fout) && (
        <p className="notice" role="alert">
          {readOne(query.fout)}
        </p>
      )}

      {readOne(query.uit) && <Uitkomst ruw={readOne(query.uit) as string} />}
    </main>
  );
}

/**
 * Het antwoord, uit de URL.
 *
 * Onleesbare rommel levert niets op in plaats van een half scherm: de
 * parameter komt van ons eigen redirect, maar hij staat in een adresbalk en
 * daar kan iedereen in typen.
 */
function Uitkomst({ ruw }: { ruw: string }) {
  let lijst: Array<{ waarmee: string; hoeveel: string; gevolg: string }> = [];
  try {
    const blob = JSON.parse(ruw);
    if (Array.isArray(blob)) lijst = blob;
  } catch {
    return null;
  }

  if (lijst.length === 0) {
    return (
      <p className="notice">
        Hier is geen goede vervanging voor. Dat is ook een antwoord — beter dan
        iets dat het gerecht verandert in iets anders.
      </p>
    );
  }

  return (
    <section className="vervangingen">
      <h2 className="section">Dit zou kunnen</h2>
      <ul>
        {lijst.map((v, index) => (
          <li key={index}>
            <p className="vervang-wat">
              <strong>{v.waarmee}</strong>
              {v.hoeveel && <span className="vervang-hoeveel">{v.hoeveel}</span>}
            </p>
            <p className="vervang-gevolg">{v.gevolg}</p>
          </li>
        ))}
      </ul>

      {/* Dit hoort erbij en niet weggevouwen: een vervanging die "lactosevrij"
          heet is een suggestie van een taalmodel, geen etiket van een
          fabrikant. */}
      <p className="muted footnote">
        Voorgesteld door het model, op basis van wat het ingrediënt in dit
        gerecht doet. Geen medisch advies: wie ergens ziek van wordt leest de
        verpakking, niet dit scherm.
      </p>
    </section>
  );
}

function readOne(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}
