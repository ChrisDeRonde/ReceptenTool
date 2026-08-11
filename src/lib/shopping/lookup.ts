import { prisma } from "@/lib/db";
import { fetchPage } from "@/lib/extract/fetchPage";
import { searchUrl, type Store } from "./aisles";
import { parseSearchPage, pickBest } from "./products";
import { canonicalName } from "./units";

/**
 * Van ingrediëntnaam naar een concreet product bij de supermarkt.
 *
 * Snelheid komt hier uit twee dingen, in deze volgorde van belang:
 *
 *  1. **De cache.** Uien, knoflook en olijfolie zitten in elk tweede recept.
 *     Eén keer opzoeken, daarna gratis. Ook een misser wordt bewaard, anders
 *     zoek je elke keer opnieuw naar iets dat er niet is.
 *  2. **Geen browser.** Een gewone fetch plus HTML-parsen is een fractie van
 *     wat een headless Chrome kost. Lukt dat niet, dan geeft de opzoeking op —
 *     liever geen prijs dan een halve minuut wachten.
 *
 * Niets hiervan zit in het pad van de gebruiker: de lijst is er meteen, de
 * prijzen druppelen erachteraan.
 */

/** Ouder dan dit en we halen de prijs op de achtergrond opnieuw op. */
const STALE_AFTER_DAYS = 7;
/** Een misser blijft korter staan; misschien heet het volgende week anders. */
const STALE_MISS_AFTER_DAYS = 2;

/** Hoeveel opzoekingen tegelijk. Meer is onnodig hard aankloppen. */
const CONCURRENCY = 3;

export type Match = {
  found: boolean;
  productId: string | null;
  title: string | null;
  brand: string | null;
  priceCents: number | null;
  unitInfo: string | null;
  imageUrl: string | null;
  url: string | null;
  strategy: string;
  ms: number;
  fetchedAt: Date;
};

export type Timing = {
  term: string;
  /** cache | fetch */
  source: "cache" | "fetch";
  fetchMs: number;
  parseMs: number;
  totalMs: number;
  strategy: string;
  found: boolean;
};

/** Alles wat we al weten, in één keer. Dit is het pad dat de pagina loopt. */
export async function cachedMatches(
  store: Store,
  keys: string[],
): Promise<Map<string, Match>> {
  if (keys.length === 0) return new Map();

  const rows = await prisma.productMatch.findMany({
    where: { store, key: { in: [...new Set(keys)] } },
  });

  return new Map(rows.map((row) => [row.key, row as Match]));
}

/**
 * Zoekt op wat nog niet in de cache staat. Bedoeld voor de achtergrond.
 * Geeft de tijden terug zodat de diagnose ze kan tonen.
 */
export async function fillMatches(
  store: Store,
  names: string[],
  options: { force?: boolean } = {},
): Promise<Timing[]> {
  const keys = [...new Set(names.map(canonicalName))].filter(Boolean);
  if (keys.length === 0) return [];

  const known = options.force ? new Map() : await cachedMatches(store, keys);
  const todo = keys.filter((key) => {
    const row = known.get(key);
    if (!row) return true;
    const days = (Date.now() - row.fetchedAt.getTime()) / 86_400_000;
    return days > (row.found ? STALE_AFTER_DAYS : STALE_MISS_AFTER_DAYS);
  });

  const timings: Timing[] = [];
  // In kleine groepjes tegelijk: sneller dan één voor één, en nog steeds
  // bescheiden tegenover de winkel.
  for (let index = 0; index < todo.length; index += CONCURRENCY) {
    const batch = todo.slice(index, index + CONCURRENCY);
    const results = await Promise.all(
      batch.map((key) => lookupAndStore(store, key)),
    );
    timings.push(...results);
  }
  return timings;
}

/** Eén term opzoeken en wegschrijven. Gooit nooit; een misser is ook een uitkomst. */
export async function lookupAndStore(store: Store, key: string): Promise<Timing> {
  const started = Date.now();
  let fetchMs = 0;
  let parseMs = 0;
  let strategy = "none";
  let best = null as ReturnType<typeof pickBest>;

  try {
    const url = searchUrl(store, key);

    const fetchStart = Date.now();
    const page = await fetchPage(url);
    fetchMs = Date.now() - fetchStart;

    const parseStart = Date.now();
    const parsed = parseSearchPage(page.html, url);
    best = pickBest(parsed.products, key);
    strategy = parsed.strategy;
    parseMs = Date.now() - parseStart;
  } catch {
    // Netwerk weg, blokkade, tijd op: als misser wegschrijven en door. Wat we
    // hier níét doen is de gebruiker laten wachten op een herkansing.
    strategy = "none";
  }

  const ms = Date.now() - started;
  const data = {
    store,
    key,
    found: best !== null,
    productId: best?.productId ?? null,
    title: best?.title ?? null,
    brand: best?.brand ?? null,
    priceCents: best?.priceCents ?? null,
    unitInfo: best?.unitInfo ?? null,
    imageUrl: best?.imageUrl ?? null,
    url: best?.url ?? null,
    strategy,
    ms,
    fetchedAt: new Date(),
  };

  await prisma.productMatch.upsert({
    where: { store_key: { store, key } },
    create: data,
    update: data,
  });

  return {
    term: key,
    source: "fetch",
    fetchMs,
    parseMs,
    totalMs: ms,
    strategy,
    found: data.found,
  };
}

export function formatPrice(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}
