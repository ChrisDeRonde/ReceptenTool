"use client";

import { useActionState, useState } from "react";
import { updateRecipe, type BewerkStand } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { Moment } from "@/components/Moment";
import { icons } from "@/lib/icons";
import { formatAmount } from "@/lib/recipe/format";
import { flattenIngredients, type Recipe } from "@/lib/recipe/schema";

/**
 * Het recept zelf bijstellen.
 *
 * Twee dingen sturen het ontwerp. Ten eerste: dit gebeurt op een telefoon, dus
 * elk ingrediënt is één regel met een smal hoeveelheidsvakje en een breed
 * naamveld — geen vier losse velden per regel. Je typt "300 g", precies zoals
 * je het zou opschrijven; `parseAmount` maakt daar weer een getal en een
 * eenheid van, zodat omrekenen naar meer personen blijft werken.
 *
 * Ten tweede: rijen erbij en eraf vragen om JavaScript, maar de bestaande
 * velden wijzigen niet. Zonder JavaScript kun je dus nog steeds alles
 * aanpassen wat er al staat; alleen de plus- en prullenbakknoppen doen dan
 * niets. De rest van de app werkt ook zo.
 *
 * Het verborgen veld `versie` is de derde: daarmee merkt de server dat de ander
 * dit recept intussen ook heeft bijgewerkt. Zie `lib/recipe/versie.ts`. Het
 * formulier blijft dan gewoon staan met alles wat je hebt getypt erin — een
 * waarschuwing die je werk weggooit is erger dan de botsing zelf.
 */

type ItemRow = {
  /** Alleen om React de rijen uit elkaar te houden. */
  key: string;
  amount: string;
  name: string;
  note: string;
  /** Waar dit ingrediënt in het oorspronkelijke recept stond, of -1. */
  from: number;
};

type GroupRow = {
  key: string;
  name: string;
  items: ItemRow[];
};

type StepRow = {
  key: string;
  title: string;
  text: string;
  minutes: string;
  tip: string;
  refs: number[];
};

let counter = 0;
const nextKey = () => `r${(counter += 1)}`;

function toGroups(recipe: Recipe): GroupRow[] {
  let flat = 0;
  return recipe.ingredientGroups.map((group) => ({
    key: nextKey(),
    name: group.name ?? "",
    items: group.items.map((item) => ({
      key: nextKey(),
      amount: formatAmount(item),
      name: item.name,
      note: item.note ?? "",
      from: flat++,
    })),
  }));
}

