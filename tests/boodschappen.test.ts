import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addAmounts, amountKey, canonicalName, formatAmount } from "@/lib/shopping/units";
import { aisleFor } from "@/lib/shopping/aisles";

/**
 * Twee recepten die allebei een ui vragen horen één regel te worden, en die
 * regel hoort onder het juiste kopje te staan. Alle bugs die hier ooit zaten
 * gingen over Nederlandse woordvorming, niet over rekenen.
 */

describe("canonicalName trekt namen gelijk", () => {
  const zelfde: Array<[string, string]> = [
    ["Ui", "ui"],
    ["uien", "ui"],
    ["rode paprika's", "rode paprika"],
    ["  dubbele   spatie ", "dubbele spatie"],
  ];
  for (const [invoer, verwacht] of zelfde) {
    test(`"${invoer}" → "${verwacht}"`, () => {
      assert.equal(canonicalName(invoer), verwacht);
    });
  }
});

describe("optellen", () => {
  test("gram bij gram", () => {
    const som = addAmounts({ quantity: 200, unit: "g" }, { quantity: 300, unit: "g" });
    assert.equal(formatAmount(som), "500 g");
  });

  test("stuks zonder eenheid", () => {
    const som = addAmounts({ quantity: 1, unit: null }, { quantity: 2, unit: null });
    assert.equal(som.quantity, 3);
  });

  test("verschillende eenheden krijgen een eigen sleutel", () => {
    assert.notEqual(
      amountKey({ quantity: 1, unit: "g" }),
      amountKey({ quantity: 1, unit: "el" }),
    );
  });

  test("iets zonder getal telt niet op tot een verkeerd getal", () => {
    const som = addAmounts({ quantity: null, unit: null }, { quantity: 2, unit: null });
    assert.ok(som.quantity === null || som.quantity === 2, JSON.stringify(som));
  });
});

describe("aisleFor zet het onder het juiste kopje", () => {
  const gevallen: Array<[string, string]> = [
    ["ui", "groente"],
    ["rode paprika's", "groente"],
    ["rundergehakt", "vlees"],
    ["slagroom", "zuivel"],
    ["melk", "zuivel"],
    ["bloem", "bakken"],
    ["bruine suiker", "bakken"],
    ["rietsuiker", "bakken"],
    ["spaghetti", "voorraad"],
    ["tomatenblokjes", "voorraad"],
  ];

  for (const [naam, verwacht] of gevallen) {
    test(`${naam} → ${verwacht}`, () => {
      assert.equal(aisleFor(naam), verwacht);
    });
  }

  test("slagroom is geen sla", () => {
    // Hier zat een echte bug: het kopje werd op een beginletter-match gekozen,
    // en "sla" zit vooraan in "slagroom".
    assert.notEqual(aisleFor("slagroom"), "groente");
  });

  test("gedroogde abrikozen zijn geen kruid", () => {
    assert.notEqual(aisleFor("gedroogde abrikozen"), "kruiden");
  });

  test("wat nergens bij hoort valt niet om", () => {
    assert.ok(typeof aisleFor("zomaar iets vreemds") === "string");
  });
});
