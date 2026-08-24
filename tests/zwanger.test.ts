import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  beoordeelIngredient,
  beoordeelRecept,
  iemandZwanger,
  NIVEAU_LABEL,
  REGELS,
  type Niveau,
} from "@/lib/zwanger";
import { canonicalName } from "@/lib/shopping/units";

describe("de lijst zelf", () => {
  test("elke regel heeft een reden", () => {
    for (const regel of REGELS) {
      assert.ok(regel.waarom.length > 10, JSON.stringify(regel.termen));
      assert.ok(regel.termen.length > 0);
    }
  });

  test("de termen staan in de vorm waarin ingrediënten worden opgeslagen", () => {
    // Anders matcht een regel nooit: `beoordeelIngredient` haalt de naam door
    // `canonicalName`, dus een term met een hoofdletter of een meervoud vindt
    // niets. Dezelfde controle als bij de seizoenslijst.
    for (const regel of REGELS) {
      for (const term of regel.termen) {
        assert.equal(canonicalName(term), canonicalName(canonicalName(term)), term);
      }
    }
  });

  test("wat specifiek is staat boven wat algemeen is", () => {
    // "gerookte zalm" moet vóór "zalm" komen, anders krijgt gerookte zalm het
    // groene etiket van gewone zalm. Dit is de valkuil van een lijst waarvan
    // de volgorde ertoe doet, dus hij wordt hier vastgelegd.
    const paren: Array<[string, string]> = [
      ["gerookte zalm", "zalm"],
      ["leverworst", "worst"],
    ];
    for (const [specifiek, algemeen] of paren) {
      const iSpecifiek = REGELS.findIndex((r) => r.termen.includes(specifiek));
      const iAlgemeen = REGELS.findIndex((r) => r.termen.includes(algemeen));
      if (iSpecifiek >= 0 && iAlgemeen >= 0) {
        assert.ok(iSpecifiek < iAlgemeen, `${specifiek} hoort boven ${algemeen}`);
      }
    }
  });
});

describe("één ingrediënt beoordelen", () => {
  const niveauVan = (naam: string): Niveau | null =>
    beoordeelIngredient(naam)?.niveau ?? null;

  test("rauw vlees is niet te eten", () => {
    assert.equal(niveauVan("filet américain"), "onveilig");
    assert.equal(niveauVan("ossenworst"), "onveilig");
    assert.equal(niveauVan("salami"), "onveilig");
  });

  test("lever ook, en om een andere reden", () => {
    assert.match(beoordeelIngredient("leverworst")!.waarom, /vitamine A/i);
  });

  test("gerookte zalm is onveilig, gewone zalm niet", () => {
    // De volgorde-val uit de test hierboven, nu van de andere kant bekeken.
    assert.equal(niveauVan("gerookte zalm"), "onveilig");
    assert.equal(niveauVan("zalm"), "veilig");
  });

  test("zachte kaas is pas op, harde kaas is veilig", () => {
    assert.equal(niveauVan("brie"), "pasop");
    assert.equal(niveauVan("gorgonzola"), "pasop");
    assert.equal(niveauVan("belegen kaas"), "veilig");
  });

  test("wat verhit mag worden, zegt dat er ook bij", () => {
    assert.match(beoordeelIngredient("brie")!.tenzij ?? "", /verhit|gepasteuriseerd/i);
    assert.match(beoordeelIngredient("gerookte zalm")!.tenzij ?? "", /oven|verhit/i);
  });

  test("alcohol is onveilig, ook als wijn", () => {
    assert.equal(niveauVan("rode wijn"), "onveilig");
    assert.equal(niveauVan("cognac"), "onveilig");
  });

  test("iets dat niet op de lijst staat krijgt géén etiket", () => {
    // Uitdrukkelijk null en niet "veilig": niets zeggen is eerlijk, "veilig"
    // zeggen op een gok is dat niet. Zie de kop van zwanger.ts.
    assert.equal(beoordeelIngredient("wortel"), null);
    assert.equal(beoordeelIngredient("bloem"), null);
    assert.equal(beoordeelIngredient(""), null);
  });

  test("meervoud en hoofdletters slaan ook aan", () => {
    assert.equal(niveauVan("Rauwe oesters"), "onveilig");
    assert.equal(niveauVan("oesters"), "onveilig");
  });
});

