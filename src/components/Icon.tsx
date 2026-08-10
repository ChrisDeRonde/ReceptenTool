import type { SVGProps } from "react";

/**
 * Eén icoon uit de Hugeicons-set.
 *
 * De pakketten leveren de iconen als data (`[tag, attributen][]`), niet als
 * component. We tekenen ze hier zelf in plaats van `@hugeicons/react` te
 * gebruiken: dat is een `forwardRef`-component en die kan niet in een server
 * component, terwijl vrijwel al onze pagina's dat wél zijn. Zo blijft er ook
 * geen JavaScript voor iconen in de bundel achter.
 *
 * Wil je later de Pro-set gebruiken: die levert dezelfde datavorm, dus alleen
 * de import in `icons.ts` verandert.
 */
export type IconData = readonly (readonly [
  string,
  { readonly [key: string]: string | number },
])[];

export function Icon({
  icon,
  size = 20,
  strokeWidth = 1.5,
  ...rest
}: {
  icon: IconData;
  size?: number;
  strokeWidth?: number;
} & Omit<SVGProps<SVGSVGElement>, "children">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      // De set tekent met currentColor; kleur zetten doe je dus in CSS.
      color="currentColor"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {icon.map(([tag, attrs], index) => {
        const Tag = tag as keyof React.JSX.IntrinsicElements;
        return (
          <Tag
            key={index}
            {...attrs}
            {...("strokeWidth" in attrs ? { strokeWidth } : {})}
          />
        );
      })}
    </svg>
  );
}
