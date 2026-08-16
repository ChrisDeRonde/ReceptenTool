"use server";

import { revalidatePath } from "next/cache";
import { schoon } from "@/lib/people";
import { normalizeDiets } from "@/lib/recipe/categories";
import {
  HUISHOUDEN,
  HUISHOUDEN_MAX,
  PERSONEN,
  VOORKEUREN,
  writeSetting,
} from "@/lib/settings";
import { schoonAfkeer, schrijfVoorkeuren, type Voorkeuren } from "@/lib/voorkeuren";

/**
 * Instellingen opslaan.
 *
 * Alleen wat een voorkeur is. Geheimen staan in `.env` en zijn hier bewust niet
 * te wijzigen: een formulier dat het wachtwoord kan aanpassen is een formulier
 * waarmee iemand die binnen is jou eruit kan zetten.
 */
export async function saveSettings(formData: FormData): Promise<void> {
  const aantal = Number.parseInt(String(formData.get("huishouden") ?? ""), 10);
  if (Number.isInteger(aantal) && aantal >= 1) {
    await writeSetting(HUISHOUDEN, String(Math.min(aantal, HUISHOUDEN_MAX)));
  }

  const namen = schoon(String(formData.get("personen") ?? ""));
  // Leeg opslaan mag: dan is het naamkaartje uit. Terugvallen op APP_USERS zou
  // hier verkeerd zijn — dan lijkt het alsof je wijziging niet is aangekomen.
  await writeSetting(PERSONEN, namen.join(", "));

  // De velden heten `dieet:Chris` en `afkeer:Chris`. Ze horen bij de namen
  // zoals ze wáren toen het formulier werd getekend; hernoem je iemand in
  // dezelfde beurt, dan valt zijn voorkeur weg omdat de nieuwe naam nog geen
  // velden heeft. Dat is de eerlijke uitkomst: de app kan niet weten of "Sanne"
  // en "San" dezelfde persoon zijn.
  const voorkeuren: Voorkeuren = {};
  for (const naam of namen) {
    const dieet = normalizeDiets(
      formData.getAll(`dieet:${naam}`).filter((value) => typeof value === "string"),
    );
    const afkeer = schoonAfkeer(String(formData.get(`afkeer:${naam}`) ?? ""));
    if (dieet.length > 0 || afkeer.length > 0) voorkeuren[naam] = { dieet, afkeer };
  }
  await writeSetting(VOORKEUREN, schrijfVoorkeuren(voorkeuren));

  revalidatePath("/instellingen");
  revalidatePath("/weekmenu");
  revalidatePath("/inbox");
  revalidatePath("/ik");
  revalidatePath("/", "layout");
}
