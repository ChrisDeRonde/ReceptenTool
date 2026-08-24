#!/usr/bin/env node
/**
 * De API v1 langs de meetlat, over echte HTTP.
 *
 * Draaien:  npm run demo            (in een ander venster)
 *           npm run api:check
 *
 *           npm run api:check -- https://klapper.jouw.ts.net geheim
 *
 * Waarom dit geen gewone test is: `npm test` draait pure functies zonder server
 * en moet in twee seconden klaar zijn. Dit heeft een draaiende app nodig, praat
 * echt over het net en schrijft in de database. Dat hoort niet in dezelfde
 * knop — maar het hoort wél in de repo, want dit is het contract waar de
 * telefoon op vertrouwt, en dat wil je kunnen nakijken zonder Xcode.
 *
 * **Wijst standaard naar de proefopstelling** (poort 3100, wachtwoord
 * `proefkonijn`). Wijs je hem naar je echte server, dan schrijft hij daar ook
 * echt: er komt een kooklogregel bij en een weekmenu-regel, allebei worden ze
 * weer opgeruimd. Een recept wordt nooit aangemaakt of verwijderd.
 */

const [, , adresArg, wachtwoordArg] = process.argv;
const BASIS = (adresArg ?? "http://localhost:3100").replace(/\/$/, "");
const WACHTWOORD = wachtwoordArg ?? "proefkonijn";
const V1 = `${BASIS}/api/v1`;

let goed = 0;
const stuk = [];

