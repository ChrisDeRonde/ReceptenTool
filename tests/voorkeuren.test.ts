import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bezwaren,
  eisen,
  leesVoorkeuren,
  magOpTafel,
  schoonAfkeer,
  schrijfVoorkeuren,
  voegSamen,
} from "@/lib/voorkeuren";
import { normalizeDiets, unpackDiets } from "@/lib/recipe/categories";

const NAMEN = ["Chris", "Sanne"];

describe("het lezen van opgeslagen voorkeuren", () => {
  test("een naam die niet meer in het huishouden staat telt niet mee", () => {
    const ruw = schrijfVoorkeuren({
      Sanne: { dieet: ["vegetarisch"], afkeer: [], zwanger: false },
      Oma: { dieet: ["glutenvrij"], afkeer: [], zwanger: false },
    });
    const uit = leesVoorkeuren(ruw, NAMEN);
    assert.deepEqual(Object.keys(uit), ["Sanne"]);
  });

  test("onleesbare JSON levert geen voorkeuren op in plaats van een crash", () => {
    assert.deepEqual(leesVoorkeuren("{niet eens json", NAMEN), {});
    assert.deepEqual(leesVoorkeuren(null, NAMEN), {});
  });

  test("een lege voorkeur wordt niet bewaard", () => {
    const ruw = schrijfVoorkeuren({ Chris: { dieet: [], afkeer: [], zwanger: false } });
    assert.deepEqual(leesVoorkeuren(ruw, NAMEN), {});
  });

  test("rommel in het veld wordt genegeerd, de rest blijft staan", () => {
    const ruw = JSON.stringify({ Chris: { dieet: ["onzin", "vega"], afkeer: ["ui"], zwanger: false } });
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
        Chris: { dieet: [], afkeer: ["koriander"], zwanger: false },
        Sanne: { dieet: ["vegetarisch"], afkeer: [], zwanger: false },
      }),
      NAMEN,
    );
    const gevraagd = eisen(voorkeuren);
    assert.deepEqual(gevraagd.dieet, ["vegetarisch"]);
    assert.deepEqual(gevraagd.afkeer, ["koriander"]);
  });

  test("veganistisch brengt vegetarisch en lactosevrij vanzelf mee", () => {
    const voorkeuren = leesVoorkeuren(
      schrijfVoorkeuren({ Sanne: { dieet: ["veganistisch"], afkeer: [], zwanger: false } }),
      NAMEN,
    );
    assert.deepEqual(eisen(voorkeuren).dieet, [
      "vegetarisch",
      "veganistisch",
      "lactosevrij",
    ]);
  });

  test("wie er niet bij zit, telt niet mee", () => {
    // Het filteren op wie er in het huishouden staat gebeurt bij het lezen,
    // niet nog een keer hier — anders moet elke aanroeper `people()` twee keer
    // ophalen om hetzelfde antwoord te krijgen.
    const voorkeuren = leesVoorkeuren(
      schrijfVoorkeuren({ Sanne: { dieet: ["vegetarisch"], afkeer: [], zwanger: false } }),
      ["Chris"],
    );
    assert.deepEqual(eisen(voorkeuren).dieet, []);
  });
});

describe("mag dit op tafel", () => {
  const gevraagd = { dieet: normalizeDiets(["vegetarisch"]), afkeer: ["koriander"] };

  test("een gerecht zonder het kenmerk valt af", () => {
    assert.equal(
      magOpTafel({ diets: [], ingredientNamen: ["kip"] }, gevraagd),
      false,
    );
  });

  test("met het kenmerk en zonder het verboden ingrediënt mag het", () => {
    assert.equal(
      magOpTafel(
        { diets: unpackDiets("vegetarisch"), ingredientNamen: ["kaas", "prei"] },
        gevraagd,
      ),
      true,
    );
  });

  test("het verboden ingrediënt weegt zwaarder dan het kenmerk", () => {
    assert.equal(
      magOpTafel(
        { diets: unpackDiets("vegetarisch"), ingredientNamen: ["koriander"] },
        gevraagd,
      ),
      false,
    );
  });

  test("zonder eisen mag alles", () => {
    assert.equal(
      magOpTafel({ diets: [], ingredientNamen: ["kip"] }, { dieet: [], afkeer: [] }),
      true,
    );
  });
});