describe("een heel recept beoordelen", () => {
  test("het zwaarste telt", () => {
    const uit = beoordeelRecept(["gouda", "brie", "filet américain", "ui"]);
    assert.equal(uit.zwaarste, "onveilig");
    assert.equal(uit.onveilig.length, 1);
    assert.equal(uit.pasop.length, 1);
    assert.equal(uit.veilig.length, 1);
  });

  test("alleen pas op blijft pas op", () => {
    assert.equal(beoordeelRecept(["brie", "ui"]).zwaarste, "pasop");
  });

  test("een recept zonder herkende ingrediënten geeft niets", () => {
    // Belangrijk: dit is géén goedkeuring. `zwaarste` is null, en het scherm
    // toont dan niets in plaats van "veilig".
    const uit = beoordeelRecept(["ui", "wortel", "bloem"]);
    assert.equal(uit.zwaarste, null);
    assert.deepEqual(uit.onveilig, []);
  });

  test("een lege lijst valt niet om", () => {
    assert.equal(beoordeelRecept([]).zwaarste, null);
  });

  test("de bevinding draagt het ingrediënt zoals het in het recept staat", () => {
    // Niet de term uit de lijst: op het scherm wil je lezen wat er in jouw
    // recept staat, niet hoe onze regel heet.
    const uit = beoordeelRecept(["Gerookte zalm"]);
    assert.equal(uit.onveilig[0].ingredient, "Gerookte zalm");
  });
});

describe("wie het aangaat", () => {
  test("alleen wie het vinkje aan heeft", () => {
    assert.deepEqual(
      iemandZwanger({
        Chris: { zwanger: false },
        Sanne: { zwanger: true },
      }),
      ["Sanne"],
    );
  });

  test("niemand is een lege lijst", () => {
    assert.deepEqual(iemandZwanger({ Chris: {} }), []);
    assert.deepEqual(iemandZwanger({}), []);
  });
});

describe("de etiketten zeggen wat je moet doen", () => {
  test("niet 'onveilig' maar 'niet eten'", () => {
    // Een eigenschap beschrijven is iets anders dan zeggen wat je moet doen,
    // en aan een keukentafel wil je het tweede.
    assert.equal(NIVEAU_LABEL.onveilig, "Niet eten");
    assert.equal(NIVEAU_LABEL.pasop, "Pas op");
    assert.equal(NIVEAU_LABEL.veilig, "Veilig");
  });
});

describe("waar de app zich niet rijker voordoet dan hij is", () => {
  test("vlees is 'pas op' en niet 'veilig' — het hangt aan de bereiding", () => {
    // Biefstuk wordt vaak rosé gegeten. Een groen vlaggetje ernaast zou een
    // uitspraak zijn die dit programma niet kan doen: het kent het recept niet,
    // het herkent een woord.
    assert.equal(beoordeelIngredient("biefstuk")?.niveau, "pasop");
    assert.equal(beoordeelIngredient("kipfilet")?.niveau, "pasop");
    assert.match(beoordeelIngredient("gehakt")!.waarom, /doorbakken/i);
  });

  test("groen is er alleen voor wat er zonder voorbehoud in mag", () => {
    for (const regel of REGELS.filter((r) => r.niveau === "veilig")) {
      assert.equal(regel.tenzij, undefined, regel.termen.join(", "));
    }
  });
});

describe("geen loos alarm", () => {
  test("keukenkruiden geven geen waarschuwing", () => {
    // Kaneel, nootmuskaat en salie worden alleen in medicinale hoeveelheden
    // afgeraden. Een oranje vlag op elk baksel leert je oranje te negeren.
    for (const kruid of ["kaneel", "nootmuskaat", "salie", "lijnzaad"]) {
      assert.equal(beoordeelIngredient(kruid), null, kruid);
    }
  });

  test("een doodgewoon baksel blijft schoon", () => {
    const uit = beoordeelRecept(["bloem", "suiker", "banaan", "kaneel", "bakpoeder"]);
    assert.equal(uit.zwaarste, null);
  });
});
