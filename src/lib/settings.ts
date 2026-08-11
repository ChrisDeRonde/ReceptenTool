import { prisma } from "@/lib/db";
import { schoon } from "@/lib/people";
import { MAX_SERVINGS } from "@/lib/recipe/scale";

/**
 * Instellingen die je vanuit de app kunt wijzigen.
 *
 * De scheiding is bewust: **geheimen staan in `.env`** en zijn hier alleen te
 * lezen, niet te zetten. Een webformulier dat het wachtwoord of de API-sleutel
 * kan wijzigen is een webformulier waarmee iemand die binnen is jou eruit kan
 * zetten. Alles wat gewoon een voorkeur is — hoeveel mensen er meestal
 * meeëten, hoe jullie heten — staat in de database, want dat wil je kunnen
 * bijstellen zonder een bestand te bewerken en te herstarten.
 */

export const HUISHOUDEN = "huishouden";
export const PERSONEN = "personen";

/** Twee mensen: het huishouden waar deze app voor gebouwd is. */
export const HUISHOUDEN_STANDAARD = 2;

/**
 * Meer dan dit is catering; dit voorkomt ook onzin in de omrekening.
 *
 * Dezelfde grens als waar een recept naartoe schaalt: het huishouden ís de
 * standaard voor het aantal porties, dus twee verschillende plafonds zouden
 * betekenen dat je een huishouden kunt opgeven waar geen recept voor uit te
 * rekenen valt.
 */
export const HUISHOUDEN_MAX = MAX_SERVINGS;

export async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function writeSetting(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await prisma.setting.deleteMany({ where: { key } });
    return;
  }
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * Voor hoeveel mensen kook je normaal?
 *
 * Dit is de standaard voor een gerecht op het weekmenu, en daarmee ook voor de
 * boodschappenlijst. Zonder deze instelling gebruikten we het aantal porties
 * dat toevallig in de bron stond — dat is een eigenschap van het recept, niet
 * van jullie.
 */
export async function huishouden(): Promise<number> {
  const waarde = Number.parseInt((await readSetting(HUISHOUDEN)) ?? "", 10);
  if (!Number.isInteger(waarde) || waarde < 1) return HUISHOUDEN_STANDAARD;
  return Math.min(waarde, HUISHOUDEN_MAX);
}

/**
 * Wie de app gebruiken.
 *
 * Eerst de instelling, dan `APP_USERS` uit de omgeving. Die volgorde zodat een
 * bestaande opzet blijft werken zoals hij werkte, en je hem kunt overnemen in
 * de app zodra je daar iets wijzigt.
 */
export async function people(): Promise<string[]> {
  const uitDatabase = await readSetting(PERSONEN);
  return schoon(uitDatabase ?? process.env.APP_USERS ?? "");
}

/** Waar de namen vandaan komen — de instellingenpagina laat dat zien. */
export async function peopleSource(): Promise<"instelling" | "omgeving" | "geen"> {
  if ((await readSetting(PERSONEN)) !== null) return "instelling";
  return schoon(process.env.APP_USERS ?? "").length > 0 ? "omgeving" : "geen";
}

