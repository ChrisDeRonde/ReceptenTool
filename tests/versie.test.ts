import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isVerouderd, versieVan } from "@/lib/recipe/versie";

const toen = new Date("2026-08-12T19:30:00.000Z");
const later = new Date("2026-08-12T19:31:00.000Z");

describe("versieVan", () => {
  test("een tijdstip wordt een ISO-tekst", () => {
    assert.equal(versieVan(toen), "2026-08-12T19:30:00.000Z");
  });

  test("nog nooit bijgewerkt is een lege tekst", () => {
    assert.equal(versieVan(null), "");
    assert.equal(versieVan(undefined), "");
  });
});

describe("isVerouderd", () => {
  test("gelijk is niet verouderd", () => {
    assert.equal(isVerouderd(versieVan(toen), toen), false);
  });

  test("nooit bijgewerkt, en nog steeds niet", () => {
    assert.equal(isVerouderd("", null), false);
  });

  test("iemand was je voor", () => {
    assert.equal(isVerouderd(versieVan(toen), later), true);
  });

  test("het recept was nog maagdelijk toen jij begon, nu niet meer", () => {
    // De klassieke botsing: jullie openen allebei een vers geïmporteerd
    // recept, de ander slaat als eerste op.
    assert.equal(isVerouderd("", toen), true);
  });

  test("een ontbrekend veld houdt niemand tegen", () => {
    // Een oude pagina uit de cache of een verzoek buiten het formulier om.
    // Er valt niets te vergelijken, en dan is tegenhouden erger dan doorlaten.
    assert.equal(isVerouderd(null, toen), false);
    assert.equal(isVerouderd(null, null), false);
  });

  test("een verzonnen versie telt als verouderd", () => {
    assert.equal(isVerouderd("gisteren", toen), true);
  });
});
