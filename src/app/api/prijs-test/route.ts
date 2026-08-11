import { NextResponse } from "next/server";
import { fetchPage } from "@/lib/extract/fetchPage";
import { isStore, searchUrl, DEFAULT_STORE } from "@/lib/shopping/aisles";
import { parseSearchPage, pickBest } from "@/lib/shopping/products";
import { canonicalName } from "@/lib/shopping/units";

/**
 * Meten hoe snel het opzoeken is, zonder iets op te slaan.
 *
 *   curl "http://localhost:3000/api/prijs-test?q=melk,ui,spaghetti&winkel=ah"
 *
 * Geeft per term terug hoeveel milliseconden het ophalen en het uitlezen
 * kostten, en wélke strategie het deed — `jsonld` en `embedded` zijn stabiel,
 * `dom` is gokwerk dat bij de eerste restyling breekt, en `none` betekent dat
 * er zonder browser niets te halen valt.
 *
 * Dit is de enige manier om te weten of het snel genoeg is: hoe lang die ene
 * netwerkhop naar de winkel duurt, hangt van jouw verbinding af.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = params.get("winkel");
  const store = isStore(requested) ? requested : DEFAULT_STORE;
  const terms = (params.get("q") ?? "melk")
    .split(",")
    .map((term) => canonicalName(term))
    .filter(Boolean)
    .slice(0, 10);

  const started = Date.now();
  const results = [];

  for (const term of terms) {
    const url = searchUrl(store, term);
    const fetchStart = Date.now();
    try {
      const page = await fetchPage(url);
      const fetchMs = Date.now() - fetchStart;

      const parseStart = Date.now();
      const parsed = parseSearchPage(page.html, url);
      const best = pickBest(parsed.products, term);
      const parseMs = Date.now() - parseStart;

      results.push({
        term,
        fetchMs,
        parseMs,
        strategy: parsed.strategy,
        htmlKb: Math.round(page.html.length / 1024),
        via: page.via,
        gevonden: parsed.products.length,
        beste: best
          ? { titel: best.title, centen: best.priceCents, url: best.url }
          : null,
      });
    } catch (error) {
      results.push({
        term,
        fetchMs: Date.now() - fetchStart,
        parseMs: 0,
        strategy: "error",
        fout: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totaalMs = Date.now() - started;
  return NextResponse.json({
    winkel: store,
    aantal: terms.length,
    totaalMs,
    gemiddeldMs: terms.length > 0 ? Math.round(totaalMs / terms.length) : 0,
    resultaten: results,
  });
}
