"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { detectSourceType } from "@/lib/extract";
import { bedenkIdeeen, leesbareFout, type Ideeenblad } from "@/lib/menu/ideeen";
import { processShareItem } from "@/lib/pipeline";
import {
  IDEEEN,
  huishouden,
  ideeenblad,
  voorkeuren,
  writeSetting,
} from "@/lib/settings";
import { eisen } from "@/lib/voorkeuren";
import { currentPerson } from "@/lib/who";

/** Hoeveel keer koken er meegaat in de vraag. */
const KOOKLOG_TERUG = 40;

/**
 * Nieuwe ideeën ophalen.
 *
 * De uitkomst gaat in de instellingen en niet in het geheugen van de pagina:
 * dit is de enige plek in de app die een modelaanroep doet zonder dat er iets
 * binnenkwam om te verwerken, en die wil je niet per ongeluk twee keer betalen
 * omdat iemand vernieuwt. Zo staat er bovendien iets als je morgen terugkomt.
 */
export async function haalIdeeen(): Promise<void> {
  const [logs, titels, wensen, thuis] = await Promise.all([
    prisma.cookLog.findMany({
      orderBy: [{ cookedAt: "desc" }, { createdAt: "desc" }],
      take: KOOKLOG_TERUG,
      select: {
        cookedAt: true,
        rating: true,
        again: true,
        who: true,
        recipe: { select: { title: true, cuisine: true } },
      },
    }),
    prisma.recipe.findMany({ select: { title: true }, orderBy: { title: "asc" } }),
    voorkeuren(),
    huishouden(),
  ]);

  const gevraagd = eisen(wensen);
  const vorige = await ideeenblad();

  let blad: Ideeenblad;
  try {
    const ideeen = await bedenkIdeeen({
      gemaakt: logs.map((log) => ({
        title: log.recipe.title,
        cuisine: log.recipe.cuisine,
        cookedAt: log.cookedAt,
        rating: log.rating,
        again: log.again,
        who: log.who,
      })),
      bekend: titels.map((rij) => rij.title),
      dieet: gevraagd.dieet,
      afkeer: gevraagd.afkeer,
      huishouden: thuis,
      vandaag: new Date(),
    });
    blad = { opgehaald: new Date().toISOString(), ideeen };
  } catch (fout) {
    // De vorige oogst blijft staan: een mislukte poging hoort niet ook nog eens
    // op te ruimen wat je gisteren kreeg.
    blad = {
      opgehaald: vorige?.opgehaald ?? new Date().toISOString(),
      ideeen: vorige?.ideeen ?? [],
      fout: leesbareFout(fout),
    };
  }

  await writeSetting(IDEEEN, JSON.stringify(blad));
  revalidatePath("/weekmenu/ideeen");
}

/**
 * Een idee met een link naar de inbox sturen.
 *
 * Vanaf hier is het een gewone import: dezelfde molen als wanneer je vanuit
 * Safari deelt. Er komt dus geen verzonnen recept in de collectie — het recept
 * komt van de pagina waar het model naartoe wees.
 */
export async function ideeNaarInbox(formData: FormData): Promise<void> {
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return;

  const item = await prisma.shareItem.create({
    data: {
      status: "pending",
      sourceType: detectSourceType(url),
      sourceUrl: url,
      sharedText: String(formData.get("gerecht") ?? "").trim() || null,
      sharedBy: await currentPerson(),
    },
  });

  await processShareItem(item.id);
  revalidatePath("/inbox");
  revalidatePath("/");
  redirect(`/inbox#${item.id}`);
}
