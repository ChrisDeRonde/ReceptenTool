import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { leesbareFout } from "@/lib/menu/ideeen";
import { maandNaam, seizoensproducten } from "@/lib/menu/seizoen";
import { canonicalName } from "@/lib/shopping/units";

describe("het seizoen", () => {
  test("elke maand heeft iets", () => {
    for (let maand = 0; maand < 12; maand += 1) {
      const producten = seizoensproducten(new Date(2026, maand, 15));
      assert.ok(producten.length >= 5, `maand ${maand} heeft er maar ${producten.length}`);
    }
  });

  test("augustus is niet december", () => {
    const zomer = seizoensproducten(new Date(2026, 7, 15));
    const winter = seizoensproducten(new Date(2026, 11, 15));
    assert.ok(zomer.includes("tomaat"));
    assert.ok(!zomer.includes("boerenkool"));
    assert.ok(winter.includes("boerenkool"));
    assert.ok(!winter.includes("tomaat"));
  });

  test("alles staat al in de vorm waarin ingrediënten worden opgeslagen", () => {
    // Anders matcht de lijst nooit: `buildHaystack` haalt de ingrediëntnamen
    // door `canonicalName` en splitst ze in woorden. Staat hier "spruitjes",
    // dan wordt er gezocht naar een woord dat er nooit is.
    for (let maand = 0; maand < 12; maand += 1) {
      for (const product of seizoensproducten(new Date(2026, maand, 1))) {
        assert.equal(canonicalName(product), product, product);
      }
    }
  });

  test("de maandnaam is Nederlands", () => {
    assert.equal(maandNaam(new Date(2026, 7, 16)), "augustus");
  });
});

describe("een fout in gewone taal", () => {
  const metStatus = (status: number, message: string) =>
    Object.assign(new Error(message), { status });

  test("een afgekeurde sleutel zegt wat je eraan kunt doen", () => {
    const uit = leesbareFout(metStatus(401, '401 {"type":"error","error":{}}'));
    assert.match(uit, /ANTHROPIC_API_KEY/);
    assert.ok(!uit.includes("{"), "de rauwe JSON hoort er niet in");
  });

  test("te snel achter elkaar", () => {
    assert.match(leesbareFout(metStatus(429, "429 …")), /straks/);
  });

  test("de API zelf stuk", () => {
    assert.match(leesbareFout(metStatus(503, "503 …")), /nog eens/);
  });

  test("onze eigen melding blijft staan", () => {
    assert.equal(
      leesbareFout(new Error("ANTHROPIC_API_KEY ontbreekt in de omgeving.")),
      "ANTHROPIC_API_KEY ontbreekt in de omgeving.",
    );
  });

  test("iets dat geen fout is levert nog steeds een zin op", () => {
    assert.equal(leesbareFout("kapot"), "Het ophalen mislukte.");
  });
});
