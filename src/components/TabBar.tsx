"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Het zwevende tabblok onderaan. Client component omdat het moet weten waar je
 * bent; de rest van de app-chrome blijft server-side.
 */
export function TabBar({ openItems }: { openItems: number }) {
  const pathname = usePathname();
  const onInbox = pathname.startsWith("/inbox");

  return (
    <nav className="dock" aria-label="Hoofdnavigatie">
      <Link href="/" className={onInbox ? "" : "on"}>
        Recepten
      </Link>
      <Link href="/inbox" className={onInbox ? "on" : ""}>
        Inbox
        {openItems > 0 && <span className="count">{openItems}</span>}
      </Link>
    </nav>
  );
}
