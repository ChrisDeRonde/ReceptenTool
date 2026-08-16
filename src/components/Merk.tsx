/**
 * Het merkteken van Klapper: een kookboek met een koksmuts en een lint.
 *
 * Geen `Icon`, want dat component tekent lijnwerk uit de Hugeicons-set en dit
 * is een silhouet met drie kleuren. Dat verschil is opzet: de rest van de app
 * tekent met dunne contouren — de taal van gereedschap — maar een merk moet je
 * van een afstand herkennen op een vol beginscherm.
 *
 * De kaft volgt `currentColor`. Wat op de kaft wit is — de muts en de
 * paginabalk — krijgt de kleur van het vlak eronder via `--merk-tegen`, zodat
 * het merk overal uit hetzelfde vlak lijkt gesneden.
 */
export function Merk({ size = 28 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <rect x="3.2" y="1.8" width="17.6" height="19.6" rx="2.6" fill="currentColor" />
      <path d="M10 15.6H13.8V23.4L11.9 21.6 10 23.4Z" fill="var(--lint)" />
      <rect x="5.9" y="15.9" width="12.2" height="3" rx="1.3" fill="var(--merk-tegen)" />
      <circle cx="8.9" cy="8.1" r="2.85" fill="var(--merk-tegen)" />
      <circle cx="15.1" cy="8.1" r="2.85" fill="var(--merk-tegen)" />
      <circle cx="12" cy="6.7" r="3.45" fill="var(--merk-tegen)" />
      <rect x="8.7" y="10.1" width="6.6" height="3.3" rx="0.8" fill="var(--merk-tegen)" />
    </svg>
  );
}
