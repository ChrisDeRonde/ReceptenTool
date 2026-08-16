import { configuredPassword, isValidSession } from "@/lib/session";

/**
 * Het slot op `/api/v1`.
 *
 * De web-UI hangt aan een koekje, de deelextensie aan `INGEST_TOKEN`. Een
 * native app past bij geen van beide: een koekje is niets waard buiten een
 * browser, en `INGEST_TOKEN` is bedoeld voor iets dat alléén mag toevoegen —
 * dat zou hier ineens ook mogen lezen en verwijderen.
 *
 * Dus een derde weg, maar zonder een derde geheim: de app meldt zich aan met
 * hetzelfde wachtwoord als de website en krijgt exact dezelfde zelfdragende
 * sessiewaarde terug, alleen als `Authorization: Bearer` in plaats van als
 * koekje. Daarmee erft dit slot alles wat er al goed aan was — de handtekening
 * hangt aan het wachtwoord, dus het wachtwoord veranderen zet elke telefoon
 * eruit, en er is nog steeds geen sessietabel om bij te houden.
 */

export type Toegang = { ok: true } | { ok: false; antwoord: Response };

const GEWEIGERD = {
  fout: "niet_aangemeld",
  uitleg: "Meld je aan via POST /api/v1/aanmelden en stuur het token mee als Bearer.",
} as const;

export async function controleerToegang(request: Request): Promise<Toegang> {
  const wachtwoord = configuredPassword();
  if (!wachtwoord) {
    // Geen wachtwoord ingesteld betekent hier niet "iedereen mag": een open
    // API is erger dan een app die niet werkt.
    return {
      ok: false,
      antwoord: Response.json(
        { fout: "geen_wachtwoord", uitleg: "APP_PASSWORD ontbreekt op de server." },
        { status: 503 },
      ),
    };
  }

  const kop = request.headers.get("authorization") ?? "";
  const token = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";

  if (!(await isValidSession(token, wachtwoord))) {
    return { ok: false, antwoord: Response.json(GEWEIGERD, { status: 401 }) };
  }
  return { ok: true };
}
