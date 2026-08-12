"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { bekendeNaam } from "@/lib/people";
import { personCookie } from "@/lib/who";
import { people } from "@/lib/settings";

/**
 * De volgende pagina komt uit de URL, dus die mag alleen binnen deze app
 * wijzen: geen `//ergens-anders`, geen volledige URL.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export async function chooseWho(formData: FormData): Promise<void> {
  const name = bekendeNaam(formData.get("naam"), await people());
  if (name) (await cookies()).set(personCookie(name));

  redirect(safeNext(formData.get("verder")));
}
