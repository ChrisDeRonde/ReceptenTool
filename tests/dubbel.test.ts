import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  findDuplicate,
  ingredientOverlap,
  titelGelijkenis,
} from "@/lib/recipe/duplicate";

describe("hoe erg twee titels op elkaar lijken", () => {
  test("hetzelfde is helemaal gelijk", () => {
    assert.equal(titelGelijkenis("Shakshuka met feta", "Shakshuka met feta"), 1);
  });

  test("de kortste telt, niet de langste", () => {
    // "shakshuka" en "shakshuka met feta en munt" delen één woord op vijf,
    // maar dat ene woord ís het gerecht.
    assert.equal(titelGelijkenis("Shakshuka", "Shakshuka met feta en munt"), 1);
  });

  test("lege woorden tellen niet mee", () => {
    // Anders is elk paar recepten dat met "snelle" begint een bijna-dubbel.
    assert.equal(titelGelijkenis("Snelle pasta", "Snelle curry"), 0);
    assert.equal(titelGelijkenis("De beste lasagne", "Lasagne"), 1);
  });

  test("verschillende gerechten lijken niet op elkaar", () => {
    assert.ok(titelGelijkenis("Groene curry met kip", "Bananenbrood") < 0.2);
  });

  test("accenten en leestekens doen niet mee", () => {
    assert.equal(titelGelijkenis("Crème brûlée", "creme brulee"), 1);
  });
});

describe("hoeveel ingrediënten twee recepten delen", () => {
  test("dezelfde lijst is helemaal gelijk", () => {
    assert.equal(ingredientOverlap(["ui", "tomaat"], ["ui", "tomaat"]), 1);
  });

  test("niets gemeen is nul", () => {
    assert.equal(ingredientOverlap(["ui"], ["banaan"]), 0);
  });

  test("een lege lijst levert nul en geen deling door nul", () => {
    assert.equal(ingredientOverlap([], ["ui"]), 0);
    assert.equal(ingredientOverlap(["ui"], []), 0);
  });
});

describe("herkennen dat je dit al hebt", () => {
  const bestaand = [
    {
      id: "r1",
      title: "Shakshuka met feta",
      sourceUrl: "https://leukerecepten.nl/shakshuka",
      ingredienten: ["ui", "rode paprika", "tomatenblokjes", "ei", "feta", "komijn"],
    },
  ];

  test("dezelfde bron is het sterkste signaal", () => {
    const uit = findDuplicate(
      { sourceUrl: "https://www.leukerecepten.nl/shakshuka?utm_source=x", title: "Iets anders" },
      bestaand,
    );
    assert.equal(uit?.reason, "bron");
  });

  test("dezelfde titel telt ook", () => {
    const uit = findDuplicate({ sourceUrl: null, title: "shakshuka met feta" }, bestaand);
    assert.equal(uit?.reason, "titel");
  });

  test("bijna dezelfde titel én dezelfde ingrediënten is een bijna-dubbel", () => {
    const uit = findDuplicate(
      {
        sourceUrl: "https://anderesite.nl/recept",
        title: "Snelle shakshuka met feta",
        ingredienten: ["ui", "rode paprika", "tomatenblokjes", "ei", "feta"],
      },
      bestaand,
    );
    assert.equal(uit?.reason, "lijkt");
    assert.equal(uit?.id, "r1");
  });

  test("een lijkende titel alleen is niet genoeg", () => {
    // "Pasta met tomatensaus" en "Pasta met pestosaus" delen bijna alle
    // woorden, maar het is niet hetzelfde gerecht. Dat zie je aan de
    // ingrediënten.
    const uit = findDuplicate(
      {
        sourceUrl: null,
        title: "Shakshuka met feta",
        ingredienten: ["couscous", "kikkererwt", "harissa", "munt", "citroen"],
      },
      [{ ...bestaand[0], title: "Shakshuka met feta en munt" }],
    );
    assert.equal(uit, null);
  });

  test("dezelfde ingrediënten met een heel andere naam is niet genoeg", () => {
    const uit = findDuplicate(
      {
        sourceUrl: null,
        title: "Bananenbrood",
        ingredienten: ["ui", "rode paprika", "tomatenblokjes", "ei", "feta"],
      },
      bestaand,
    );
    assert.equal(uit, null);
  });

  test("zonder ingrediënten wordt er niet naar bijna-dubbelen gekeken", () => {
    // Dat is de goedkope controle vóór de modelaanroep: dan is er nog geen
    // ingrediëntenlijst en valt er niets te vergelijken.
    const uit = findDuplicate(
      { sourceUrl: null, title: "Snelle shakshuka met feta" },
      bestaand,
    );
    assert.equal(uit, null);
  });

  test("een lege collectie levert niets op", () => {
    assert.equal(findDuplicate({ sourceUrl: "https://x.nl/a", title: "Iets" }, []), null);
  });
});