describe("wie eet dit niet", () => {
  const voorkeuren = leesVoorkeuren(
    schrijfVoorkeuren({
      Chris: { dieet: [], afkeer: ["koriander", "olijf"], zwanger: false },
      Sanne: { dieet: [], afkeer: ["varkensvlees"], zwanger: false },
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

describe("een afkeer van meer dan één woord", () => {
  // De losse-woordenlijst van een recept is één hoop zonder verband, dus
  // "rode" en "ui" apart terugvinden zegt niets over of er rode ui in zit.
  const gevraagd = { dieet: [], afkeer: ["rode ui"], zwanger: false };

  test("rode paprika plus gewone ui is geen rode ui", () => {
    assert.equal(
      magOpTafel(
        { diets: [], ingredientNamen: ["rode paprika", "ui", "olijfolie"] },
        gevraagd,
      ),
      true,
    );
  });

  test("rode ui is wel rode ui", () => {
    assert.equal(
      magOpTafel({ diets: [], ingredientNamen: ["rode ui", "olijfolie"] }, gevraagd),
      false,
    );
  });

  test("één woord blijft over de hele lijst kijken", () => {
    assert.equal(
      magOpTafel(
        { diets: [], ingredientNamen: ["rode paprika", "ui"] },
        { dieet: [], afkeer: ["ui"] },
      ),
      false,
    );
  });

  test("en het bezwaar noemt hem dan ook niet", () => {
    const voorkeuren = leesVoorkeuren(
      schrijfVoorkeuren({ Chris: { dieet: [], afkeer: ["rode ui"], zwanger: false } }),
      NAMEN,
    );
    assert.deepEqual(bezwaren(voorkeuren, ["rode paprika", "ui"]), []);
    assert.deepEqual(bezwaren(voorkeuren, ["rode ui"]), [
      { naam: "Chris", woorden: ["rode ui"] },
    ]);
  });
});

describe("het samenvoegen bij opslaan", () => {
  const opgeslagen = schrijfVoorkeuren({
    Chris: { dieet: [], afkeer: ["koriander"], zwanger: false },
    Sanne: { dieet: ["veganistisch"], afkeer: [], zwanger: false },
  });

  test("wie niet op het formulier stond houdt zijn voorkeur", () => {
    // Sanne uit het huishouden halen mag haar dieet niet wissen: zet je haar
    // terug, dan hoort het er weer te staan.
    const uit = voegSamen(opgeslagen, { Chris: { dieet: [], afkeer: ["olijf"], zwanger: false } }, [
      "Chris",
    ]);
    const terug = leesVoorkeuren(uit, ["Chris", "Sanne"]);
    assert.deepEqual(terug.Chris.afkeer, ["olijf"]);
    assert.deepEqual(terug.Sanne.dieet, ["vegetarisch", "veganistisch", "lactosevrij"]);
  });

  test("leeg invullen wist alleen die ene", () => {
    const uit = voegSamen(opgeslagen, {}, ["Chris"]);
    const terug = leesVoorkeuren(uit, ["Chris", "Sanne"]);
    assert.equal(terug.Chris, undefined);
    assert.ok(terug.Sanne);
  });

  test("onleesbaar opgeslagen begint met een schone lei", () => {
    const uit = voegSamen("{geen json", { Chris: { dieet: [], afkeer: ["ui"], zwanger: false } }, [
      "Chris",
    ]);
    assert.deepEqual(leesVoorkeuren(uit, NAMEN).Chris.afkeer, ["ui"]);
  });
});
