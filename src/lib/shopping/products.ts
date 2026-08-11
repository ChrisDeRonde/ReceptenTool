import * as cheerio from "cheerio";

/**
 * Een product uit een supermarkt-zoekpagina peuteren, zonder browser.
 *
 * Drie aanpakken, van betrouwbaar naar wanhopig:
 *
 *  1. `jsonld`   — schema.org/Product in een <script type="application/ld+json">.
 *                  Winkels zetten dit erin voor Google, dus het is stabiel en
 *                  het staat er los van hoe de pagina eruitziet.
 *  2. `embedded` — de datablob die een React- of Next-pagina meestuurt om
 *                  zichzelf mee op te bouwen. Vorm onbekend, dus we lopen de
 *                  JSON af op zoek naar objecten die op een product lijken.
 *  3. `dom`      — de productkaartjes uit de HTML. Werkt tot de eerste
 *                  restyling van de winkel en dan niet meer.
 *
 * Welke het werd staat in het resultaat, zodat je in de diagnose ziet waar je
 * op leunt in plaats van het te moeten raden.
 */

export type FoundProduct = {
  productId: string | null;
  title: string;
  brand: string | null;
  priceCents: number | null;
  unitInfo: string | null;
  imageUrl: string | null;
  url: string | null;
};

export type ParseResult = {
  strategy: "jsonld" | "embedded" | "dom" | "none";
  products: FoundProduct[];
};

export function parseSearchPage(html: string, baseUrl: string): ParseResult {
  // De scripts eerst met een regex eruit halen in plaats van de hele pagina in
  // cheerio te laden. Een zoekpagina is al gauw een megabyte, en een volledige
  // DOM-parse daarvan kost 200 ms terwijl we alleen bij de <script>-inhoud
  // moeten zijn. Voor de DOM-route hieronder gebruiken we wél een echte parser;
  // daar kan een regex het werk niet doen.
  const scripts = extractScripts(html);

  const jsonld = fromJsonLd(scripts, baseUrl);
  if (jsonld.length > 0) return { strategy: "jsonld", products: jsonld };

  const embedded = fromEmbeddedJson(scripts, baseUrl);
  if (embedded.length > 0) return { strategy: "embedded", products: embedded };

  const dom = fromDom(cheerio.load(html), baseUrl);
  if (dom.length > 0) return { strategy: "dom", products: dom };

  return { strategy: "none", products: [] };
}

type ScriptBlock = { type: string; body: string };

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const TYPE_RE = /\btype\s*=\s*["']?([^"'\s>]+)/i;

function extractScripts(html: string): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];
  for (const match of html.matchAll(SCRIPT_RE)) {
    const body = match[2].trim();
    if (!body) continue;
    blocks.push({
      type: (match[1].match(TYPE_RE)?.[1] ?? "").toLowerCase(),
      body,
    });
  }
  return blocks;
}

/* --- 1. JSON-LD ----------------------------------------------------------- */

function fromJsonLd(scripts: ScriptBlock[], baseUrl: string): FoundProduct[] {
  const found: FoundProduct[] = [];

  for (const script of scripts) {
    if (!script.type.includes("ld+json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.body);
    } catch {
      continue;
    }
    walk(parsed, 0, (node) => {
      if (!isProductLike(node)) return;
      const product = toProduct(node, baseUrl);
      if (product) found.push(product);
    });
  }

  return found;
}

function isProductLike(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((entry) => typeof entry === "string" && /product/i.test(entry));
}

/* --- 2. Ingebedde JSON ---------------------------------------------------- */

/**
 * De datablob van een JS-pagina. We weten niet hoe die eruitziet, dus zoeken we
 * naar objecten met een titel én een prijs — dat is in de praktijk een product
 * en bijna nooit iets anders.
 */
function fromEmbeddedJson(
  scripts: ScriptBlock[],
  baseUrl: string,
): FoundProduct[] {
  const found: FoundProduct[] = [];
  const seen = new Set<string>();

  for (const script of scripts) {
    if (script.body.length > 4_000_000) continue;

    // Alleen scripts die plausibel JSON zijn: een echt JSON-type, of een
    // toewijzing als `window.__DATA__ = {...}`.
    let candidate: string | null = null;
    if (script.type.includes("json")) {
      candidate = script.body;
    } else {
      candidate = script.body.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/)?.[1] ?? null;
    }
    if (!candidate) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }

    walk(parsed, 0, (node) => {
      const product = toProduct(node, baseUrl);
      if (!product) return;
      const fingerprint = `${product.productId ?? ""}|${product.title}`;
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      found.push(product);
    });
  }

  return found;
}

/* --- 3. De HTML zelf ------------------------------------------------------ */

