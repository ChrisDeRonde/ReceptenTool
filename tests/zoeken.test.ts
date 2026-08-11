import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildHaystack,
  compareHits,
  parseQuery,
  score,
} from "@/lib/recipe/search";

/**
 * De valkuil hier is niet "vindt hij het recept" maar "vindt hij het níét als
 * het er niet is". Een kale `includes` liet "ui" matchen op "br**ui**ne
 * suiker", en dat soort treffers sloopt het vertrouwen sneller dan een gemiste.
 */

const hooi = (namen: string[], tekst = "") =>
  buildHaystack({
    title: tekst,
    description: null,
    tags: "",
    cuisine: null,
    data: JSON.stringify({
      ingredientGroups: [
        { name: null, items: namen.map((name) => ({ quantity: null, unit: null, name, note: null })) },
      ],
      steps: [],
      tips: [],
      tags: [],
      title: tekst,
      description: null,
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      mealTypes: [],
      cuisine: null,
      sourceName: null,
      imageUrl: null,
      assumptions: [],
    }),
  });

describe("parseQuery", () => {
  test("spaties splitsen in losse termen", () => {
    assert.deepEqual(
      parseQuery("paprika gehakt").map((t) => t.raw),
      ["paprika", "gehakt"],
    );
  });

  test("een komma houdt woorden bij elkaar", () => {
    assert.deepEqual(
      parseQuery("rode paprika, gehakt").map((t) => t.raw),
      ["rode paprika", "gehakt"],
    );
  });

  test("losse letters vallen af", () => {
    assert.deepEqual(parseQuery("a paprika").map((t) => t.raw), ["paprika"]);
  });

  test("dubbele termen tellen één keer", () => {
    assert.equal(parseQuery("ui ui uien").length, 1);
  });

  test("leeg levert niets op", () => {
    assert.deepEqual(parseQuery(""), []);
    assert.deepEqual(parseQuery(null), []);
  });

  test("meer dan acht termen worden afgekapt", () => {
    assert.equal(parseQuery("een twee drie vier vijf zes zeven acht negen tien").length, 8);
  });
});

describe("score", () => {
  test("vindt een ingrediënt", () => {
    const hit = score(hooi(["paprika", "gehakt"]), parseQuery("paprika"));
    assert.equal(hit?.matched, 1);
    assert.deepEqual(hit?.inIngredients, ["paprika"]);
  });

  test("houdt bij wat er mist", () => {
    const hit = score(hooi(["paprika"]), parseQuery("paprika gehakt"));
    assert.equal(hit?.matched, 1);
    assert.deepEqual(hit?.missing, ["gehakt"]);
  });

  test("geen enkele treffer levert null", () => {
    assert.equal(score(hooi(["paprika"]), parseQuery("zalm")), null);
  });

  test("meervoud telt mee: paprika vindt paprika's", () => {
    assert.equal(score(hooi(["rode paprika's"]), parseQuery("paprika"))?.matched, 1);
  });

  test("de kern van een samenstelling telt: gehakt vindt rundergehakt", () => {
    assert.equal(score(hooi(["rundergehakt"]), parseQuery("gehakt"))?.matched, 1);
  });

  test("maar niet elke willekeurige woordstaart: loem vindt geen bloem", () => {
    assert.equal(score(hooi(["bloem"]), parseQuery("loem")), null);
  });

  test("en niet middenin een woord: ui zit niet in bruine suiker", () => {
    assert.equal(score(hooi(["bruine suiker", "boter"]), parseQuery("ui")), null);
  });

  test("de titel telt ook, maar apart van de ingrediënten", () => {
    const hit = score(hooi(["ei"], "Shakshuka"), parseQuery("shakshuka"));
    assert.equal(hit?.matched, 1);
    assert.deepEqual(hit?.inIngredients, [], "titeltreffer hoort niet bij de ingrediënten");
  });

  test("zonder komma is 'rode paprika' gewoon twee termen", () => {
    assert.equal(score(hooi(["rode paprika"]), parseQuery("rode paprika"))?.matched, 2);
  });

  test("mét komma is het één term, en die moet compleet zijn", () => {
    const termen = parseQuery("rode paprika, gehakt");
    assert.equal(termen.length, 2);
    assert.equal(score(hooi(["rode paprika", "gehakt"]), termen)?.matched, 2);

    const half = score(hooi(["groene paprika", "gehakt"]), termen);
    assert.equal(half?.matched, 1);
    assert.deepEqual(half?.missing, ["rode paprika"]);
  });

  test("zonder zoektermen is alles een treffer met nul", () => {
    assert.deepEqual(score(hooi(["ui"]), []), { matched: 0, inIngredients: [], missing: [] });
  });
});

describe("compareHits", () => {
  const maak = (matched: number, inIngredients: string[], favorite = false, dag = 1) => ({
    hit: { matched, inIngredients, missing: [] },
    favorite,
    createdAt: new Date(2026, 0, dag),
  });

  test("meer treffers gaat voor", () => {
    assert.ok(compareHits(maak(2, []), maak(1, [])) < 0);
  });

  test("bij gelijk aantal wint wie het in de ingrediënten had", () => {
    assert.ok(compareHits(maak(1, ["ui"]), maak(1, [])) < 0);
  });

  test("daarna favoriet", () => {
    assert.ok(compareHits(maak(1, [], true), maak(1, [], false)) < 0);
  });

  test("en als laatste het nieuwste", () => {
    assert.ok(compareHits(maak(1, [], false, 9), maak(1, [], false, 2)) < 0);
  });
});
