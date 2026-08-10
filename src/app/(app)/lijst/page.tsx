import { addListItem, chooseStore, clearCheckedItems, clearList } from "@/app/actions";
import { ShoppingList } from "@/components/ShoppingList";
import { STORES, STORE_LABELS } from "@/lib/shopping/aisles";
import { getStore, groupedList } from "@/lib/shopping/list";

export const dynamic = "force-dynamic";

export default async function ListPage() {
  const store = await getStore();
  const groups = await groupedList(store);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const checked = groups.reduce(
    (sum, group) => sum + group.items.filter((item) => item.checked).length,
    0,
  );
  const sources = new Set(
    groups.flatMap((group) => group.items.map((item) => item.fromRecipe)).filter(Boolean),
  );

  return (
    <main>
      <div className="page-head">
        <h1>Boodschappen</h1>
        <p>
          De volgorde volgt de looproute van {STORE_LABELS[store]}.
        </p>
      </div>

      {/* De winkelkeuze bepaalt alleen de volgorde van de kopjes; je lijst
          blijft dezelfde. */}
      <form action={chooseStore} className="rail">
        {STORES.map((option) => (
          <button
            key={option}
            type="submit"
            name="store"
            value={option}
            className={`chip ${option === store ? "on" : ""}`}
          >
            {STORE_LABELS[option]}
          </button>
        ))}
      </form>

      {total === 0 ? (
        <div className="empty">
          <p>De lijst is leeg.</p>
          <p>
            Open een recept en tik op <strong>Op de lijst</strong>, of zet
            hieronder zelf iets erbij.
          </p>
        </div>
      ) : (
        <ShoppingList groups={groups} showSource={sources.size > 1} />
      )}

      <form action={addListItem} className="add-item">
        <input
          type="text"
          name="name"
          placeholder="Zelf iets toevoegen…"
          autoComplete="off"
          required
        />
        <button type="submit">Toevoegen</button>
      </form>

      {total > 0 && (
        <div className="row list-actions">
          {checked > 0 && (
            <form action={clearCheckedItems}>
              <button type="submit" className="secondary">
                Afgevinkte weghalen ({checked})
              </button>
            </form>
          )}
          <form action={clearList}>
            <button type="submit" className="quiet">
              Hele lijst leegmaken
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
