/**
 * Inloggen met één gedeeld wachtwoord.
 *
 * De API-routes hangen aan `INGEST_TOKEN`, maar de pagina's hingen aan niets —
 * en server actions zijn gewoon POST-endpoints op die pagina's. Wie de URL
 * kende, kon dus `addSource` aanroepen (kost een modelaanroep, dus geld) of
 * `deleteItem`. Dit dicht dat gat voor alles in één keer, via de middleware.
 *
 * Geen accounts en geen sessietabel: er zijn twee gebruikers die elkaar
 * vertrouwen. Het koekje is zelfdragend — vervaldatum plus handtekening — dus
 * er hoeft niets bijgehouden te worden en uitloggen is het koekje weggooien.
 *
 * Alles hier draait op Web Crypto en niet op `node:crypto`, zodat dezelfde
 * code werkt in de middleware (die op de edge-runtime kan draaien) en op de
 * server.
 */

export const SESSION_COOKIE = "sessie";

/** Drie maanden. Lang genoeg om nooit aan inloggen te denken. */
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/** Korter dan dit is geen wachtwoord maar een formaliteit. */
export const MIN_PASSWORD_LENGTH = 8;

export function configuredPassword(): string | null {
  const value = process.env.APP_PASSWORD ?? "";
  return value.length >= MIN_PASSWORD_LENGTH ? value : null;
}

/**
 * De ondertekensleutel is afgeleid van het wachtwoord zelf. Dat scheelt een
 * tweede geheim in `.env`, en het geeft gratis het gedrag dat je wilt:
 * verander je het wachtwoord, dan zijn alle bestaande sessies ongeldig.
 */
async function signingKey(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`receptentool-sessie:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(password: string, payload: string): Promise<string> {
  const key = await signingKey(password);
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Vergelijken zonder er met de looptijd iets over te verraden. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type CookieOptions = {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/** Het koekje voor een geslaagde login: `<vervalt>.<handtekening>`. */
export async function createSessionCookie(
  password: string,
): Promise<CookieOptions> {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const signature = await sign(password, String(expires));

  return {
    name: SESSION_COOKIE,
    value: `${expires}.${signature}`,
    httpOnly: true,
    sameSite: "lax",
    // Op http (thuis, of tijdens ontwikkelen) zou een `secure`-koekje nooit
    // verstuurd worden en kwam je nooit voorbij het inlogscherm.
    secure: (process.env.APP_BASE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function clearedSessionCookie(): CookieOptions {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_BASE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 0,
  };
}

export async function isValidSession(
  value: string | undefined,
  password: string,
): Promise<boolean> {
  if (!value) return false;

  const split = value.lastIndexOf(".");
  if (split <= 0) return false;

  const expires = Number(value.slice(0, split));
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;

  const expected = await sign(password, value.slice(0, split));
  return sameSecret(value.slice(split + 1), expected);
}

/**
 * Wachtwoorden vergelijken kost hier niets, dus de rem zit op het aantal
 * pogingen per IP. Een gedeeld wachtwoord van acht tekens is te raden als je
 * duizenden keren per minuut mag proberen; met deze rem duurt dat jaren.
 *
 * In het geheugen van het proces, want er is één proces. Na een herstart is de
 * teller leeg — dat is voor deze schaal een prima ruil tegen een tabel.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function throttled(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (entry.until < Date.now()) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function noteFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.until < now) {
    attempts.set(ip, { count: 1, until: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function forgetAttempts(ip: string): void {
  attempts.delete(ip);
}
