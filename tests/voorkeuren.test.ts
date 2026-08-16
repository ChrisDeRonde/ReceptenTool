import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bezwaren,
  eisen,
  leesVoorkeuren,
  magOpTafel,
  schoonAfkeer,
  schrijfVoorkeuren,
} from "@/lib/voorkeuren";
import { normalizeDiets, unpackDiets } from "@/lib/recipe/categories";

const NAMEN = ["Chris", "Sanne"];

describe("het lezen van opgeslagen voorkeuren", () => {
  test("een naam die niet meer in het huishouden staat telt niet mee", () => {
    const ruw = schrijfVoorkeuren({
      Sanne: { dieet: ["vegetarisch"], afkeer: [] },
      Oma: { dieet: ["glutenvrij"], afkeer: [] },
    });
    const uit = leesVoorkeuren(ruw, NAMEN);
    assert.deepEqual(Object.keys(uit), ["Sanne"]);
  });

  test("onleesbare JSON levert geen voorkeuren op in plaats van een crash", () => {
    assert.deepEqual(leesVoorkeuren("{niet eens json", NAMEN), {});
    assert.deepEqual(leesVoorkeuren(null, NAMEN), {});
  });

  test("een lege voorkeur wordt niet bewaard", () => {
    const ruw = schrijfVoorkeuren({ Chris: { dieet: [], afkeer: [] } });
    assert.deepEqual(leesVoorkeuren(ruw, NAMEN), {});
  });

  test("rommel in het veld wordt genegeerd, de rest blijft staan", () => {
    const ruw = JSON.stringify({ Chris: { dieet: ["onzin", "vega"], afkeer: ["ui"] } });
    const uit = leesVoorkeuren(ruw, NAMEN);
    assert.deepEqual(uit.Chris.dieet, ["vegetarisch"]);
    assert.deepEqual(uit.Chris.afkeer, ["ui"]);
  });
});

describe("het opschonen van een afkeer", () => {
  test("komma's scheiden, spaties eromheen weg", () => {
    assert.deepEqual(schoonAfkeer(" varkensvlees , koriander "), [
      "varkensvlees",
      "koriander",
    ]);
  });

  test("meervoud valt samen met enkelvoud, net als bij zoeken", () => {
    assert.deepEqual(schoonAfkeer("paprika's"), ["paprika"]);
  });

  test("losse letters vallen af — die passen overal op", () => {
    assert.deepEqual(schoonAfkeer("a, ui"), ["ui"]);
  });

  test("dubbel invoeren levert één regel op", () => {
    assert.deepEqual(schoonAfkeer("ui, uien"), ["ui"]);
  });
});

describe("wat het huishouden samen vraagt", () => {
  test("één vegetariër maakt het gerecht vegetarisch", () => {
    const voorkeuren = leesVoorkeuren(
      schrijfVoorkeuren({
        Chris: { dieet: [], afkeer: ["koriander"] },
        Sanne: { dieet: ["vegetarisch"], afkeer: [] },
      }),
      NAMEN,
    );
    const gevraagd = eisen(voorkeuren, NAMEN);
    assert.deepEqual(gevraagd.dieet, ["vegetarisch"]);
    assert.deepEqual(gevraagd.afkeer, ["koriander"]);
  });

  test("veganistisch brengt vegetarisch en lactosevrij vanzelf mee", () => {
    const voorkeuren = leesVoorkeuren(
      schrijfVoorkeuren({ Sanne: { dieet: ["veganistisch"], afkeer: [] } }),
      NAMEN,
    );
    assert.deepEqual(eisen(voorkeuren, NAMEN).dieet, [
      "vegetarisch",
      "veganistisch",
      "lactosevrij",
    ]);
  });

  test("wie er niet bij zit, telt niet mee", () => {
    const voorkeuren = leesVoorkeuren(
      schrijfVoorkeuren({ Sanne: { dieet: ["vegetarisch"], afkeer: [] } }),
      NAMEN,
    );
    assert.deepEqual(eisen(voorkeuren, ["Chris"]).dieet, []);
  });
});

describe("mag dit op tafel", () => {
  const gevraagd = { dieet: normalizeDiets(["vegetarisch"]), afkeer: ["koriander"] };

  test("een gerecht zonder het kenmerk valt af", () => {
    assert.equal(
      magOpTafel({ diets: [], ingredientWoorden: ["kip"] }, gevraagd),
      false,
    );
  });

  test("met het kenmerk en zonder het verboden ingrediënt mag het", () => {
    assert.equal(
      magOpTafel(
        { diets: unpackDiets("vegetarisch"), ingredientWoorden: ["kaas", "prei"] },
        gevraagd,
      ),
      true,
    );
  });

  test("het verboden ingrediënt weegt zwaarder dan het kenmerk", () => {
    assert.equal(
      magOpTafel(
        { diets: unpackDiets("vegetarisch"), ingredientWoorden: ["koriander"] },
        gevraagd,
      ),
      false,
    );
  });

  test("zonder eisen mag alles", () => {
    assert.equal(
      magOpTafel({ diets: [], ingredientWoorden: ["kip"] }, { dieet: [], afkeer: [] }),
      true,
    );
  });
});

describe("wie eet dit niet", () => {
  const voorkeuren = leesVoorkeuren(
    schrijfVoorkeuren({
      Chris: { dieet: [], afkeer: ["koriander", "olijf"] },
      Sanne: { dieet: [], afkeer: ["varkensvlees"] },
    }),
    NAMEN,
  );

  test("noemt de naam en het woord, zodat je weet waarom", () => {
    const uit = bezwaren(voorkeuren, ["koriander", "limoen", "vissaus"]);
    assert.deepEqual(uit, [{ naam: "Chris", woorden: ["koriander"] }]);
  });

  test("twee woorden van dezelfde persoon staan op één regel", () => {
    const uit = bezwaren(voorkeuren, ["koriander", "olijf"]);
    assert.deepEqual(uit, [{ naam: "Chris", woorden: ["koriander", "olijf"] }]);
  });

  test("een samenstelling telt mee — gemalen varkensvlees is varkensvlees", () => {
    const uit = bezwaren(voorkeuren, ["varkensvlees", "ui"]);
    assert.deepEqual(uit, [{ naam: "Sanne", woorden: ["varkensvlees"] }]);
  });

  test("niets aan de hand levert een lege lijst", () => {
    assert.deepEqual(bezwaren(voorkeuren, ["ui", "prei"]), []);
  });
});
