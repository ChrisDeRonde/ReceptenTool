import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { leesSortering, sorteer, type Kennis } from "@/lib/recipe/sorteer";

const rij = (id: string, over: Partial<{ title: string; favorite: boolean; createdAt: Date }> = {}) => ({
  id,
  title: over.title ?? id,
  favorite: over.favorite ?? false,
  createdAt: over.createdAt ?? new Date(2026, 0, 1),
});

const leeg: Kennis = { cijfers: new Map(), laatst: new Map() };
const namen = (rijen: { id: string }[]) => rijen.map((r) => r.id);

describe("welke sortering er gevraagd is", () => {
  test("een bekende waarde komt erdoor", () => {
    assert.equal(leesSortering("cijfer"), "cijfer");
    assert.equal(leesSortering(["rust"]), "rust");
  });

  test("onzin en niets vallen terug op de bestaande volgorde", () => {
    assert.equal(leesSortering("onzin"), "vers");
    assert.equal(leesSortering(undefined), "vers");
    assert.equal(leesSortering(""), "vers");
  });
});

describe("nieuwste", () => {
  test("favorieten eerst, dan op datum — de volgorde die er al was", () => {
    const rijen = [
      rij("oud", { createdAt: new Date(2026, 0, 1) }),
      rij("nieuw", { createdAt: new Date(2026, 5, 1) }),
      rij("fav", { createdAt: new Date(2025, 0, 1), favorite: true }),
    ];
    assert.deepEqual(namen(sorteer(rijen, "vers", leeg)), ["fav", "nieuw", "oud"]);
  });

  test("de invoer blijft ongemoeid", () => {
    const rijen = [rij("b"), rij("a")];
    sorteer(rijen, "vers", leeg);
    assert.deepEqual(namen(rijen), ["b", "a"]);
  });
});

describe("best beoordeeld", () => {
  const kennis: Kennis = {
    cijfers: new Map([["goed", 4.8], ["matig", 2.5]]),
    laatst: new Map(),
  };

  test("hoogste cijfer bovenaan", () => {
    const rijen = [rij("matig"), rij("goed")];
    assert.deepEqual(namen(sorteer(rijen, "cijfer", kennis)), ["goed", "matig"]);
  });

  test("zonder cijfer onderaan, niet bovenaan", () => {
    const rijen = [rij("onbekend"), rij("matig")];
    assert.deepEqual(namen(sorteer(rijen, "cijfer", kennis)), ["matig", "onbekend"]);
  });

  test("een favoriet zonder sterren dringt niet voor", () => {
    // Vraag je om het best beoordeelde, dan is een favoriet zonder oordeel
    // geen antwoord op die vraag.
    const rijen = [rij("fav", { favorite: true }), rij("goed")];
    assert.deepEqual(namen(sorteer(rijen, "cijfer", kennis)), ["goed", "fav"]);
  });
});

describe("lang niet gemaakt", () => {
  const kennis: Kennis = {
    cijfers: new Map(),
    laatst: new Map([
      ["gisteren", new Date(2026, 7, 24)],
      ["vorigjaar", new Date(2025, 7, 24)],
    ]),
  };

  test("het langst geleden bovenaan", () => {
    const rijen = [rij("gisteren"), rij("vorigjaar")];
    assert.deepEqual(namen(sorteer(rijen, "rust", kennis)), ["vorigjaar", "gisteren"]);
  });

  test("nooit gemaakt telt vanaf de dag dat het binnenkwam", () => {
    // Anders zou de hele stapel ongemaakte recepten bovenaan blijven staan, en
    // dat is precies de lijst die je al had.
    const rijen = [
      rij("netbinnen", { createdAt: new Date(2026, 7, 20) }),
      rij("vorigjaar"),
    ];
    assert.deepEqual(namen(sorteer(rijen, "rust", kennis)), ["vorigjaar", "netbinnen"]);
  });

  test("bij gelijke stand alfabetisch, zodat de volgorde niet wiebelt", () => {
    const rijen = [rij("zalm"), rij("appel")];
    assert.deepEqual(namen(sorteer(rijen, "rust", leeg)), ["appel", "zalm"]);
  });
});
