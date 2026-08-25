import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PAASEI, isPaasei } from "@/lib/paasei";
import { parseQuery } from "@/lib/recipe/search";

const zoek = (tekst: string) => isPaasei(parseQuery(tekst));

describe("het verstopte recept", () => {
  test("de naam van de app opent hem", () => {
    assert.equal(zoek("klapper"), true);
  });

  test("hoofdletters en meervoud ook — anders is het geen paasei maar een wachtwoord", () => {
    assert.equal(zoek("Klapper"), true);
    assert.equal(zoek("  KLAPPER  "), true);
    assert.equal(zoek("klappers"), true);
  });

  test("hij blijft staan als je er nog iets bij typt", () => {
    assert.equal(zoek("klapper pasta"), true);
  });

  test("gewoon zoeken opent hem niet", () => {
    assert.equal(zoek("pasta"), false);
    assert.equal(zoek(""), false);
    assert.equal(zoek("kip"), false);
  });

  test("een woord dat er alleen op lijkt telt niet", () => {
    // `bevatTerm` zou hier soepel zijn; deze vergelijkt op de hele sleutel.
    assert.equal(zoek("klap"), false);
    assert.equal(zoek("klappernoot"), false);
  });

  test("er staat iets te lezen als hij opengaat", () => {
    assert.ok(PAASEI.ingredienten.length >= 3);
    assert.ok(PAASEI.stappen.length >= 3);
    assert.ok(PAASEI.slot.length > 10);
  });
});
