"use client";

import { useEffect } from "react";

/**
 * De service worker aanmelden.
 *
 * Meer is het niet: het echte werk staat in `public/sw.js`. Registreren doen
 * we ná het laden, zodat het niet met de eerste weergave concurreert — deze
 * app is server-gerenderd en die eerste tekening is het enige wat telt.
 *
 * Draait de app straks in een Capacitor-schil, dan verandert hier niets: die
 * laadt dezelfde origin en dus dezelfde worker.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const aanmelden = () => {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // Uitgezet in de browser, of geen https. De app werkt dan gewoon
        // zonder; alleen offline valt weg.
      });
    };

    if (document.readyState === "complete") aanmelden();
    else window.addEventListener("load", aanmelden, { once: true });

    return () => window.removeEventListener("load", aanmelden);
  }, []);

  return null;
}
