"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * De tabbalk onderaan. Client component omdat het moet weten waar je bent; de
 * rest van de app-chrome blijft server-side.
 */
export function TabBar({ openItems }: { openItems: number }) {
  const pathname = usePathname();
  const onInbox = pathname.startsWith("/inbox");

  return (
    <nav className="dock" aria-label="Hoofdnavigatie">
      <Link href="/" className={onInbox ? "" : "on"}>
        <BookIcon />
        Recepten
      </Link>
      <Link href="/inbox" className={onInbox ? "on" : ""}>
        <InboxIcon />
        Inbox
        {openItems > 0 && <span className="count">{openItems}</span>}
      </Link>
    </nav>
  );
}

/* Dunne lijniconen, 20px, zonder vulling — dezelfde toon als de rest. */

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z" />
      <path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H19v3H5.5A1.5 1.5 0 0 1 4 19.5z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M3 13h5l1.5 3h5L16 13h5" />
      <path d="M5.5 4h13l2.5 9v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />
    </svg>
  );
}
