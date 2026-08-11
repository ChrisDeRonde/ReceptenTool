import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createSessionCookie,
  isValidSession,
  sameSecret,
} from "@/lib/session";
import { findDuplicate, normalizeTitle, normalizeUrl } from "@/lib/recipe/duplicate";

/**
 * Het slot en de duplicaatherkenning. Bij het eerste is een fout duur — dan
 * staat de deur open — en bij het tweede kost een fout een modelaanroep.
 */

describe("het inlogkoekje", () => {
  const wachtwoord = "zout-lucht-lepel-stroom-ijzer";

  test("een vers koekje is geldig", async () => {
    const koekje = await createSessionCookie(wachtwoord);
    assert.equal(await isValidSession(koekje.value, wachtwoord), true);
  });

  test("staat niet in de URL en is niet leesbaar door scripts", async () => {
    const koekje = await createSessionCookie(wachtwoord);
    assert.equal(koekje.httpOnly, true);
    assert.equal(koekje.sameSite, "lax");
  });

  test("een ander wachtwoord maakt hem ongeldig", async () => {
    // Dit is de noodrem: wachtwoord wijzigen logt iedereen uit.
    const koekje = await createSessionCookie(wachtwoord);
    assert.equal(await isValidSession(koekje.value, "iets-anders-entotaal"), false);
  });

  test("een verzonnen handtekening komt er niet door", async () => {
    const later = Math.floor(Date.now() / 1000) + 9999;
    assert.equal(await isValidSession(`${later}.${"a".repeat(64)}`, wachtwoord), false);
  });

  test("een verlopen koekje ook niet", async () => {
    const koekje = await createSessionCookie(wachtwoord);
    const handtekening = koekje.value.split(".")[1];
    const verleden = Math.floor(Date.now() / 1000) - 10;
    assert.equal(await isValidSession(`${verleden}.${handtekening}`, wachtwoord), false);
  });

  test("de vervaldatum oprekken breekt de handtekening", async () => {
    const koekje = await createSessionCookie(wachtwoord);
    const handtekening = koekje.value.split(".")[1];
    const veelLater = Math.floor(Date.now() / 1000) + 10 ** 9;
    assert.equal(await isValidSession(`${veelLater}.${handtekening}`, wachtwoord), false);
  });

  test("rommel wordt geweigerd in plaats van te laten crashen", async () => {
    for (const waarde of ["", "geen-punt", ".", "abc.def", "999"]) {
      assert.equal(await isValidSession(waarde, wachtwoord), false, waarde);
    }
    assert.equal(await isValidSession(undefined, wachtwoord), false);
  });
});

describe("sameSecret", () => {
  test("gelijk is gelijk", () => assert.equal(sameSecret("abc", "abc"), true));
  test("ongelijk is ongelijk", () => assert.equal(sameSecret("abc", "abd"), false));
  test("andere lengte ook", () => assert.equal(sameSecret("abc", "abcd"), false));
  test("leeg tegen leeg", () => assert.equal(sameSecret("", ""), true));
});

describe("dezelfde bron herkennen", () => {
  const zelfde = (a: string, b: string) => normalizeUrl(a) !== null && normalizeUrl(a) === normalizeUrl(b);

  test("http en https", () => assert.ok(zelfde("http://site.nl/r", "https://site.nl/r")));
  test("met en zonder www", () => assert.ok(zelfde("https://www.site.nl/r", "https://site.nl/r")));
  test("afsluitende slash", () => assert.ok(zelfde("https://site.nl/r/", "https://site.nl/r")));
  test("hoofdletters in de host", () => assert.ok(zelfde("https://SITE.nl/r", "https://site.nl/r")));
  test("een fragment", () => assert.ok(zelfde("https://site.nl/r#stap2", "https://site.nl/r")));
  test("meeliftende parameters van een deelknop", () => {
    assert.ok(zelfde("https://site.nl/r?utm_source=whatsapp&fbclid=x", "https://site.nl/r"));
  });
  test("volgorde van parameters", () => assert.ok(zelfde("https://site.nl/r?b=2&a=1", "https://site.nl/r?a=1&b=2")));

  test("een ander pad is een ander recept", () => {
    assert.ok(!zelfde("https://site.nl/a", "https://site.nl/b"));
  });
  test("een betekenisvolle parameter telt wél mee", () => {
    assert.ok(!zelfde("https://site.nl/?p=1", "https://site.nl/?p=2"));
  });
  test("onzin en niet-http leveren null", () => {
    assert.equal(normalizeUrl("zomaar wat"), null);
    assert.equal(normalizeUrl("javascript:alert(1)"), null);
    assert.equal(normalizeUrl(null), null);
  });
});

describe("dezelfde titel herkennen", () => {
  const zelfde = (a: string, b: string) => normalizeTitle(a) !== null && normalizeTitle(a) === normalizeTitle(b);

  test("hoofdletters", () => assert.ok(zelfde("Shakshuka", "shakshuka")));
  test("leestekens", () => assert.ok(zelfde("Shakshuka!", "Shakshuka")));
  test("accenten", () => assert.ok(zelfde("Crème brûlée", "creme brulee")));
  test("koppelteken tegen aan elkaar", () => {
    // Nederlands plakt woorden aan elkaar en niet iedereen doet dat hetzelfde.
    assert.ok(zelfde("Pasta met truffel-roomsaus", "Pasta met truffelroomsaus"));
  });
  test("los tegen aan elkaar", () => assert.ok(zelfde("Rode kool", "Rodekool")));
  test("een ander gerecht niet", () => assert.ok(!zelfde("Shakshuka", "Spaghetti")));
  test("te kort levert null", () => assert.equal(normalizeTitle("ei"), null));
});

describe("findDuplicate kiest het sterkste signaal", () => {
  const bestaand = [
    { id: "a", title: "Shakshuka", sourceUrl: "https://site.nl/shakshuka" },
    { id: "b", title: "Spaghetti bolognese", sourceUrl: null },
  ];

  test("de bron gaat voor de titel", () => {
    const hit = findDuplicate(
      { sourceUrl: "https://www.site.nl/shakshuka/", title: "Heel iets anders" },
      bestaand,
    );
    assert.equal(hit?.reason, "bron");
    assert.equal(hit?.id, "a");
  });

  test("de titel als de bron niets oplevert", () => {
    const hit = findDuplicate({ sourceUrl: "https://nieuw.nl/x", title: "spaghetti bolognese" }, bestaand);
    assert.equal(hit?.reason, "titel");
    assert.equal(hit?.id, "b");
  });

  test("een nieuw gerecht is geen duplicaat", () => {
    assert.equal(findDuplicate({ sourceUrl: "https://nieuw.nl/x", title: "Boerenkool" }, bestaand), null);
  });

  test("zonder bron én zonder titel valt er niets te zeggen", () => {
    assert.equal(findDuplicate({ sourceUrl: null, title: null }, bestaand), null);
  });
});
