"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/**
 * De tabbalk onderaan. Client component omdat het moet weten waar je bent; de
 * rest van de app-chrome blijft server-side.
 */
export function TabBar({ openItems }: { openItems: number }) {
  const pathname = usePathname();
  const on = (prefix: string) =>
    prefix === "/" ? pathname === "/" || pathname.startsWith("/recepten") : pathname.startsWith(prefix);

  return (
    <nav className="dock" aria-label="Hoofdnavigatie">
      <Link href="/" className={on("/") ? "on" : ""}>
        <Icon icon={icons.recipes} size={22} />
        Recepten
      </Link>
      <Link href="/weekmenu" className={on("/weekmenu") ? "on" : ""}>
        <Icon icon={icons.menu} size={22} />
        Weekmenu
      </Link>
      <Link href="/inbox" className={on("/inbox") ? "on" : ""}>
        <Icon icon={icons.inbox} size={22} />
        Inbox
        {openItems > 0 && <span className="count">{openItems}</span>}
      </Link>
    </nav>
  );
}
