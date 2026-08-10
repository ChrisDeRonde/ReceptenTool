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
  listItems,
}: {
  openItems: number;
  listItems: number;
}) {
  const pathname = usePathname();
  const on = (prefix: string) =>
    prefix === "/" ? pathname === "/" || pathname.startsWith("/recepten") : pathname.startsWith(prefix);

  return (
    <nav className="dock" aria-label="Hoofdnavigatie">
      <Link href="/" className={on("/") ? "on" : ""}>
        <Icon icon={icons.recipes} size={22} />
        Recepten
      </Link>
      <Link href="/lijst" className={on("/lijst") ? "on" : ""}>
        <Icon icon={icons.basket} size={22} />
        Lijst
        {listItems > 0 && <span className="count">{listItems}</span>}
      </Link>
      <Link href="/inbox" className={on("/inbox") ? "on" : ""}>
        <Icon icon={icons.inbox} size={22} />
        Inbox
        {openItems > 0 && <span className="count">{openItems}</span>}
      </Link>
    </nav>
  );
}
