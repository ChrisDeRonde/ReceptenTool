import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bestandsnaam, receptNaarMarkdown } from "@/lib/recipe/markdown";
import type { Recipe } from "@/lib/recipe/schema";

const basis = {
  title: "Shakshuka met feta",
  description: "Eieren gepocheerd in een pittige tomatensaus.",
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  totalMinutes: 30,
  ingredientGroups: [
    {
      name: null,
      items: [
        { quantity: 2, unit: "el", name: "olijfolie", note: null },
        { quantity: 1, unit: null, name: "ui", note: "gesnipperd" },
        { quantity: null, unit: null, name: "peper en zout", note: null },
      ],
    },
  ],
  steps: [
    {
      title: "Voorbereiden",
      text: "Fruit de ui.",
      ingredientRefs: [1],
      timerMinutes: 8,
      tip: null,
    },
    {
      title: null,
      text: "Voeg de tomaten toe.",
      ingredientRefs: [],
      timerMinutes: null,
      tip: "Niet te vroeg zouten.",
    },
  ],
  tips: ["Lekker met yoghurt."],
  tags: [],
  mealTypes: [],
  cuisine: null,
  sourceName: null,
  imageUrl: null,
  assumptions: [],
} as unknown as Recipe;

describe("receptNaarMarkdown", () => {
  const uit = receptNaarMarkdown(basis);

  test("begint met de titel als kop", () => {
    assert.ok(uit.startsWith("# Shakshuka met feta\n"));
  });

  test("hoeveelheden staan er zoals in de app", () => {
    assert.match(uit, /^- 2 el olijfolie$/m);
    assert.match(uit, /^- 1 ui, gesnipperd$/m);
  });

  test("iets zonder maat krijgt geen spookspatie", () => {
    assert.match(uit, /^- peper en zout$/m);
  });

  test("stappen zijn genummerd, met kop en tijd", () => {
    assert.match(uit, /^1\. \*\*Voorbereiden\.\*\* Fruit de ui\. \*\(8 min\)\*$/m);
    assert.match(uit, /^2\. Voeg de tomaten toe\.$/m);
  });

  test("een tip bij een stap staat eronder als citaat", () => {
    assert.match(uit, /^ {3}> Niet te vroeg zouten\.$/m);
  });

  test("de algemene tips krijgen een eigen kop", () => {
    assert.match(uit, /## Tips\n\n- Lekker met yoghurt\./);
  });

  test("eindigt met precies één regeleinde", () => {
    assert.ok(uit.endsWith("\n"));
    assert.ok(!uit.endsWith("\n\n"));
  });

  test("nergens drie lege regels achter elkaar", () => {
    assert.doesNotMatch(uit, /\n{3,}/);
  });

  test("zonder kooklog geen kopje Gemaakt", () => {
    assert.doesNotMatch(uit, /## Gemaakt/);
  });
});

describe("receptNaarMarkdown met wat eromheen staat", () => {
  const uit = receptNaarMarkdown(basis, {
    sourceUrl: "https://example.com/shakshuka",
    sourceName: "Leuke Recepten",
    tags: "eenpans, vegetarisch",
    cuisine: "Midden-Oosters",
    createdAt: new Date(2026, 7, 8),
    gemaakt: [
      {
        cookedAt: new Date(2026, 7, 9),
        rating: 4,
        note: "Iets te pittig",
        again: true,
        who: "Sanne",
      },
      { cookedAt: new Date(2026, 6, 1), rating: null, note: null, again: null, who: null },
    ],
  });

  test("de bron staat als link onderaan", () => {
    assert.match(uit, /Bron: \[Leuke Recepten\]\(https:\/\/example\.com\/shakshuka\)/);
  });

  test("keuken en tags worden hekjes", () => {
    assert.match(uit, /#midden-oosters #eenpans #vegetarisch/);
  });

  test("de kooklog komt er met sterren en naam bij", () => {
    assert.match(uit, /- 9 augustus 2026 · Sanne · ★★★★☆ · vaker eten — Iets te pittig/);
  });

  test("een keer zonder oordeel is gewoon een datum", () => {
    assert.match(uit, /^- 1 juli 2026$/m);
  });
});

describe("bestandsnaam", () => {
  test("wordt een leesbare slug", () => {
    assert.equal(bestandsnaam("Shakshuka met feta", "r1"), "shakshuka-met-feta.md");
  });

  test("accenten en leestekens eruit", () => {
    // Anders is `soufflé.md` op macOS hetzelfde bestand als `souffle.md` en
    // op Linux niet.
    assert.equal(bestandsnaam("Soufflé au fromage!", "r2"), "souffle-au-fromage.md");
  });

  test("een titel zonder letters valt terug op het id", () => {
    assert.equal(bestandsnaam("♥♥♥", "r3"), "recept-r3.md");
  });

  test("een eindeloze titel wordt afgekapt", () => {
    const naam = bestandsnaam("a".repeat(200), "r4");
    assert.ok(naam.length <= 64, naam.length.toString());
  });
});

describe("de hekjes onderaan", () => {
  test("een kenmerk dat én kolom én tag is, staat er één keer", () => {
    // `npm run dieet` haalde "vegetarisch" naar de dieetkolom; stond de tag er
    // ook nog, dan werd het #vegetarisch #vegetarisch.
    const uit = receptNaarMarkdown(basis, {
      diets: "vegetarisch",
      tags: "eenpans, vegetarisch",
      cuisine: "Midden-Oosters",
    });
    assert.match(uit, /#midden-oosters #vegetarisch #eenpans/);
    assert.equal(uit.match(/#vegetarisch/g)?.length, 1);
  });

  test("verschil in hoofdletters telt als hetzelfde hekje", () => {
    const uit = receptNaarMarkdown(basis, {
      diets: "vegetarisch",
      tags: "Vegetarisch",
    });
    assert.equal(uit.match(/#vegetarisch/g)?.length, 1);
  });
});
