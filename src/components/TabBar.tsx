"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/**
 * De tabbalk onderaan. Client component omdat het moet weten waar je bent; de
 * rest van de app-chrome blijft server-side.
 */
export function TabBar({
  openItems,
  who,
}: {
  openItems: number;
  /** De gekozen naam, als er namen zijn ingesteld. */
  who: string | null;
}) {
  const pathname = usePathname();
  const on = (prefix: string) =>
    prefix === "/" ? pathname === "/" || pathname.startsWith("/recepten") : pathname.startsWith(prefix);

  // Kleur alleen is voor een schermlezer geen "je bent hier"; aria-current is
  // dat wel. Ze horen bij elkaar, dus komen ze uit dezelfde bron.
  const tab = (actief: boolean) => ({
    className: actief ? "on" : "",
    "aria-current": actief ? ("page" as const) : undefined,
  });

  return (
    <nav className="dock" aria-label="Hoofdnavigatie">
      <Link href="/" {...tab(on("/"))}>
        <Icon icon={icons.recipes} size={22} />
        Recepten
      </Link>
      <Link href="/weekmenu" {...tab(on("/weekmenu"))}>
        <Icon icon={icons.menu} size={22} />
        Weekmenu
      </Link>
      <Link href="/inbox" {...tab(on("/inbox"))}>
        <Icon icon={icons.inbox} size={22} />
        Inbox
        {openItems > 0 && (
          <span className="count">
            {openItems}
            {/* Anders leest een schermlezer alleen "Inbox 1" voor. */}
            <span className="sr"> nog te verwerken</span>
          </span>
        )}
      </Link>
      <Link href="/ik" {...tab(on("/ik") || on("/instellingen"))}>
        {/* Het rondje in plaats van een icoon zodra je een naam hebt: dan zie
            je in één oogopslag onder wiens naam je bezig bent. */}
        {who ? (
          <span className="dock-avatar">{who.slice(0, 1).toLocaleUpperCase("nl-NL")}</span>
        ) : (
          <Icon icon={icons.people} size={22} />
        )}
        {who ?? "Ik"}
      </Link>
    </nav>
  );
}
