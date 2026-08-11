"use server";

import { revalidatePath } from "next/cache";
import { schoon } from "@/lib/people";
import {
  HUISHOUDEN,
  HUISHOUDEN_MAX,
  PERSONEN,
  writeSetting,
} from "@/lib/settings";

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

  revalidatePath("/instellingen");
  revalidatePath("/weekmenu");
  revalidatePath("/inbox");
  revalidatePath("/ik");
}
