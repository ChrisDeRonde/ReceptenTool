import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  dagenTussen,
  datumKort,
  geleden,
  geledenAchteraan,
  hoofdletter,
  momentTekst,
} from "@/lib/tijd";

/** Een datum in lokale tijd, zodat de test niet van de tijdzone afhangt. */
const op = (jaar: number, maand: number, dag: number, uur = 12, minuut = 0) =>
  new Date(jaar, maand - 1, dag, uur, minuut);

describe("dagenTussen", () => {
  test("dezelfde dag is nul, hoe ver de klok ook uit elkaar staat", () => {
    assert.equal(dagenTussen(op(2026, 8, 11, 0, 5), op(2026, 8, 11, 23, 55)), 0);
  });

  test("vanochtend vroeg is vanavond nog steeds vandaag", () => {
    // Het gat is bijna een etmaal, maar het is dezelfde kalenderdag.
    assert.equal(dagenTussen(op(2026, 8, 11, 7, 0), op(2026, 8, 11, 23, 0)), 0);
  });

  test("net over middernacht is gisteren, ook al is het één uur later", () => {
    assert.equal(dagenTussen(op(2026, 8, 10, 23, 30), op(2026, 8, 11, 0, 30)), 1);
  });

  test("telt over een maandgrens heen", () => {
    assert.equal(dagenTussen(op(2026, 7, 28), op(2026, 8, 11)), 14);
  });

  test("de toekomst telt als vandaag, niet als min drie", () => {
    assert.equal(dagenTussen(op(2026, 8, 14), op(2026, 8, 11)), 0);
  });
});

describe("geleden", () => {
  test("de eerste twee dagen hebben een eigen woord", () => {
    assert.equal(geleden(0), "vandaag");
    assert.equal(geleden(1), "gisteren");
  });

  test("daarna dagen, dan weken, dan maanden", () => {
    assert.equal(geleden(3), "3 dagen geleden");
    assert.equal(geleden(13), "13 dagen geleden");
    assert.equal(geleden(14), "2 weken geleden");
    assert.equal(geleden(59), "8 weken geleden");
    assert.equal(geleden(60), "2 maanden geleden");
  });
});

describe("geledenAchteraan", () => {
  test("zegt nooit 'gisteren geleden'", () => {
    // Deze vorm gaat achter een halve zin aan, dus "gisteren" alleen zou daar
    // als "..., gisteren geleden" belanden.
    assert.equal(geledenAchteraan(0), "vandaag gemaakt");
    assert.equal(geledenAchteraan(1), "gisteren gemaakt");
  });

  test("verder gelijk aan geleden", () => {
    for (const dagen of [2, 9, 21, 200]) {
      assert.equal(geledenAchteraan(dagen), geleden(dagen));
    }
  });
});

describe("momentTekst", () => {
  const nu = op(2026, 8, 11, 21, 30);

  test("vandaag en gisteren krijgen de klok erbij", () => {
    assert.equal(momentTekst(op(2026, 8, 11, 9, 5), nu), "vandaag 09:05");
    assert.equal(momentTekst(op(2026, 8, 10, 18, 45), nu), "gisteren 18:45");
  });

  test("binnen het jaar: dag, maand en tijd, zonder seconden", () => {
    assert.equal(momentTekst(op(2026, 7, 3, 8, 0), nu), "3 jul 08:00");
  });

  test("een ander jaar laat de klok vallen en zet het jaartal erbij", () => {
    assert.match(momentTekst(op(2025, 12, 24, 19, 0), nu), /24 dec 2025/);
  });
});

describe("datumKort", () => {
  const nu = op(2026, 8, 11);

  test("binnen hetzelfde jaar zonder jaartal", () => {
    assert.equal(datumKort(op(2026, 1, 9), nu), "9 jan");
  });

  test("een ander jaar mét jaartal", () => {
    assert.match(datumKort(op(2025, 12, 24), nu), /24 dec 2025/);
  });
});

describe("hoofdletter", () => {
  test("zet de eerste letter groot en laat de rest staan", () => {
    assert.equal(hoofdletter("3 dagen geleden"), "3 dagen geleden");
    assert.equal(hoofdletter("gisteren gemaakt"), "Gisteren gemaakt");
  });

  test("een lege tekst blijft leeg", () => {
    assert.equal(hoofdletter(""), "");
  });
});
