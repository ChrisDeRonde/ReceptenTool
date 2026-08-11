import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { suggest, type Kandidaat } from "@/lib/menu/suggest";

const VANDAAG = new Date(2026, 7, 11);
const dagenTerug = (n: number) => new Date(2026, 7, 11 - n);

const maak = (id: string, over: Partial<Kandidaat> = {}): Kandidaat => ({
  id,
  title: id,
  cuisine: null,
  favorite: false,
  createdAt: dagenTerug(200),
  cookedAt: [dagenTerug(30)],
  ratings: [],
  again: { yes: 0, no: 0 },
  ...over,
});

const doe = (kandidaten: Kandidaat[], gepland: Array<{ id: string; cuisine: string | null }> = []) =>
  suggest(kandidaten, { gepland, vandaag: VANDAAG, aantal: 5 });

describe("wat er bovenaan komt", () => {
  test("langer geleden gaat voor", () => {
    const uit = doe([
      maak("recent", { cookedAt: [dagenTerug(3)] }),
      maak("oud", { cookedAt: [dagenTerug(80)] }),
    ]);
    assert.equal(uit[0].id, "oud");
  });

  test("bij gelijke rust wint de hogere waardering", () => {
    const uit = doe([
      maak("matig", { ratings: [2, 2] }),
      maak("goed", { ratings: [5, 5] }),
    ]);
    assert.equal(uit[0].id, "goed");
  });

  test('"vaker eten" weegt mee', () => {
    const uit = doe([
      maak("gewoon"),
      maak("vaker", { again: { yes: 1, no: 0 } }),
    ]);
    assert.equal(uit[0].id, "vaker");
  });

  test("de meest recente keer telt, niet de eerste", () => {
    const uit = doe([
      maak("laatst-recent", { cookedAt: [dagenTerug(200), dagenTerug(2)] }),
      maak("laatst-lang", { cookedAt: [dagenTerug(70)] }),
    ]);
    assert.equal(uit[0].id, "laatst-lang");
  });
});

describe("wat er niet in komt", () => {
  test("wat al op het menu staat doet niet mee", () => {
    const uit = doe([maak("a"), maak("b")], [{ id: "a", cuisine: null }]);
    assert.deepEqual(uit.map((v) => v.id), ["b"]);
  });

  test("wat niemand vaker wil valt af", () => {
    // Dat is geen lage score maar een antwoord.
    const uit = doe([
      maak("nee", { again: { yes: 0, no: 2 }, cookedAt: [dagenTerug(90)] }),
      maak("ja", { cookedAt: [dagenTerug(5)] }),
    ]);
    assert.deepEqual(uit.map((v) => v.id), ["ja"]);
  });

  test("maar één keer nee tussen twee keer ja telt niet als afwijzing", () => {
    const uit = doe([maak("verdeeld", { again: { yes: 2, no: 1 } })]);
    assert.equal(uit.length, 1);
  });
});

describe("afwisseling", () => {
  test("dezelfde keuken als iets dat al gepland staat zakt", () => {
    const uit = doe(
      [
        maak("weer-italiaans", { cuisine: "Italiaans", cookedAt: [dagenTerug(60)] }),
        maak("iets-anders", { cuisine: "Thais", cookedAt: [dagenTerug(30)] }),
      ],
      [{ id: "x", cuisine: "Italiaans" }],
    );
    assert.equal(uit[0].id, "iets-anders");
  });

  test("zonder keuken is er niets om op af te wisselen", () => {
    const uit = doe([maak("a", { cuisine: null })], [{ id: "x", cuisine: "Italiaans" }]);
    assert.equal(uit.length, 1);
  });
});

describe("nog nooit gemaakt", () => {
  test("staat hoog, want daarom sloeg je het op", () => {
    const uit = doe([
      maak("nooit", { cookedAt: [], createdAt: dagenTerug(40) }),
      maak("wel", { cookedAt: [dagenTerug(20)] }),
    ]);
    assert.equal(uit[0].id, "nooit");
    assert.equal(uit[0].reason, "Nog nooit gemaakt");
  });

  test("iets dat je gisteren opsloeg heeft nog geen achterstand", () => {
    const uit = doe([
      maak("net-binnen", { cookedAt: [], createdAt: dagenTerug(1) }),
      maak("lang-niet", { cookedAt: [dagenTerug(75)] }),
    ]);
    assert.equal(uit[0].id, "lang-niet");
  });
});

describe("de reden erbij", () => {
  test("hoog gewaardeerd", () => {
    const [v] = doe([maak("a", { ratings: [5, 4.5 as number], cookedAt: [dagenTerug(30)] })]);
    assert.match(v.reason, /Hoog gewaardeerd/);
  });

  test("vaker willen plus lang geleden", () => {
    const [v] = doe([maak("a", { again: { yes: 1, no: 0 }, cookedAt: [dagenTerug(50)] })]);
    assert.match(v.reason, /vaker/);
    assert.match(v.reason, /weken geleden/);
  });

  test("anders gewoon hoe lang geleden", () => {
    const [v] = doe([maak("a", { cookedAt: [dagenTerug(9)] })]);
    assert.equal(v.reason, "9 dagen geleden");
  });

  test("maanden bij echt lang geleden", () => {
    const [v] = doe([maak("a", { cookedAt: [dagenTerug(120)] })]);
    assert.match(v.reason, /maanden geleden/);
  });
});

describe("de vorm van het antwoord", () => {
  test("nooit meer dan gevraagd", () => {
    const veel = Array.from({ length: 10 }, (_, i) => maak(`r${i}`));
    assert.equal(suggest(veel, { gepland: [], vandaag: VANDAAG, aantal: 3 }).length, 3);
  });

  test("standaard drie", () => {
    const veel = Array.from({ length: 10 }, (_, i) => maak(`r${i}`));
    assert.equal(suggest(veel, { gepland: [], vandaag: VANDAAG }).length, 3);
  });

  test("een lege collectie levert een lege lijst", () => {
    assert.deepEqual(doe([]), []);
  });

  test("gelijke score sorteert op naam, zodat de volgorde niet wiebelt", () => {
    const uit = doe([maak("b", { title: "Bami" }), maak("a", { title: "Andijvie" })]);
    assert.deepEqual(uit.map((v) => v.title), ["Andijvie", "Bami"]);
  });
});
