"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearedSessionCookie,
  configuredPassword,
  createSessionCookie,
  forgetAttempts,
  noteFailedAttempt,
  sameSecret,
  throttled,
} from "@/lib/session";

/**
 * Achter welk IP zit deze poging? Alleen om te tellen, niet om te vertrouwen —
 * de header is te vervalsen, maar dan verspreidt een aanvaller zijn pogingen
 * over verzonnen adressen en heeft hij er zelf niets aan.
 */
async function clientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || list.get("x-real-ip") || "onbekend";
}

/**
 * De volgende pagina komt uit de URL, dus die mag alleen binnen deze app
 * wijzen: geen `//evil.example` en geen volledige URL.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export async function login(formData: FormData): Promise<void> {
  const expected = configuredPassword();
  if (!expected) redirect("/login?fout=config");

  const ip = await clientIp();
  if (throttled(ip)) redirect("/login?fout=teveel");

  const given = String(formData.get("wachtwoord") ?? "");
  if (!sameSecret(given, expected)) {
    noteFailedAttempt(ip);
    redirect(`/login?fout=1&verder=${encodeURIComponent(safeNext(formData.get("verder")))}`);
  }

  forgetAttempts(ip);
  const cookie = await createSessionCookie(expected);
  (await cookies()).set(cookie);

  redirect(safeNext(formData.get("verder")));
}

export async function logout(): Promise<void> {
  (await cookies()).set(clearedSessionCookie());
  redirect("/login");
}
