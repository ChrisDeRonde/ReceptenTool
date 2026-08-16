import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  dagAlsTekst,
  kooklog,
  receptKort,
  receptVol,
  type RijVol,
} from "@/lib/api/vorm";

const RECEPT = {
  title: "Shakshuka",
  description: "Eieren in tomatensaus.",
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
      ],
    },
  ],
  steps: [
    {
      title: null,
      text: "Fruit de ui.",
      ingredientRefs: [0, 1],
      timerMinutes: 8,
      tip: "Niet te hard, anders wordt hij bitter.",
    },
  ],
  tips: ["Met feta erover."],
  tags: ["eenpans", "snel"],
  mealTypes: ["ontbijt", "diner"],
  cuisine: "Midden-Oosters",
  diets: ["vegetarisch"],
  sourceName: "Allerhande",
  imageUrl: null,
  assumptions: ["Aantal porties geschat."],
};

const rij = (over: Partial<RijVol> = {}): RijVol => ({
  id: "r1",
  title: "Shakshuka",
  imageUrl: "/api/foto/abc.jpg",
  favorite: true,
  totalMinutes: 30,
  cuisine: "Midden-Oosters",
  mealTypes: "ontbijt,diner",
  diets: "vegetarisch,notenvrij",
  tags: "eenpans,snel",
  updatedAt: new Date(2026, 7, 16, 14, 30),
  description: "Eieren in tomatensaus.",
  sourceUrl: "https://ah.nl/recept/1",
  sourceName: "Allerhande",
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  data: JSON.stringify(RECEPT),
  createdAt: new Date(2026, 0, 4),
  editedAt: null,
  editedBy: null,
  ...over,
});

describe("de korte vorm", () => {
  test("pakt de komma-kolommen uit tot lijsten", () => {
    const uit = receptKort(rij());
    assert.deepEqual(uit.momenten, ["ontbijt", "diner"]);
    assert.deepEqual(uit.dieet, ["vegetarisch", "notenvrij"]);
    assert.deepEqual(uit.tags, ["eenpans", "snel"]);
  });

  test("lege kolommen worden lege lijsten, geen [''] ", () => {
    const uit = receptKort(rij({ mealTypes: "", diets: "", tags: "" }));
    assert.deepEqual(uit.momenten, []);
    assert.deepEqual(uit.dieet, []);
    assert.deepEqual(uit.tags, []);
  });

  test("het cijfer wordt afgerond op één decimaal", () => {
    // Zonder afronden komt hier 4.333333333333333 uit, en dan moet elke client
    // zelf gaan bedenken hoe hij dat toont.
    assert.equal(receptKort(rij(), 13 / 3).cijfer, 4.3);
    assert.equal(receptKort(rij(), null).cijfer, null);
  });

  test("bijgewerkt is een ISO-tijdstip, want daar sorteert de app op", () => {
    assert.match(receptKort(rij()).bijgewerkt, /^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("de volle vorm", () => {
  test("vertaalt de blob naar het contract", () => {
    const uit = receptVol(rij());
    assert.ok(uit);
    assert.equal(uit.ingredientgroepen[0].items[0].naam, "olijfolie");
    assert.equal(uit.ingredientgroepen[0].items[1].notitie, "gesnipperd");
    assert.equal(uit.stappen[0].tekst, "Fruit de ui.");
    assert.deepEqual(uit.stappen[0].ingredienten, [0, 1]);
    assert.equal(uit.stappen[0].timerMinuten, 8);
    assert.deepEqual(uit.aannames, ["Aantal porties geschat."]);
  });

  test("een onleesbare blob levert null op in plaats van een uitzondering", () => {
    // Eén recept van vóór een schemawijziging hoort de hele synchronisatie
    // niet tegen te houden.
    assert.equal(receptVol(rij({ data: "{niet eens json" })), null);
    assert.equal(receptVol(rij({ data: JSON.stringify({ titel: "fout veld" }) })), null);
  });

  test("de bron valt weg als er geen bron is", () => {
    const uit = receptVol(rij({ sourceUrl: null, sourceName: null }));
    assert.equal(uit?.bron, null);
  });

  test("het cijfer komt uit de kooklog, en lege regels tellen niet mee", () => {
    const uit = receptVol(rij(), [
      { id: "k1", cookedAt: new Date(2026, 7, 1), rating: 5, note: null, again: true, who: "Chris" },
      { id: "k2", cookedAt: new Date(2026, 6, 1), rating: 4, note: null, again: null, who: null },
      { id: "k3", cookedAt: new Date(2026, 5, 1), rating: null, note: "geen oordeel", again: null, who: null },
    ]);
    assert.equal(uit?.cijfer, 4.5);
    assert.equal(uit?.kooklog.length, 3);
  });

  test("bewerkt is null zolang niemand er iets aan deed", () => {
    assert.equal(receptVol(rij())?.bewerkt, null);
    const bewerkt = receptVol(rij({ editedAt: new Date(2026, 7, 10), editedBy: "Sanne" }));
    assert.equal(bewerkt?.bewerkt?.door, "Sanne");
  });
});

describe("een dag is geen tijdstip", () => {
  test("een kooklogregel gaat over een dag", () => {
    const uit = kooklog({
      id: "k1",
      cookedAt: new Date(2026, 7, 16, 23, 45),
      rating: 4,
      note: null,
      again: null,
      who: "Chris",
    });
    assert.equal(uit.gemaaktOp, "2026-08-16");
  });

  test("de late avond blijft dezelfde dag", () => {
    // Met `toISOString()` zou dit in Nederland 2026-08-16T21:45Z worden en in
    // een andere tijdzone de dag ervoor. Lokale datumdelen dus.
    assert.equal(dagAlsTekst(new Date(2026, 7, 16, 23, 59)), "2026-08-16");
    assert.equal(dagAlsTekst(new Date(2026, 0, 1, 0, 0)), "2026-01-01");
  });
});
