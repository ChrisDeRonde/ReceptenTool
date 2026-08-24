import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addDays,
  fromParam,
  midnight,
  startOfWeek,
  strikteDag,
  toParam,
  weekDays,
  weekRange,
} from "@/lib/menu/week";
import {
  normalizeCuisine,
  normalizeMealType,
  normalizeMealTypes,
  packMealTypes,
  unpackMealTypes,
} from "@/lib/recipe/categories";
import { schoon, tintForIn } from "@/lib/people";

describe("weken beginnen op maandag", () => {
  // 2026-08-11 is een dinsdag.
  const dinsdag = new Date(2026, 7, 11, 15, 30);

  test("startOfWeek gaat terug naar maandag", () => {
    assert.equal(toParam(startOfWeek(dinsdag)), "2026-08-10");
  });

  test("een zondag hoort bij de wéék ervoor", () => {
    const zondag = new Date(2026, 7, 16, 12, 0);
    assert.equal(toParam(startOfWeek(zondag)), "2026-08-10");
  });

  test("een maandag blijft zichzelf", () => {
    const maandag = new Date(2026, 7, 10, 23, 59);
    assert.equal(toParam(startOfWeek(maandag)), "2026-08-10");
  });

  test("midnight gooit het tijdstip weg", () => {
    const m = midnight(dinsdag);
    assert.equal(m.getHours(), 0);
    assert.equal(m.getMinutes(), 0);
  });

  test("weekDays geeft zeven dagen, maandag eerst", () => {
    const dagen = weekDays(startOfWeek(dinsdag));
    assert.equal(dagen.length, 7);
    assert.equal(toParam(dagen[0]), "2026-08-10");
    assert.equal(toParam(dagen[6]), "2026-08-16");
  });

  test("weekRange sluit de volgende maandag buiten", () => {
    const { gte, lt } = weekRange(startOfWeek(dinsdag));
    assert.equal(toParam(gte), "2026-08-10");
    assert.equal(toParam(lt), "2026-08-17");
  });

  test("addDays loopt over een maandgrens", () => {
    assert.equal(toParam(addDays(new Date(2026, 7, 30), 3)), "2026-09-02");
  });
});

describe("dagen in en uit de URL", () => {
  test("heen en terug levert dezelfde dag", () => {
    assert.equal(toParam(fromParam("2026-08-10")), "2026-08-10");
  });

  test("onzin valt terug op vandaag", () => {
    assert.equal(toParam(fromParam("niet-een-datum")), toParam(new Date()));
    assert.equal(toParam(fromParam(undefined)), toParam(new Date()));
  });

  test("een array pakt de eerste", () => {
    assert.equal(toParam(fromParam(["2026-08-10", "2026-01-01"])), "2026-08-10");
  });
});

describe("categorieën", () => {
  test("herkent een maaltijdmoment ongeacht hoofdletters", () => {
    assert.equal(normalizeMealType("Diner"), "diner");
  });

  test("wat niet bestaat wordt null", () => {
    assert.equal(normalizeMealType("brunchachtig"), null);
  });

  test("normalizeMealTypes gooit dubbelen en onzin eruit", () => {
    assert.deepEqual(normalizeMealTypes(["diner", "DINER", "onzin", "lunch"]), [
      "lunch",
      "diner",
    ]);
  });

  test("in- en uitpakken is symmetrisch", () => {
    const momenten = normalizeMealTypes(["ontbijt", "diner"]);
    assert.deepEqual(unpackMealTypes(packMealTypes(momenten)), momenten);
  });

  test("een lege string levert geen lege categorie op", () => {
    assert.deepEqual(unpackMealTypes(""), []);
    assert.deepEqual(unpackMealTypes(null), []);
  });

  test("keukens krijgen een hoofdletter", () => {
    assert.equal(normalizeCuisine("italiaans"), "Italiaans");
  });

  test("leeg blijft leeg", () => {
    assert.equal(normalizeCuisine(""), null);
    assert.equal(normalizeCuisine(null), null);
  });
});

describe("avatarkleuren", () => {
  // Hier zat een bug: met een hash op de naam kregen twee huisgenoten dezelfde
  // tint, en dan doet het rondje precies niet waar het voor is.
  test("iedereen in de lijst krijgt een eigen tint", () => {
    assert.notEqual(tintForIn("Chris", ["Chris", "Sanne"]), tintForIn("Sanne", ["Chris", "Sanne"]));
  });

  test("de volgorde bepaalt de kleur, niet de naam", () => {
    assert.equal(tintForIn("Chris", ["Chris", "Sanne"]), tintForIn("Sanne", ["Sanne", "Chris"]));
  });

  test("een onbekende naam valt terug op iets geldigs", () => {
    const tint = tintForIn("Iemand Anders", ["Chris", "Sanne"]);
    assert.ok(Number.isInteger(tint) && tint >= 0 && tint < 4, String(tint));
  });
});

describe("de namenlijst opschonen", () => {
  test("spaties en lege stukken eruit", () => {
    assert.deepEqual(schoon(" Chris , , Sanne "), ["Chris", "Sanne"]);
  });

  test("dubbelen tellen één keer, ongeacht hoofdletters", () => {
    assert.deepEqual(schoon("Chris,chris,Sanne"), ["Chris", "Sanne"]);
  });

  test("een leeg veld levert niemand op", () => {
    assert.deepEqual(schoon(""), []);
    assert.deepEqual(schoon("   ,  "), []);
  });

  test("een onmogelijk lange naam valt af", () => {
    assert.deepEqual(schoon(`Chris,${"a".repeat(40)}`), ["Chris"]);
  });

  test("nooit meer dan acht", () => {
    assert.equal(schoon("a,b,c,d,e,f,g,h,i,j").length, 8);
  });
});

describe("een dag die echt moet kloppen", () => {
  // `fromParam` valt terug op vandaag, en op een webpagina is dat prima. Bij
  // POST /api/v1/weekmenu niet: dan staat het gerecht op de verkeerde dag en
  // krijg je er een 201 bij.
  test("de gewone vorm komt erdoor", () => {
    assert.equal(toParam(strikteDag("2026-08-16") as Date), "2026-08-16");
  });

  test("zonder voorloopnul telt niet", () => {
    assert.equal(strikteDag("2026-8-3"), null);
  });

  test("een maand die niet bestaat rolt niet stilletjes door", () => {
    // `new Date(2026, 12, 45)` wordt 2027-02-14 zonder een kik te geven.
    assert.equal(strikteDag("2026-13-45"), null);
    assert.equal(strikteDag("2026-02-30"), null);
  });

  test("een schrikkeldag bestaat wel", () => {
    assert.equal(toParam(strikteDag("2028-02-29") as Date), "2028-02-29");
  });

  test("iets dat geen tekst is levert niets op", () => {
    assert.equal(strikteDag(null), null);
    assert.equal(strikteDag(20260816), null);
    assert.equal(strikteDag(""), null);
  });

  test("de tijd valt eraf", () => {
    const dag = strikteDag("2026-08-16") as Date;
    assert.equal(dag.getHours(), 0);
    assert.equal(dag.getMinutes(), 0);
  });
});
