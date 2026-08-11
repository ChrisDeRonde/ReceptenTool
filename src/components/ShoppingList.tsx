"use client";

import { useOptimistic, useTransition } from "react";
import { removeListItem, toggleListItem } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import {
  AISLE_LABELS,
  STORE_LABELS,
  searchUrl,
  type Aisle,
  type Store,
} from "@/lib/shopping/aisles";
import { formatAmount } from "@/lib/shopping/units";

export type ListItem = {
  id: string;
  name: string;
  /** Genormaliseerde naam; de sleutel waarop de prijs is opgezocht. */
  key: string;
  quantity: number | null;
  unit: string | null;
  aisle: string;
  checked: boolean;
  fromRecipe: string | null;
};

/**
 * De lijst zelf.
 *
 * Client component om één reden: afvinken moet direct doorgaan. Wachten op de
 * server voordat het vinkje omgaat voelt in een supermarkt met slecht bereik
 * als een kapotte app, dus de UI loopt vooruit en de server volgt.
 */
export type PriceInfo = {
  price: string | null;
  title: string | null;
  url: string | null;
};

export function ShoppingList({
  groups,
  showSource,
  store,
  prices,
  total,
}: {
  groups: { aisle: Aisle; items: ListItem[] }[];
  /** Bij één recept op de lijst weet je de herkomst wel; dan is het ruis. */
  showSource: boolean;
  /** Waar de zoekknop per regel naartoe wijst. */
  store: Store;
  /** Wat we al van de winkel weten, per ingrediëntsleutel. Mag leeg zijn. */
  prices: Record<string, PriceInfo>;
  /** Geschat totaal van wat nog te halen is, of null als er iets ontbreekt. */
  total: string | null;
}) {
  const [, startTransition] = useTransition();
  const flat = groups.flatMap((group) => group.items);

  const [optimistic, apply] = useOptimistic(
    flat,
    (state: ListItem[], change: { id: string; checked?: boolean; gone?: boolean }) =>
      change.gone
        ? state.filter((item) => item.id !== change.id)
        : state.map((item) =>
            item.id === change.id ? { ...item, checked: change.checked ?? item.checked } : item,
          ),
  );

  const seen = new Map(optimistic.map((item) => [item.id, item]));
  const open = optimistic.filter((item) => !item.checked).length;

  const toggle = (item: ListItem) =>
    startTransition(async () => {
      apply({ id: item.id, checked: !item.checked });
      await toggleListItem(item.id, !item.checked);
    });

  const remove = (item: ListItem) =>
    startTransition(async () => {
      apply({ id: item.id, gone: true });
      await removeListItem(item.id);
    });

  return (
    <div className="list">
      <p className="list-count">
        {open === 0
          ? "Alles afgevinkt."
          : `${open} ${open === 1 ? "ding" : "dingen"} te halen`}
        {total && open > 0 && <span className="total">± {total}</span>}
      </p>

      {groups.map((group) => {
        const items = group.items
          .map((item) => seen.get(item.id))
          .filter((item): item is ListItem => item !== undefined);
        if (items.length === 0) return null;

        return (
          <section key={group.aisle} className="aisle">
            <h2 className="eyebrow">{AISLE_LABELS[group.aisle]}</h2>
            <ul>
              {items.map((item) => (
                <li key={item.id} className={item.checked ? "done" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggle(item)}
                    />
                    <span className="tick" aria-hidden>
                      <Icon icon={icons.done} size={14} />
                    </span>
                    <span className="what">
                      <span className="name">{item.name}</span>
                      {showSource && item.fromRecipe && (
                        <span className="from">{item.fromRecipe}</span>
                      )}
                    </span>
                    <span className="amount">
                      {formatAmount({ quantity: item.quantity, unit: item.unit })}
                      {prices[item.key]?.price && (
                        <span className="price">{prices[item.key].price}</span>
                      )}
                    </span>
                  </label>
                  {!item.checked && (
                    // Opent de app van de winkel op dit product. Toevoegen doe
                    // je daar zelf — zie de opmerking bij searchUrl.
                    <a
                      className="to-store"
                      // Kennen we het exacte product, dan gaan we daarheen;
                      // anders naar de zoekpagina.
                      href={prices[item.key]?.url ?? searchUrl(store, item.name)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${item.name} bij ${STORE_LABELS[store]}`}
                      title={prices[item.key]?.title ?? `Opzoeken bij ${STORE_LABELS[store]}`}
                    >
                      <Icon icon={icons.basket} size={16} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => remove(item)}
                    aria-label={`${item.name} van de lijst halen`}
                  >
                    <Icon icon={icons.close} size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
