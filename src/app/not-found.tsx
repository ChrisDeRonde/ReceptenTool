import { Misgegaan } from "@/components/Misgegaan";

/** Een adres dat nergens op slaat. */
export default function NietGevonden() {
  return (
    <Misgegaan
      titel="Deze pagina bestaat niet"
      uitleg="Er staat niets op dit adres. Waarschijnlijk een typefout, of een link naar iets dat er niet meer is."
    />
  );
}
