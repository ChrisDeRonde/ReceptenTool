import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, configuredPassword, isValidSession } from "@/lib/session";

/**
 * Eén poort voor de hele app.
 *
 * Het alternatief — in elke pagina en elke server action een controle — is de
 * variant waar je er vroeg of laat één vergeet, en juist de vergeten route is
 * dan de dure (`addSource` kost een modelaanroep) of de destructieve
 * (`deleteItem`). Hier komt niets langs zonder koekje.
 */

/**
 * Deze hebben hun eigen slot en moeten hier langs kunnen, anders krijgt een
 * app een inlogpagina terug in plaats van een nette 401.
 *
 *  - `/api/share`, `/api/items`, `/api/extract-preview` hangen aan
 *    `INGEST_TOKEN`, gecontroleerd in de route zelf.
 *  - `/api/v1` hangt aan een Bearer-token dat dezelfde handtekening draagt als
 *    het koekje hieronder; zie `src/lib/api/toegang.ts`. Elke route daar
 *    begint met `controleerToegang`, en `/api/v1/aanmelden` is de enige die
 *    bewust open staat — dat is de deur zelf, met dezelfde pogingenrem als het
 *    inlogscherm.
 */
const TOKEN_ROUTES = [
  "/api/share",
  "/api/items",
  "/api/extract-preview",
  "/api/v1",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || TOKEN_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const password = configuredPassword();
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (password && (await isValidSession(cookie, password))) {
    return NextResponse.next();
  }

  // Een server action of een fetch heeft niets aan een inlogpagina als
  // antwoord; die krijgt een status waar de aanroeper iets mee kan.
  if (request.method !== "GET") {
    return new NextResponse("Niet ingelogd", { status: 401 });
  }

  const login = new URL("/login", request.url);
  const back = pathname + request.nextUrl.search;
  if (back !== "/") login.searchParams.set("verder", back);
  return NextResponse.redirect(login);
}

export const config = {
  // Alles behalve wat de browser sowieso nodig heeft om de inlogpagina te
  // kunnen tonen: de bundel, de fonts en het icoon. Plus twee dingen die bij
  // "zet op beginscherm" horen — het manifest en de service worker. Daar staat
  // niets persoonlijks in, en een inlogpagina in plaats van een script zou het
  // toestel de worker laten afwijzen.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|icoon/|sw.js|manifest.webmanifest|.*\\.(?:png|jpe?g|svg|webp|ico|woff2?)$).*)",
  ],
};
