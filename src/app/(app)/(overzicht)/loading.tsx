import { SkeletRaster } from "@/components/Skelet";

/**
 * Het wachtscherm van het overzicht.
 *
 * Dit bestand staat in een routegroep — de haakjes in `(overzicht)` doen niets
 * met de URL — en niet één map hoger. Dat is met opzet: een `loading.tsx` geldt
 * ook voor alles wat eronder valt, en één map hoger zou hij dus ook over
 * `/recepten/[id]` heen hangen. Zodra een bestemming eerst in zo'n wachtscherm
 * valt, ziet React geen paar meer tussen de foto op de tegel en de foto op de
 * receptpagina, en vervalt het meegroeien. Zo houden we allebei.
 */
export default function Laden() {
  return <SkeletRaster />;
}
