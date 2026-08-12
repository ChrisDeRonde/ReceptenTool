"use client";

/**
 * De laatste vangnet: de hoofdopmaak zelf liep stuk.
 *
 * Dit vervangt het hele document, dus het moet zijn eigen `<html>` en `<body>`
 * meebrengen. Er staat opzettelijk geen enkele import in en de kleuren staan
 * er los in: als dít scherm nodig is, is er iets mis met de laag die de
 * stylesheet en de letters binnenhaalt, en dan wil je niet dat je foutpagina
 * van diezelfde laag afhangt. Dezelfde aanpak als het offlinescherm in
 * `public/sw.js`, en om dezelfde reden.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "1.35rem",
          textAlign: "center",
          background: "#f8f5ef",
          color: "#1e1c18",
          font: '400 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: "22rem" }}>
          <h1 style={{ font: "500 1.5rem/1.2 ui-serif, Georgia, serif", margin: "0 0 0.4rem" }}>
            De app kon niet starten
          </h1>
          <p style={{ margin: "0 0 1.2rem", color: "#6e6760", fontSize: "0.9rem" }}>
            Dit gaat verder dan één pagina. Probeer het opnieuw; blijft het
            hangen, kijk dan in het log van de server.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              fontSize: "0.95rem",
              minHeight: "2.9rem",
              padding: "0 1.2rem",
              cursor: "pointer",
              border: 0,
              borderRadius: 8,
              background: "#477060",
              color: "#fffefa",
            }}
          >
            Opnieuw proberen
          </button>
          {error.digest && (
            <p style={{ margin: "1.2rem 0 0", color: "#6e6760", fontSize: "0.78rem" }}>
              Kenmerk {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
