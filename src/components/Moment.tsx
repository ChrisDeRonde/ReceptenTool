import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/**
 * Wanneer iets was.
 *
 * Dit bestaat omdat een datum midden in een zin geen datum meer lijkt. "Sanne
 * heeft dit recept intussen bijgewerkt, vandaag 13:52" loopt in elkaar over: je
 * leest één lange zin en moet zelf uitzoeken waar de mededeling ophoudt en het
 * tijdstip begint. Met een kalendertje ervoor is het één blik.
 *
 * De regel in de hele app:
 *
 *   **klok = hoe lang iets duurt** — "30 min" op een tegel, "8 min" bij een
 *   stap, de timer in de kookmodus.
 *   **kalender = wanneer iets was** — "vandaag 13:52", "9 aug", "2 dagen
 *   geleden".
 *
 * Zonder dat onderscheid zou "30 min" er hetzelfde uitzien als "3 dagen
 * geleden", en dat zijn twee heel verschillende dingen om te weten.
 *
 * Een kalender die niet die van de tabbalk is: dezelfde tekening zou lezen als
 * een link naar het weekmenu.
 */
export function Moment({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`moment ${className}`.trim()}>
      <Icon icon={icons.date} size={13} />
      {children}
    </span>
  );
}
