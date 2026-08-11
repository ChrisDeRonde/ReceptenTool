"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/**
 * Zoekveld boven het overzicht.
 *
 * Het is een echt formulier: zonder JavaScript tik je op Enter en werkt het.
 * Mét JavaScript zoekt hij mee terwijl je typt, met een korte pauze ertussen —
 * anders vuurt elke aanslag een verzoek af.
 *
 * De zoekterm staat in de URL en niet in de component, zodat een gevonden
 * selectie deelbaar is en een refresh overleeft. De bestaande filters blijven
 * daarbij staan.
 */
export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const first = useRef(true);

  // Als je via een link ergens anders heen gaat, moet het veld meebewegen.
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    // Niet meteen bij het monteren zoeken; dan spring je weg van de URL die
    // je net geopend hebt.
    if (first.current) {
      first.current = false;
      return;
    }
    if (value === initial) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, initial, params, router]);

  return (
    <form className="search" action="/" role="search">
      {/* De bestaande filters meesturen, anders vallen ze weg als je zonder
          JavaScript op Enter drukt. */}
      {["maaltijd", "keuken"].map((key) => {
        const current = params.get(key);
        return current ? (
          <input key={key} type="hidden" name={key} value={current} />
        ) : null;
      })}

      <span className="search-icon" aria-hidden>
        <Icon icon={icons.search} size={18} />
      </span>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Zoek op naam of ingrediënt…"
        autoComplete="off"
        enterKeyHint="search"
        aria-label="Zoeken in recepten"
      />
      {value && (
        <button
          type="button"
          className="quiet"
          onClick={() => setValue("")}
          aria-label="Zoekterm wissen"
        >
          <Icon icon={icons.close} size={16} />
        </button>
      )}
    </form>
  );
}