function fromDom($: cheerio.CheerioAPI, baseUrl: string): FoundProduct[] {
  const cards = $(
    "[data-testhook='product-card'], article[class*='product' i], " +
      "li[class*='product' i], div[class*='ProductCard']",
  );

  const found: FoundProduct[] = [];
  cards.each((_, element) => {
    const card = $(element);
    const link = card.find("a[href*='/producten/'], a[href*='/product']").first();
    const title = text(
      card.find("[data-testhook='product-title'], h2, h3, [class*='title' i]").first(),
    );
    if (!title) return;

    const priceText = text(
      card.find("[data-testhook='price-amount'], [class*='price' i]").first(),
    );
    const href = link.attr("href");

    found.push({
      productId: href ? productIdFromUrl(href) : null,
      title,
      brand: text(card.find("[data-testhook='product-brand'], [class*='brand' i]").first()),
      priceCents: parsePrice(priceText),
      unitInfo: text(card.find("[class*='unit' i], [class*='size' i]").first()),
      imageUrl: card.find("img").first().attr("src") ?? null,
      url: href ? absolute(href, baseUrl) : null,
    });
  });

  return found;
}

/* --- Gedeeld -------------------------------------------------------------- */

/** Loopt een JSON-boom af en biedt elk object aan. Diep genoeg, niet oneindig. */
function walk(
  node: unknown,
  depth: number,
  visit: (node: Record<string, unknown>) => void,
): void {
  if (depth > 12 || node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) walk(child, depth + 1, visit);
    return;
  }

  const record = node as Record<string, unknown>;
  visit(record);
  for (const value of Object.values(record)) walk(value, depth + 1, visit);
}

/**
 * Maakt er een product van, of niets. Een titel en een prijs zijn het minimum:
 * zonder prijs is het voor een boodschappenlijst geen product maar een plaatje.
 */
function toProduct(
  node: Record<string, unknown>,
  baseUrl: string,
): FoundProduct | null {
  const title = firstString(node, ["title", "name", "productName", "displayName"]);
  if (!title || title.length > 200) return null;

  const priceCents = findPrice(node);
  if (priceCents === null) return null;

  const url = firstString(node, ["url", "link", "href", "webshopUrl"]);
  const image = findImage(node);
  const id = firstString(node, ["webshopId", "productId", "sku", "id", "code"]);

  return {
    productId: id ?? (url ? productIdFromUrl(url) : null),
    title: title.trim(),
    brand: firstString(node, ["brand", "brandName"]) ?? null,
    priceCents,
    unitInfo: firstString(node, ["unitSize", "salesUnitSize", "size", "unit"]) ?? null,
    imageUrl: image ? absolute(image, baseUrl) : null,
    url: url ? absolute(url, baseUrl) : null,
  };
}

/** Prijzen komen als getal, als string, of verstopt in `offers` / `price`. */
function findPrice(node: Record<string, unknown>): number | null {
  const direct = node["price"] ?? node["now"] ?? node["currentPrice"];
  const fromDirect = toCents(direct);
  if (fromDirect !== null) return fromDirect;

  for (const key of ["offers", "priceInfo", "pricing"]) {
    const nested = node[key];
    if (nested && typeof nested === "object") {
      const list = Array.isArray(nested) ? nested : [nested];
      for (const entry of list) {
        if (entry && typeof entry === "object") {
          const cents = toCents((entry as Record<string, unknown>)["price"]);
          if (cents !== null) return cents;
        }
      }
    }
  }
  return null;
}

function toCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Hele getallen boven de 1000 zijn vrijwel zeker al centen.
    return value >= 1000 && Number.isInteger(value)
      ? value
      : Math.round(value * 100);
  }
  if (typeof value === "string") return parsePrice(value);
  return null;
}

/** "€ 2,49", "2.49", "1,-" → centen. */
export function parsePrice(text: string | null): number | null {
  if (!text) return null;
  const match = text.replace(/\s/g, "").match(/(\d+)[.,](\d{1,2})|(\d+)[.,-]$|^(\d+)$/);
  if (!match) return null;
  if (match[1] !== undefined) {
    return Number(match[1]) * 100 + Number(match[2].padEnd(2, "0"));
  }
  const whole = match[3] ?? match[4];
  return whole ? Number(whole) * 100 : null;
}

function findImage(node: Record<string, unknown>): string | null {
  const direct = firstString(node, ["image", "imageUrl", "thumbnail", "src"]);
  if (direct) return direct;

  const images = node["images"];
  if (Array.isArray(images)) {
    for (const entry of images) {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const url = firstString(entry as Record<string, unknown>, ["url", "src"]);
        if (url) return url;
      }
    }
  }
  return null;
}

function firstString(
  node: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = node[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && key !== "price") return String(value);
  }
  return null;
}

function text(selection: { text(): string }): string | null {
  const value = selection.text().replace(/\s+/g, " ").trim();
  return value ? value : null;
}

function productIdFromUrl(url: string): string | null {
  const match = url.match(/product\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function absolute(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

/**
 * Welk van de gevonden producten past het best bij waar je naar zocht.
 *
 * Bewust simpel: het goedkoopste product waarvan de titel het zoekwoord bevat,
 * anders het eerste resultaat. De winkel sorteert zelf al op relevantie, dus
 * daar hoeven we niet overheen te programmeren.
 */
export function pickBest(products: FoundProduct[], term: string): FoundProduct | null {
  if (products.length === 0) return null;

  const needle = term.toLowerCase();
  const matching = products.filter((product) =>
    product.title.toLowerCase().includes(needle),
  );
  const pool = matching.length > 0 ? matching : products;

  return pool.reduce((best, product) =>
    (product.priceCents ?? Infinity) < (best.priceCents ?? Infinity) ? product : best,
  );
}
