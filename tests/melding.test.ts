import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { leesMelding } from "@/lib/menu/melding";

describe("wat de strook zegt", () => {
  test("ingepland noemt de dag", () => {
    assert.equal(leesMelding("gezet.2026-08-26", null)?.tekst, "Op wo 26 aug gezet.");
  });

  test("een onleesbare dag levert nog steeds een nette zin", () => {
    // De handeling is wél gelukt; alleen de dag is onleesbaar. Dan is zwijgen
    // erger dan iets algemeens zeggen.
    assert.equal(leesMelding("gezet.rommel", null)?.tekst, "Op het menu gezet.");
  });

  test("weggehaald biedt een weg terug", () => {
    const uit = leesMelding("weg", "abc123.2026-08-26.4");
    assert.equal(uit?.tekst, "Van het menu gehaald.");
    assert.deepEqual(uit?.terug, { recipeId: "abc123", dag: "2026-08-26", porties: "4" });
  });

  test("zonder porties blijft de rest overeind", () => {
    assert.deepEqual(leesMelding("weg", "abc123.2026-08-26.")?.terug, {
      recipeId: "abc123",
      dag: "2026-08-26",
      porties: undefined,
    });
  });

  test("een half gelezen terug levert géén knop op", () => {
    // Anders zet je iets terug dat niet is wat je weggooide, en dat is erger
    // dan geen knop.
    assert.equal(leesMelding("weg", "abc123")?.terug, undefined);
    assert.equal(leesMelding("weg", "abc123.rommel.4")?.terug, undefined);
    assert.equal(leesMelding("weg", ".2026-08-26.4")?.terug, undefined);
    assert.equal(leesMelding("weg", "a.b.c.d")?.terug, undefined);
  });

  test("porties die geen getal zijn vallen weg, de rest niet", () => {
    assert.equal(leesMelding("weg", "abc.2026-08-26.zes")?.terug?.porties, undefined);
    assert.equal(leesMelding("weg", "abc.2026-08-26.zes")?.terug?.recipeId, "abc");
  });

  test("de week leegmaken heeft geen weg terug", () => {
    const uit = leesMelding("leeg", null);
    assert.equal(uit?.tekst, "De week is leeggemaakt.");
    assert.equal(uit?.terug, undefined);
  });

  test("verzonnen of ontbrekende parameters toveren niets op het scherm", () => {
    assert.equal(leesMelding(null, null), null);
    assert.equal(leesMelding("", null), null);
    assert.equal(leesMelding("onzin", null), null);
  });
});
