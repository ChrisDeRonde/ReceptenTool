import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ingredientFromFields, parseAmount } from "@/lib/recipe/amount";
import { formatAmount, formatClock, formatNumber } from "@/lib/recipe/format";
import { roundQuantity, scaleRecipe } from "@/lib/recipe/scale";
import type { Recipe } from "@/lib/recipe/schema";

const item = (quantity: number | null, unit: string | null) => ({
  quantity,
  unit,
  name: "x",
  note: null,
});

describe("parseAmount is de tegenhanger van formatAmount", () => {
  // Open je een recept en sla je het op zonder iets te wijzigen, dan hoort er
  // geen letter veranderd te zijn. Dit is de test die dat vasthoudt.
  const gevallen: Array<[number | null, string | null]> = [
    [300, "g"], [2, "teentje"], [0.5, null], [1.5, "el"], [0.25, "l"],
    [1, "stuk"], [null, "snufje"], [null, null], [2, null], [0.75, "kg"],
    [1 / 3, "kop"], [2 / 3, "tl"], [12, "ml"], [1.25, "l"], [250, "gram"],
  ];

  for (const [quantity, unit] of gevallen) {
    const tekst = formatAmount(item(quantity, unit));
    test(`"${tekst || "(leeg)"}" overleeft heen en terug`, () => {
      const terug = parseAmount(tekst);
      assert.equal(formatAmount({ ...terug, name: "x", note: null }), tekst);
    });
  }
});

describe("parseAmount leest wat een mens intypt", () => {
  const gevallen: Array<[string, number | null, string | null]> = [
    ["300g", 300, "g"],
    ["  300   g  ", 300, "g"],
    ["1/2 kop", 0.5, "kop"],
    ["0,5 l", 0.5, "l"],
    ["1.25 kg", 1.25, "kg"],
    ["1 ½ el", 1.5, "el"],
    ["½", 0.5, null],
    ["2", 2, null],
    ["", null, null],
    ["snufje", null, "snufje"],
    ["naar smaak", null, "naar smaak"],
  ];

  for (const [invoer, quantity, unit] of gevallen) {
    test(`"${invoer}"`, () => {
      const r = parseAmount(invoer);
      if (quantity === null) assert.equal(r.quantity, null);
      else assert.ok(Math.abs((r.quantity ?? 0) - quantity) < 1e-9);
      assert.equal(r.unit, unit);
    });
  }

  test("een marge blijft staan zoals je hem typt en schaalt niet mee", () => {
    // "2-3 el" is geen getal maar een bandbreedte. Er stiekem 2 van maken zou
    // het recept preciezer laten lijken dan het is.
    assert.deepEqual(parseAmount("2-3 el"), { quantity: null, unit: "2-3 el" });
    assert.deepEqual(parseAmount("2 – 3 tl"), { quantity: null, unit: "2 – 3 tl" });
  });
});

describe("ingredientFromFields", () => {
  test("zonder naam is het geen ingrediënt", () => {
    assert.equal(ingredientFromFields({ amount: "2", name: "  ", note: "" }), null);
  });

  test("trimt naam en notitie", () => {
    const i = ingredientFromFields({ amount: "200 g", name: " bloem ", note: " gezeefd " });
    assert.deepEqual(i, { quantity: 200, unit: "g", name: "bloem", note: "gezeefd" });
  });

  test("zonder hoeveelheid blijft alles leeg", () => {
    const i = ingredientFromFields({ amount: "", name: "peper", note: "" });
    assert.deepEqual(i, { quantity: null, unit: null, name: "peper", note: null });
  });
});

describe("formatNumber", () => {
  test("hele getallen blijven heel", () => assert.equal(formatNumber(300), "300"));
  test("een half wordt een breuk", () => assert.equal(formatNumber(0.5), "½"));
  test("anderhalf ook", () => assert.equal(formatNumber(1.5), "1½"));
  test("de rest met een komma", () => assert.equal(formatNumber(1.2), "1,2"));
});

describe("formatClock", () => {
  test("onder het uur", () => assert.equal(formatClock(8 * 60), "8:00"));
  test("boven het uur", () => assert.equal(formatClock(90 * 60), "1:30:00"));
  test("negatief telt als nul", () => assert.equal(formatClock(-5), "0:00"));
});

describe("roundQuantity rondt af op iets waarmee je kunt koken", () => {
  test("geen 266,67 g maar iets weegbaars", () => {
    const g = roundQuantity(266.67, "g");
    assert.ok(Number.isInteger(g) || g % 0.5 === 0, `kreeg ${g}`);
    assert.ok(Math.abs(g - 266.67) < 10, `te ver weg: ${g}`);
  });

  test("lepels blijven in halve stappen", () => {
    assert.equal(roundQuantity(1.4, "el") % 0.5, 0);
  });
});

describe("scaleRecipe", () => {
  const basis = {
    title: "Test",
    description: null,
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 20,
    totalMinutes: 30,
    ingredientGroups: [
      { name: null, items: [item(200, "g"), { ...item(null, null), name: "peper" }] },
    ],
    steps: [{ title: null, text: "Kook 10 minuten.", ingredientRefs: [0], timerMinutes: 10, tip: null }],
    tips: [],
    tags: [],
    mealTypes: [],
    cuisine: null,
    sourceName: null,
    imageUrl: null,
    assumptions: [],
  } as unknown as Recipe;

  test("hoeveelheden schalen mee", () => {
    const groter = scaleRecipe(basis, 4);
    assert.equal(groter.ingredientGroups[0].items[0].quantity, 400);
  });

  test("iets zonder getal blijft zoals het was", () => {
    const groter = scaleRecipe(basis, 4);
    assert.equal(groter.ingredientGroups[0].items[1].quantity, null);
  });

  test("tijden schalen bewust niet mee", () => {
    // Twee keer zoveel pasta kookt niet twee keer zo lang.
    const groter = scaleRecipe(basis, 4);
    assert.equal(groter.cookMinutes, 20);
    assert.equal(groter.steps[0].timerMinutes, 10);
  });

  test("de staptekst blijft ongemoeid", () => {
    assert.equal(scaleRecipe(basis, 4).steps[0].text, "Kook 10 minuten.");
  });

  test("hetzelfde aantal verandert niets", () => {
    assert.equal(scaleRecipe(basis, 2), basis);
  });
});