function check(naam, ok, extra = "") {
  const staat = ok ? "  ok  " : "  ✗   ";
  console.log(`${staat}${naam}${extra ? `  — ${extra}` : ""}`);
  if (ok) goed += 1;
  else stuk.push(naam);
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Alle aanroepen delen dezelfde kop, behalve die van het slot zelf. */
function maakVragen(token) {
  return async function vraag(pad, opties = {}) {
    const kop = { authorization: `Bearer ${token}`, ...(opties.headers ?? {}) };
    if (opties.body) kop["content-type"] = "application/json";
    const response = await fetch(`${V1}${pad}`, {
      ...opties,
      headers: kop,
      body: opties.body ? JSON.stringify(opties.body) : undefined,
    });
    return { status: response.status, body: await json(response) };
  };
}

async function main() {
  console.log(`\n  ${V1}\n`);

  // --- Het slot -----------------------------------------------------------

  let response = await fetch(`${V1}/stand`);
  check("zonder token komt er niets uit", response.status === 401, `${response.status}`);
  check("en de weigering legt uit hoe het wel moet", (await json(response))?.fout === "niet_aangemeld");

  response = await fetch(`${V1}/aanmelden`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wachtwoord: `${WACHTWOORD}-fout` }),
  });
  check("een verkeerd wachtwoord wordt geweigerd", response.status === 401, `${response.status}`);

  response = await fetch(`${V1}/aanmelden`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wachtwoord: WACHTWOORD }),
  });
  const aanmelding = await json(response);
  check("aanmelden levert een token", response.status === 200 && typeof aanmelding?.token === "string", `${response.status}`);
  if (!aanmelding?.token) {
    console.log("\n  Zonder token valt er niets te controleren. Draait de server, en klopt het wachtwoord?\n");
    process.exit(1);
  }

  const vraag = maakVragen(aanmelding.token);

  response = await fetch(`${V1}/stand`, { headers: { authorization: "Bearer 9999999999.deadbeef" } });
  check("een zelfverzonnen token komt er niet in", response.status === 401, `${response.status}`);
  check("een geldig token laat zich nakijken", (await vraag("/aanmelden")).body?.ok === true);

  // --- De stand -----------------------------------------------------------

  const stand = (await vraag("/stand")).body;
  check("de stand somt alle recepten op", Array.isArray(stand?.recepten), `${stand?.recepten?.length} stuks`);
  check("elk met een tijdstempel om op te vergelijken", stand.recepten.every((r) => r.id && r.bijgewerkt));
  check("de instellingen gaan mee", Number.isInteger(stand?.instellingen?.huishouden));
  check("en de openstaande inbox is geteld", Number.isInteger(stand?.inbox?.open), `${stand?.inbox?.open} open`);

  if (stand.recepten.length === 0) {
    console.log("\n  Geen recepten op deze server; de rest valt niet te controleren.\n");
    process.exit(1);
  }

  // --- Recepten -----------------------------------------------------------

  const ids = stand.recepten.slice(0, 3).map((r) => r.id);
  const bundel = (await vraag(`/recepten?ids=${ids.join(",")}`)).body;
  check("recepten op id levert er precies zoveel", bundel?.recepten?.length === ids.length, `${bundel?.recepten?.length}`);

  const proef = bundel.recepten[0];
  check("een recept draagt het contract, niet de databaserij", ["ingredientgroepen", "stappen", "dieet", "momenten"].every((veld) => veld in proef));
  check("stappen verwijzen naar hun ingrediënten", Array.isArray(proef.stappen?.[0]?.ingredienten ?? []));
  check("een cijfer is afgerond of afwezig", proef.cijfer === null || Math.round(proef.cijfer * 10) === proef.cijfer * 10, `${proef.cijfer}`);

  const teveel = Array.from({ length: 51 }, (_, i) => `x${i}`).join(",");
  check("meer dan vijftig tegelijk wordt geweigerd", (await vraag(`/recepten?ids=${teveel}`)).status === 400);

  const een = await vraag(`/recepten/${proef.id}`);
  check("één recept opvragen werkt", een.status === 200 && een.body.id === proef.id);
  check("kooklogdatums zijn dagen, geen tijdstippen", (een.body.kooklog ?? []).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k.gemaaktOp)));
  check("een onbekend recept geeft 404", (await vraag("/recepten/bestaatniet")).status === 404);

  // --- Bijstellen ---------------------------------------------------------

  const warenFavoriet = proef.favoriet;
  let aangepast = await vraag(`/recepten/${proef.id}`, {
    method: "PATCH",
    body: { favoriet: !warenFavoriet },
  });
  check("favoriet omzetten werkt", aangepast.status === 200 && aangepast.body.favoriet === !warenFavoriet);
  aangepast = await vraag(`/recepten/${proef.id}`, { method: "PATCH", body: { favoriet: warenFavoriet } });
  check("en weer terug", aangepast.body.favoriet === warenFavoriet);

  check("een lege aanpassing wordt geweigerd", (await vraag(`/recepten/${proef.id}`, { method: "PATCH", body: {} })).status === 400);
  check("een onbekend dieet valt weg in plaats van erin te sluipen",
    (await vraag(`/recepten/${proef.id}`, { method: "PATCH", body: { dieet: ["onzin"] } })).body?.dieet?.length === 0);
  await vraag(`/recepten/${proef.id}`, { method: "PATCH", body: { dieet: proef.dieet } });

  // --- Weekmenu -----------------------------------------------------------

  const week = (await vraag("/weekmenu")).body;
  check("het weekmenu geeft een week en regels", typeof week?.week === "string" && Array.isArray(week.regels), week?.week);
  const voor = week.regels.length;

  const gezet = await vraag("/weekmenu", {
    method: "POST",
    body: { receptId: proef.id, dag: week.week, porties: 4 },
  });
  check("een gerecht inplannen werkt", gezet.status === 201 && gezet.body.porties === 4, `${gezet.status}`);
  check("en hij staat in de week", (await vraag(`/weekmenu?week=${week.week}`)).body.regels.length === voor + 1);

  const bijgesteld = await vraag(`/weekmenu/${gezet.body.id}`, { method: "PATCH", body: { porties: 6 } });
  check("de porties zijn bij te stellen", bijgesteld.body?.porties === 6, `${bijgesteld.body?.porties}`);
  check("porties zonder getal wordt geweigerd", (await vraag(`/weekmenu/${gezet.body.id}`, { method: "PATCH", body: { porties: "zes" } })).status === 400);
  // `Number(null)` is 0, en dat komt door `Number.isInteger` heen; zonder een
  // typecontrole werd dit stil de ondergrens in plaats van een nette 400.
  check("porties null wordt geweigerd", (await vraag(`/weekmenu/${gezet.body.id}`, { method: "PATCH", body: { porties: null } })).status === 400);
  check("porties als lege tekst wordt geweigerd", (await vraag(`/weekmenu/${gezet.body.id}`, { method: "PATCH", body: { porties: "" } })).status === 400);

  // Een dag die niet klopt hoort niet stilletjes vandaag te worden: dan staat
  // het gerecht op de verkeerde datum en krijg je er een 201 bij.
  check("een dag zonder voorloopnul wordt geweigerd",
    (await vraag("/weekmenu", { method: "POST", body: { receptId: proef.id, dag: "2026-8-3" } })).status === 400);
  check("een dag die niet bestaat wordt geweigerd",
    (await vraag("/weekmenu", { method: "POST", body: { receptId: proef.id, dag: "2026-13-45" } })).status === 400);

  check("een onbekend recept inplannen geeft 404",
    (await vraag("/weekmenu", { method: "POST", body: { receptId: "bestaatniet", dag: week.week } })).status === 404);

  check("van het menu halen werkt", (await vraag(`/weekmenu/${gezet.body.id}`, { method: "DELETE" })).body?.verwijderd === 1);
  check("nog eens weghalen doet niets stuk", (await vraag(`/weekmenu/${gezet.body.id}`, { method: "DELETE" })).body?.verwijderd === 0);

  // --- Kooklog ------------------------------------------------------------

  const genoteerd = await vraag("/kooklog", {
    method: "POST",
    body: { receptId: proef.id, sterren: 5, notitie: "controle", vaker: true, wie: stand.instellingen.personen[0] },
  });
  check("vastleggen dat je kookte werkt", genoteerd.status === 201 && genoteerd.body.sterren === 5, `${genoteerd.status}`);
  check("de naam is tegen het huishouden gehouden", genoteerd.body.wie === (stand.instellingen.personen[0] ?? null));

  const indringer = await vraag("/kooklog", { method: "POST", body: { receptId: proef.id, wie: "Indringer" } });
  check("een onbekende naam wordt genegeerd", indringer.body?.wie === null);
  check("zonder recept wordt het geweigerd", (await vraag("/kooklog", { method: "POST", body: { sterren: 3 } })).status === 400);

  check("een kooklogregel is weer weg te halen", (await vraag(`/kooklog/${genoteerd.body.id}`, { method: "DELETE" })).body?.verwijderd === 1);
  await vraag(`/kooklog/${indringer.body.id}`, { method: "DELETE" });

  // --- Boodschappen en voorstellen ---------------------------------------

  const lijst = (await vraag(`/boodschappen?week=${week.week}`)).body;
  check("de boodschappen komen opgeteld terug", Array.isArray(lijst?.groepen), `${lijst?.aantal} regels`);

  const voorstellen = (await vraag("/voorstellen")).body;
  check("er komen voorstellen met een reden", Array.isArray(voorstellen?.voorstellen) && voorstellen.voorstellen.every((v) => v.reden), `${voorstellen?.voorstellen?.length}`);

  const metIngredient = (await vraag("/voorstellen?ligt=ui")).body;
  check("wat er in huis ligt wordt meegewogen", Array.isArray(metIngredient?.gezochtOp) && metIngredient.gezochtOp.includes("ui"), JSON.stringify(metIngredient?.gezochtOp));

  // --- Inbox --------------------------------------------------------------

  const inbox = (await vraag("/inbox")).body;
  check("de inbox is te lezen", Array.isArray(inbox?.items), `${inbox?.items?.length} open`);
  check("een onbekende opdracht wordt geweigerd",
    inbox.items.length === 0 || (await vraag(`/inbox/${inbox.items[0].id}`, { method: "POST", body: { doe: "dansen" } })).status === 400);
  check("een onbekend inbox-item geeft 404", (await vraag("/inbox/bestaatniet", { method: "POST", body: { doe: "opnieuw" } })).status === 404);

  // --- Delen --------------------------------------------------------------

  check("delen zonder inhoud wordt geweigerd", (await vraag("/delen", { method: "POST", body: {} })).status === 400);

  // --- Synchronisatie -----------------------------------------------------
  //
  // Doet na wat `Synchronisatie.plan` in de app doet: nieuw, gewijzigd en
  // verwijderd volgen alledrie uit één vergelijking met de stand.

  const kast = new Map();
  const plan = (lokaal, server) => ({
    ophalen: server.filter((s) => !lokaal.has(s.id) || new Date(s.bijgewerkt) > new Date(lokaal.get(s.id))).map((s) => s.id),
    wegdoen: [...lokaal.keys()].filter((id) => !server.some((s) => s.id === id)),
  });
  const rondje = async () => {
    const nu = (await vraag("/stand")).body;
    const p = plan(kast, nu.recepten);
    for (const brok of [p.ophalen.slice(0, 50)]) {
      if (brok.length === 0) continue;
      const bundel = (await vraag(`/recepten?ids=${brok.join(",")}`)).body;
      for (const rec of bundel.recepten) kast.set(rec.id, rec.bijgewerkt);
    }
    for (const id of p.wegdoen) kast.delete(id);
    return p;
  };

  let ronde = await rondje();
  check("een verse kast haalt alles op", ronde.ophalen.length === stand.recepten.length && ronde.wegdoen.length === 0);
  ronde = await rondje();
  check("de tweede ronde doet niets", ronde.ophalen.length === 0 && ronde.wegdoen.length === 0);

  await vraag(`/recepten/${proef.id}`, { method: "PATCH", body: { favoriet: !warenFavoriet } });
  ronde = await rondje();
  check("een gewijzigd recept komt opnieuw binnen", ronde.ophalen.length === 1 && ronde.ophalen[0] === proef.id, JSON.stringify(ronde.ophalen));
  await vraag(`/recepten/${proef.id}`, { method: "PATCH", body: { favoriet: warenFavoriet } });
  await rondje();

  kast.set("spook", new Date().toISOString());
  ronde = await rondje();
  check("iets dat daar niet meer staat, verdwijnt hier ook", ronde.wegdoen.includes("spook"));

  // --- Uitslag ------------------------------------------------------------

  console.log(`\n  ${goed} goed, ${stuk.length} fout`);
  for (const naam of stuk) console.log(`    ✗ ${naam}`);
  console.log("");
  process.exit(stuk.length > 0 ? 1 : 0);
}

main().catch((fout) => {
  console.error(`\n  Ging mis: ${fout.message}`);
  console.error("  Draait de server? Standaard wordt http://localhost:3100 geprobeerd.\n");
  process.exit(1);
});