export function RecipeEditor({
  id,
  recipe,
  versie,
}: {
  id: string;
  recipe: Recipe;
  /** Wanneer dit recept voor het laatst is bijgewerkt, toen je het opende. */
  versie: string;
}) {
  const [stand, opslaan] = useActionState<BewerkStand, FormData>(updateRecipe, {
    soort: "rust",
  });

  /**
   * Ook het bovenblok in state, net als de ingrediënten en de stappen
   * hieronder. Niet uit netheid: React zet een formulier na een `action` weer
   * op zijn beginwaarden, en met `defaultValue` was alles wat je in deze acht
   * velden had getypt weg op het moment dat de botsingsmelding verscheen —
   * precies wanneer je het nodig hebt. Wat React uit state tekent komt terug.
   */
  const [kop, setKop] = useState(() => ({
    titel: recipe.title,
    omschrijving: recipe.description ?? "",
    porties: recipe.servings?.toString() ?? "",
    voorbereiden: recipe.prepMinutes?.toString() ?? "",
    bereiden: recipe.cookMinutes?.toString() ?? "",
    totaal: recipe.totalMinutes?.toString() ?? "",
    tips: recipe.tips.join("\n"),
    tags: recipe.tags.join(", "),
  }));

  const zet = (veld: keyof typeof kop) => (waarde: string) =>
    setKop((oud) => ({ ...oud, [veld]: waarde }));
  const [groups, setGroups] = useState<GroupRow[]>(() => toGroups(recipe));
  const [steps, setSteps] = useState<StepRow[]>(() =>
    recipe.steps.map((step) => ({
      key: nextKey(),
      title: step.title ?? "",
      text: step.text,
      minutes: step.timerMinutes === null ? "" : String(step.timerMinutes),
      tip: step.tip ?? "",
      refs: step.ingredientRefs,
    })),
  );

  const total = flattenIngredients(recipe).length;

  const patchGroup = (gi: number, change: Partial<GroupRow>) =>
    setGroups((old) => old.map((g, i) => (i === gi ? { ...g, ...change } : g)));

  const patchItem = (gi: number, ii: number, change: Partial<ItemRow>) =>
    setGroups((old) =>
      old.map((g, i) =>
        i === gi
          ? { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, ...change } : it)) }
          : g,
      ),
    );

  const addItem = (gi: number) =>
    setGroups((old) =>
      old.map((g, i) =>
        i === gi
          ? {
              ...g,
              items: [...g.items, { key: nextKey(), amount: "", name: "", note: "", from: -1 }],
            }
          : g,
      ),
    );

  const removeItem = (gi: number, ii: number) =>
    setGroups((old) =>
      old.map((g, i) =>
        i === gi ? { ...g, items: g.items.filter((_, j) => j !== ii) } : g,
      ),
    );

  const addGroup = () =>
    setGroups((old) => [
      ...old,
      {
        key: nextKey(),
        name: "",
        items: [{ key: nextKey(), amount: "", name: "", note: "", from: -1 }],
      },
    ]);

  const patchStep = (si: number, change: Partial<StepRow>) =>
    setSteps((old) => old.map((s, i) => (i === si ? { ...s, ...change } : s)));

  const addStep = () =>
    setSteps((old) => [
      ...old,
      { key: nextKey(), title: "", text: "", minutes: "", tip: "", refs: [] },
    ]);

  const removeStep = (si: number) =>
    setSteps((old) => old.filter((_, i) => i !== si));

  return (
    <form action={opslaan} className="editor">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="versie" value={versie} />

      <section>
        <h2 className="section" style={{ marginTop: 0 }}>
          Het gerecht
        </h2>

        <label className="field">
          <span className="eyebrow">Titel</span>
          <input
            type="text"
            name="titel"
            value={kop.titel}
            onChange={(e) => zet("titel")(e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="eyebrow">Omschrijving</span>
          <textarea
            name="omschrijving"
            rows={2}
            value={kop.omschrijving}
            onChange={(e) => zet("omschrijving")(e.target.value)}
            placeholder="Eén of twee zinnen: wat het is en waarom het de moeite waard is."
          />
        </label>

        <div className="numbers">
          <label className="field">
            <span className="eyebrow">Personen</span>
            <input
              type="number"
              name="porties"
              min={1}
              max={24}
              value={kop.porties}
              onChange={(e) => zet("porties")(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="eyebrow">Voorbereiden</span>
            <input
              type="number"
              name="voorbereiden"
              min={0}
              value={kop.voorbereiden}
              onChange={(e) => zet("voorbereiden")(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="eyebrow">Bereiden</span>
            <input
              type="number"
              name="bereiden"
              min={0}
              value={kop.bereiden}
              onChange={(e) => zet("bereiden")(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="eyebrow">Totaal</span>
            <input
              type="number"
              name="totaal"
              min={0}
              value={kop.totaal}
              onChange={(e) => zet("totaal")(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="section">Ingrediënten</h2>
        <p className="muted hint">
          Schrijf de hoeveelheid zoals je hem zou opschrijven: <code>300 g</code>,{" "}
          <code>2 teentje</code>, <code>½ tl</code>. Laat je hem leeg, dan
          schaalt die regel niet mee met het aantal personen.
        </p>

        {groups.map((group, gi) => (
          <div key={group.key} className="ing-group">
            <input
              type="text"
              name={`groep.${gi}.naam`}
              value={group.name}
              onChange={(event) => patchGroup(gi, { name: event.target.value })}
              placeholder={gi === 0 ? "Kopje (bijv. Voor de saus) — mag leeg" : "Kopje"}
              className="group-name"
            />

            {group.items.map((item, ii) => (
              <div key={item.key} className="ing-row">
                <input type="hidden" name={`ing.${gi}.${ii}.van`} value={item.from} />
                <input
                  type="text"
                  name={`ing.${gi}.${ii}.hoeveelheid`}
                  value={item.amount}
                  onChange={(event) => patchItem(gi, ii, { amount: event.target.value })}
                  placeholder="300 g"
                  aria-label="Hoeveelheid"
                  className="amount-in"
                />
                <input
                  type="text"
                  name={`ing.${gi}.${ii}.naam`}
                  value={item.name}
                  onChange={(event) => patchItem(gi, ii, { name: event.target.value })}
                  placeholder="Ingrediënt"
                  aria-label="Ingrediënt"
                />
                <input
                  type="text"
                  name={`ing.${gi}.${ii}.notitie`}
                  value={item.note}
                  onChange={(event) => patchItem(gi, ii, { note: event.target.value })}
                  placeholder="fijngesneden"
                  aria-label="Notitie"
                  className="note-in"
                />
                <button
                  type="button"
                  className="icon quiet"
                  onClick={() => removeItem(gi, ii)}
                  aria-label={`${item.name || "Regel"} verwijderen`}
                >
                  <Icon icon={icons.delete} size={15} />
                </button>
              </div>
            ))}

            <button type="button" className="add" onClick={() => addItem(gi)}>
              <Icon icon={icons.plus} size={15} />
              Ingrediënt
            </button>
          </div>
        ))}

        <button type="button" className="add" onClick={addGroup}>
          <Icon icon={icons.plus} size={15} />
          Kopje erboven
        </button>
      </section>

      <section>
        <h2 className="section">Bereiding</h2>

        {steps.map((step, si) => (
          <div key={step.key} className="step-row">
            {/* De koppeling met de ingrediënten gaat onzichtbaar mee: die
                bewerk je niet met de hand, maar hij moet wel blijven kloppen
                als er regels bij komen of weggaan. */}
            <input type="hidden" name={`stap.${si}.refs`} value={step.refs.join(",")} />

            <div className="step-head">
              <span className="step-no">{si + 1}</span>
              <input
                type="text"
                name={`stap.${si}.titel`}
                value={step.title}
                onChange={(event) => patchStep(si, { title: event.target.value })}
                placeholder="Kop (mag leeg)"
              />
              <input
                type="number"
                name={`stap.${si}.minuten`}
                value={step.minutes}
                onChange={(event) => patchStep(si, { minutes: event.target.value })}
                min={0}
                placeholder="min"
                aria-label="Minuten voor de timer"
                className="min-in"
              />
              <button
                type="button"
                className="icon quiet"
                onClick={() => removeStep(si)}
                aria-label={`Stap ${si + 1} verwijderen`}
              >
                <Icon icon={icons.delete} size={15} />
              </button>
            </div>

            <textarea
              name={`stap.${si}.tekst`}
              value={step.text}
              onChange={(event) => patchStep(si, { text: event.target.value })}
              rows={3}
              placeholder="Wat je doet"
              aria-label={`Stap ${si + 1}`}
            />
            <input
              type="text"
              name={`stap.${si}.tip`}
              value={step.tip}
              onChange={(event) => patchStep(si, { tip: event.target.value })}
              placeholder="Tip bij deze stap (mag leeg)"
              aria-label={`Tip bij stap ${si + 1}`}
            />
          </div>
        ))}

        <button type="button" className="add" onClick={addStep}>
          <Icon icon={icons.plus} size={15} />
          Stap
        </button>
      </section>

      <section>
        <h2 className="section">Tot slot</h2>

        <label className="field">
          <span className="eyebrow">Tips — één per regel</span>
          <textarea
            name="tips"
            rows={4}
            value={kop.tips}
            onChange={(e) => zet("tips")(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="eyebrow">Tags — gescheiden door komma&apos;s</span>
          <input
            type="text"
            name="tags"
            value={kop.tags}
            onChange={(e) => zet("tags")(e.target.value)}
          />
        </label>
      </section>

      {/* De melding zit in hetzelfde plakkende blok als de knoppen. Zet je hem
          gewoon in de tekst, dan verschijnt hij onderaan het document terwijl
          de opslaanknop aan de onderkant van je scherm plakt — dan tik je op
          Opslaan en zie je niets gebeuren. */}
      <div className="editor-onderkant">
        {stand.soort === "botsing" && (
          <div className="botsing" role="alert">
            <p>
              <strong>{stand.wie}</strong>
              {stand.wanneer && (
                <>
                  {" "}
                  <Moment>{stand.wanneer}</Moment>
                </>
              )}
            </p>
            <p className="muted">
              Opslaan zou die versie overschrijven. Wat jij hebt ingevuld staat
              er nog; bekijk in een ander tabblad wat er nu staat, of sla het
              alsnog op.
            </p>
            <div className="row">
              {/* Naam en waarde van een verzendknop gaan mee in het formulier;
                  zo is dit dezelfde actie met één antwoord erbij. */}
              <button type="submit" name="forceren" value="1" className="secondary">
                Toch opslaan
              </button>
              {/* Een gewone link en geen knop: er valt hier één ding te
                  beslissen, en dat is de knop ernaast. */}
              <a href={`/recepten/${id}`} target="_blank" rel="noreferrer">
                Wat staat er nu?
              </a>
            </div>
          </div>
        )}

        <div className="editor-bar">
          <a href={`/recepten/${id}`} className="button secondary">
            Annuleren
          </a>
          <button type="submit" className="grow">
            <Icon icon={icons.done} size={17} />
            Opslaan
          </button>
        </div>
      </div>

      {total > 0 && steps.some((step) => step.refs.length > 0) && (
        <p className="muted hint">
          De koppeling tussen stappen en ingrediënten — waar de kookmodus op
          leunt — schuift mee. Haal je een ingrediënt weg, dan verdwijnt hij
          ook uit de stappen die hem noemden.
        </p>
      )}
    </form>
  );
}
