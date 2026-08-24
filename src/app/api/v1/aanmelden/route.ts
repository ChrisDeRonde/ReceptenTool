import { controleerToegang } from "@/lib/api/toegang";
import { API_VERSIE } from "@/lib/api/vorm";
import {
  configuredPassword,
  createSessionCookie,
  forgetAttempts,
  noteFailedAttempt,
  sameSecret,
  throttled,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * De app meldt zich één keer aan en bewaart het token in de Keychain.
 *
 * Hetzelfde wachtwoord en dezelfde handtekening als de website, alleen komt de
 * waarde hier in het antwoord in plaats van in een koekje. Zie
 * `src/lib/api/toegang.ts` voor waarom dat de goede keuze is.
 *
 * Dezelfde rem als het inlogscherm: acht pogingen per tien minuten per IP. Dat
 * die teller gedeeld is met de website is geen toeval maar de bedoeling —
 * anders is de API een omweg om het inlogscherm te omzeilen.
 */
export async function POST(request: Request): Promise<Response> {
  const wachtwoord = configuredPassword();
  if (!wachtwoord) {
    return Response.json(
      { fout: "geen_wachtwoord", uitleg: "APP_PASSWORD ontbreekt op de server." },
      { status: 503 },
    );
  }

  const ip = herkomst(request);
  if (throttled(ip)) {
    return Response.json(
      { fout: "te_vaak", uitleg: "Te veel pogingen. Probeer het over tien minuten weer." },
      { status: 429 },
    );
  }

  const gegeven = await leesWachtwoord(request);
  if (!gegeven || !sameSecret(gegeven, wachtwoord)) {
    noteFailedAttempt(ip);
    return Response.json(
      { fout: "onjuist", uitleg: "Dat wachtwoord klopt niet." },
      { status: 401 },
    );
  }

  forgetAttempts(ip);

  // Dezelfde functie die het koekje maakt: één plek waar de vervaldatum en de
  // handtekening vandaan komen.
  const koekje = await createSessionCookie(wachtwoord);
  return Response.json({
    token: koekje.value,
    vervalt: new Date(Date.now() + koekje.maxAge * 1000).toISOString(),
    versie: API_VERSIE,
  });
}

/** Een bestaand token nakijken zonder iets op te halen. */
export async function GET(request: Request): Promise<Response> {
  const toegang = await controleerToegang(request);
  if (!toegang.ok) return toegang.antwoord;
  return Response.json({ ok: true, versie: API_VERSIE });
}

async function leesWachtwoord(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { wachtwoord?: unknown };
    return typeof body.wachtwoord === "string" && body.wachtwoord.length > 0
      ? body.wachtwoord
      : null;
  } catch {
    return null;
  }
}

/** Achter een reverse proxy is het adres van de verbinding dat van de proxy. */
/**
 * Dezelfde volgorde als `clientIp()` op het inlogscherm, en dat is de bedoeling:
 * de teller is gedeeld, dus hij moet aan beide kanten op hetzelfde adres
 * uitkomen. Ontbrak `x-real-ip` hier, dan viel elke telefoon achter een proxy
 * die alléén die kop zet samen in één `"onbekend"`-bak — acht misslagen van één
 * toestel zetten dan iedereen buiten, terwijl de website vrolijk doortelt.
 */
function herkomst(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return (
    forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "onbekend"
  );
}
