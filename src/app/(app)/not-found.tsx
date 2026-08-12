import { Misgegaan } from "@/components/Misgegaan";

/**
 * Een recept dat er niet (meer) is. Gebeurt als je een oude link opent, of als
 * de ander het net weggooide terwijl jij ernaar keek.
 */
export default function NietGevonden() {
  return (
    <Misgegaan
      titel="Dit recept is er niet"
      uitleg="Misschien is het weggegooid, of klopt er iets niet aan de link. In het overzicht staat alles wat er wél is."
    />
  );
}
