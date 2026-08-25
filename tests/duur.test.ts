import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { duurTekst, werkelijkeDuur } from "@/lib/recipe/duur";

describe("hoe lang het bij jullie duurt", () => {
  test("één meting is geen gemiddelde", () => {
    // Die ene keer kan de deurbel zijn geweest. Daar een bewering op bouwen
    // moet je na de tweede keer weer intrekken.
    assert.equal(werkelijkeDuur([50], 30), null);
    assert.equal(werkelijkeDuur([], 30), null);
  });

  test("vanaf twee metingen wel", () => {
    const uit = werkelijkeDuur([50, 46], 30);
    assert.equal(uit?.metingen, 2);
    assert.equal(uit?.minuten, 48);
  });

  test("de mediaan, niet het gemiddelde", () => {
    // De keer waarop je halverwege boodschappen moest doen trekt een gemiddelde
    // scheef (hier zou dat 70 zijn) en laat de mediaan met rust.
    assert.equal(werkelijkeDuur([40, 45, 125], 40)?.minuten, 45);
  });

  test("lege en onmogelijke metingen tellen niet mee", () => {
    assert.equal(werkelijkeDuur([45, null, 0, -5, 51], 30)?.metingen, 2);
  });

  test("een klein verschil is ruis en wordt niet gemeld", () => {
    // Vijf minuten op een uur zegt niets.
    assert.equal(werkelijkeDuur([62, 58], 60)?.opvallend, false);
  });

  test("een groot verschil wel", () => {
    // Twintig minuten op een half uur is het verschil tussen op tijd eten en
    // om negen uur beginnen.
    assert.equal(werkelijkeDuur([50, 52], 30)?.opvallend, true);
  });

  test("zonder schatting van de bron valt er niets te vergelijken", () => {
    const uit = werkelijkeDuur([45, 50], null);
    assert.equal(uit?.minuten, 48);
    assert.equal(uit?.opvallend, false);
  });
});

describe("de duur in woorden", () => {
  test("onder het uur gewoon minuten", () => {
    assert.equal(duurTekst(45), "45 min");
  });

  test("een heel uur zonder rest", () => {
    assert.equal(duurTekst(60), "1 u");
    assert.equal(duurTekst(120), "2 u");
  });

  test("en anders uren met minuten", () => {
    assert.equal(duurTekst(75), "1 u 15");
    assert.equal(duurTekst(145), "2 u 25");
  });
});
