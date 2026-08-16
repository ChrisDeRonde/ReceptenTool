import { controleerToegang } from "@/lib/api/toegang";
import { fromParam, startOfWeek, toParam } from "@/lib/menu/week";
import { weekShoppingList } from "@/lib/menu/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * De boodschappen van een week, al opgeteld en al ingedeeld.
 *
 * Het optellen gebeurt op de server en niet in de app, en dat is opzet: het is
 * het stuk waar deze app zich mee onderscheidt van een lijstje in Notities, en
 * het hangt aan twee woordenlijsten (eenheden en gangpaden) die af en toe een
 * regel bijkrijgen. Doet de app het zelf, dan moet je hem uitrollen om een
 * vergeten meervoud te repareren.
 *
 * De uitkomst wordt nergens bewaard — hij is een afgeleide van het weekmenu en
 * wordt bij elke aanroep opnieuw berekend. Eén ding minder dat kan verouderen.
 */
export async function GET(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;

  const query = new URL(request.url).searchParams;
  const maandag = startOfWeek(fromParam(query.get("week") ?? undefined));
  const lijst = await weekShoppingList(maandag);

  return Response.json({
    week: toParam(maandag),
    aantal: lijst.count,
    gerechten: lijst.meals,
    groepen: lijst.groups.map((groep) => ({
      gangpad: groep.aisle,
      kop: groep.label,
      regels: groep.lines.map((regel) => ({
        naam: regel.name,
        hoeveelheid: regel.amount,
        voor: regel.from,
      })),
    })),
  });
}
