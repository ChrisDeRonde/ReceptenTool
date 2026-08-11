"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { configuredPeople, personCookie } from "@/lib/who";

/**
 * De volgende pagina komt uit de URL, dus die mag alleen binnen deze app
 * wijzen: geen `//ergens-anders`, geen volledige URL.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export async function chooseWho(formData: FormData): Promise<void> {
  const wanted = String(formData.get("naam") ?? "");
  const name = configuredPeople().find((person) => person === wanted);

  // Alleen namen die in APP_USERS staan. Het koekje is aan te passen door wie
  // het krijgt, en die waarde belandt in de database en op het scherm.
  if (name) (await cookies()).set(personCookie(name));

  redirect(safeNext(formData.get("verder")));
}
