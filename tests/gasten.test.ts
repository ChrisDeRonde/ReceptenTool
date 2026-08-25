import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { nieuwePorties, portiesVolgenNog } from "@/lib/menu/gasten";

describe("volgen de porties de gasten nog?", () => {
  test("niet ingevuld telt als volgend", () => {
    // `null` betekent "zoals het recept het bedoelde". Wie gasten uitnodigt
    // bedoelt dat niet meer. Zonder deze regel bleef een avond met drie gasten
    // op twee porties staan.
    assert.equal(portiesVolgenNog(null, 0, 2), true);
    assert.equal(portiesVolgenNog(null, 3, 2), true);
  });

  test("een aantal dat klopt met huishouden plus gasten volgt nog", () => {
    assert.equal(portiesVolgenNog(2, 0, 2), true);
    assert.equal(portiesVolgenNog(5, 3, 2), true);
  });

  test("een zelfgekozen aantal wordt niet overschreven", () => {
    // Zes porties bij twee mensen zonder gasten: dat is dubbel koken om in te
    // vriezen, en een uitnodiging hoort die beslissing niet weg te halen.
    assert.equal(portiesVolgenNog(6, 0, 2), false);
    assert.equal(portiesVolgenNog(4, 3, 2), false);
  });
});

describe("waar de porties naartoe gaan", () => {
  test("huishouden plus gasten", () => {
    assert.equal(nieuwePorties(2, 3, 20), 5);
    assert.equal(nieuwePorties(2, 0, 20), 2);
  });

  test("nooit boven de grens", () => {
    assert.equal(nieuwePorties(2, 50, 20), 20);
  });
});
