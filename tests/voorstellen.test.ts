import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { suggest, type Kandidaat } from "@/lib/menu/suggest";
import type { Diet } from "@/lib/recipe/categories";

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

describe("wat er in huis ligt", () => {
  const kast = (id: string, woorden: string[], over: Partial<Kandidaat> = {}) =>
    maak(id, { ingredientNamen: woorden, ...over });

  test("een recept dat je ingrediënten gebruikt komt bovenaan", () => {
    const uit = suggest(
      [
        kast("prei-taart", ["prei", "kaas", "bladerdeeg"], { cookedAt: [dagenTerug(2)] }),
        kast("iets-anders", ["rijst", "kip"], { cookedAt: [dagenTerug(85)] }),
      ],
      { gepland: [], vandaag: VANDAAG, inHuis: ["prei", "kaas"], seizoen: false },
    );
    assert.equal(uit[0].id, "prei-taart");
    assert.equal(uit[0].reason, "Gebruikt prei en kaas");
  });

  test("meer treffers gaat voor minder", () => {
    const uit = suggest(
      [kast("een", ["prei"]), kast("twee", ["prei", "kaas"])],
      { gepland: [], vandaag: VANDAAG, inHuis: ["prei", "kaas"], seizoen: false },
    );
    assert.equal(uit[0].id, "twee");
  });

  test("bij evenveel treffers beslist de gewone afweging weer", () => {
    // Allebei vier treffers; dan wint wat het langst niet op tafel stond, niet
    // het recept met de langste ingrediëntenlijst.
    const veel = Array.from({ length: 20 }, (_, i) => `spul${i}`);
    const uit = suggest(
      [
        kast("kruidenrek", [...veel, "prei", "kaas", "ui", "boter"], { cookedAt: [dagenTerug(1)] }),
        kast("simpel", ["prei", "kaas", "ui", "boter"], { cookedAt: [dagenTerug(60)] }),
      ],
      {
        gepland: [],
        vandaag: VANDAAG,
        inHuis: ["prei", "kaas", "ui", "boter"],
        seizoen: false,
      },
    );
    assert.equal(uit[0].id, "simpel");
  });

  test("een treffer gaat vóór lang niet gemaakt", () => {
    // Zonder dit is "wat ligt er in huis" een suggestie in plaats van een
    // vraag: het antwoord gaat dan over iets waar niets van in de kast staat.
    const uit = suggest(
      [
        kast("met-prei", ["prei", "kaas"], { cookedAt: [dagenTerug(1)] }),
        kast("stoffig", ["rijst", "kip"], { cookedAt: [dagenTerug(200)] }),
      ],
      { gepland: [], vandaag: VANDAAG, inHuis: ["prei"], seizoen: false },
    );
    assert.equal(uit[0].id, "met-prei");
  });

  test("een ingrediëntnaam buigt mee, net als bij zoeken", () => {
    const uit = suggest([kast("a", ["rundergehakt"])], {
      gepland: [],
      vandaag: VANDAAG,
      inHuis: ["gehakt"],
      seizoen: false,
    });
    assert.equal(uit[0].reason, "Gebruikt gehakt");
  });
});

describe("het seizoen", () => {
  test("wat er deze maand is krijgt een duwtje", () => {
    // VANDAAG is 11 augustus: tomaat wel, boerenkool niet.
    const uit = suggest(
      [
        maak("zomer", { ingredientNamen: ["tomaat", "basilicum"], cookedAt: [dagenTerug(25)] }),
        maak("winter", { ingredientNamen: ["boerenkool"], cookedAt: [dagenTerug(30)] }),
      ],
      { gepland: [], vandaag: VANDAAG },
    );
    assert.equal(uit[0].id, "zomer");
    assert.match(uit[0].reason, /op zijn best/);
  });

  test("uit het seizoen zakt niets — het duwt alleen", () => {
    const uit = suggest([maak("winter", { ingredientNamen: ["boerenkool"] })], {
      gepland: [],
      vandaag: VANDAAG,
    });
    assert.equal(uit.length, 1);
  });

  test("wat er ligt gaat voor het seizoen in de reden", () => {
    const uit = suggest([maak("a", { ingredientNamen: ["tomaat", "prei"] })], {
      gepland: [],
      vandaag: VANDAAG,
      inHuis: ["prei"],
    });
    assert.equal(uit[0].reason, "Gebruikt prei");
  });
});

describe("wat er niet op tafel mag", () => {
  const vega: Diet[] = ["vegetarisch"];

  test("een dieet-eis sluit uit wat het kenmerk niet heeft", () => {
    const uit = suggest(
      [maak("vlees", { diets: [] }), maak("vega", { diets: vega })],
      { gepland: [], vandaag: VANDAAG, wensen: { dieet: vega }, seizoen: false },
    );
    assert.deepEqual(uit.map((v) => v.id), ["vega"]);
  });

  test("een afkeer kijkt naar de ingrediënten, niet naar het etiket", () => {
    const uit = suggest(
      [
        maak("met", { ingredientNamen: ["varkensvlees", "ui"] }),
        maak("zonder", { ingredientNamen: ["kip", "ui"] }),
      ],
      { gepland: [], vandaag: VANDAAG, wensen: { afkeer: ["varkensvlees"] }, seizoen: false },
    );
    assert.deepEqual(uit.map((v) => v.id), ["zonder"]);
  });

  test("een afkeer van twee woorden sluit niet het enkele woord uit", () => {
    const uit = suggest([maak("gewone-ui", { ingredientNamen: ["ui", "prei"] })], {
      gepland: [],
      vandaag: VANDAAG,
      wensen: { afkeer: ["rode ui"] },
      seizoen: false,
    });
    assert.equal(uit.length, 1);
  });

  test("zonder wensen valt er niets af", () => {
    const uit = suggest([maak("a"), maak("b")], { gepland: [], vandaag: VANDAAG });
    assert.equal(uit.length, 2);
  });
});
