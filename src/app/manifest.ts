import type { MetadataRoute } from "next";

/**
 * Wat iOS en Android nodig hebben om dit als app te behandelen.
 *
 * Als route en niet als bestand in `public/`, zodat de kleuren en de naam op
 * één plek staan en meeveranderen met de rest. De middleware laat
 * `/manifest.webmanifest` er ongemoeid langs: er staat niets persoonlijks in,
 * en het inlogscherm heeft hem zelf nodig.
 *
 * Deze waarden zijn ook wat een Capacitor-schil straks overneemt — naam,
 * kleuren en iconen hoeven dan niet opnieuw bedacht te worden.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klapper",
    short_name: "Klapper",
    description: "Recepten van Instagram, AH en websites, netjes opgeslagen.",
    lang: "nl",
    // Volledig scherm zonder Safari-balk. Precies wat de schil straks ook doet.
    display: "standalone",
    start_url: "/",
    scope: "/",
    // Geen `orientation: "portrait"`. Een app mag de stand van het scherm niet
    // vastzetten (WCAG 1.3.4): wie zijn telefoon in een houder heeft liggen, of
    // hem vanwege een beperking altijd liggend gebruikt, kan er dan niet bij.
    // De opmaak is toch al vloeiend, dus liggend werkt gewoon.
    // Hetzelfde papier als in globals.css, zodat het opstartscherm niet flitst.
    background_color: "#f8f5ef",
    theme_color: "#f8f5ef",
    icons: [
      { src: "/icoon/icoon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icoon/icoon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        // Android knipt hier zelf een vorm uit; deze heeft daarom meer lucht.
        src: "/icoon/icoon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Lang indrukken op het icoon. Twee dingen die je vanaf je beginscherm wilt.
    shortcuts: [
      { name: "Weekmenu", url: "/weekmenu" },
      { name: "Recept toevoegen", url: "/inbox" },
    ],
  };
}
