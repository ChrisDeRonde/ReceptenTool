/**
 * Wat je ziet terwijl de server de pagina maakt.
 *
 * Elke pagina in deze app is `force-dynamic`: er wordt niets vooruit gebouwd,
 * dus tussen jouw tik en de nieuwe pagina zit een reis naar de server. Zonder
 * een `loading.tsx` blijft in die tijd de óude pagina staan en gebeurt er
 * niets — en dan tik je nog een keer.
 *
 * Deze blokjes tekenen de vorm van wat er komt en niet een tollend rondje.
 * Twee redenen: je ziet meteen wélke pagina er aankomt, en als de echte
 * inhoud arriveert staat hij op dezelfde plek, dus er verspringt niets.
 *
 * Ze zijn puur decoratief. `aria-hidden` erop en één regel tekst ernaast voor
 * wie luistert in plaats van kijkt — een schermlezer heeft niets aan een
 * beschrijving van veertien grijze rechthoeken.
 */

function Doek({ children }: { children: React.ReactNode }) {
  return (
    <main className="skelet-scherm">
      <span className="sr" role="status">
        Bezig met laden…
      </span>
      <div aria-hidden>{children}</div>
    </main>
  );
}

function Kop({ regels = 1 }: { regels?: number }) {
  return (
    <div className="page-head">
      <div className="skelet skelet-kop" />
      {Array.from({ length: regels }, (_, i) => (
        <div key={i} className="skelet skelet-regel" style={{ width: "40%" }} />
      ))}
    </div>
  );
}

function Regels({ aantal, breedtes }: { aantal: number; breedtes?: string[] }) {
  return (
    <div className="skelet-lijst">
      {Array.from({ length: aantal }, (_, i) => (
        <div
          key={i}
          className="skelet skelet-regel"
          style={{ width: breedtes?.[i % breedtes.length] ?? "100%" }}
        />
      ))}
    </div>
  );
}

/** Het receptenraster: twee kolommen met een vlak en een naam eronder. */
export function SkeletRaster({ aantal = 6 }: { aantal?: number }) {
  return (
    <Doek>
      <Kop />
      <div className="skelet skelet-regel" style={{ height: "2.9rem", margin: "1rem 0" }} />
      <div className="grid">
        {Array.from({ length: aantal }, (_, i) => (
          <div key={i}>
            <div className="skelet skelet-blok" />
            <div
              className="skelet skelet-regel"
              style={{ width: i % 2 ? "60%" : "80%", marginTop: "0.6rem" }}
            />
          </div>
        ))}
      </div>
    </Doek>
  );
}

/** Eén recept: foto, titel, knoppenrij, en een lijst eronder. */
export function SkeletRecept() {
  return (
    <Doek>
      <div className="skelet skelet-regel" style={{ width: "35%", marginBottom: "1rem" }} />
      <div className="skelet skelet-hero" />
      <div className="skelet skelet-kop" style={{ height: "2.5rem", width: "70%" }} />
      <div className="skelet skelet-regel" style={{ width: "85%" }} />
      <div className="skelet skelet-regel" style={{ width: "55%", marginBottom: "1.5rem" }} />
      <div className="row">
        <div className="skelet" style={{ height: "2.9rem", width: "8rem" }} />
        <div className="skelet" style={{ height: "2.9rem", width: "2.9rem" }} />
        <div className="skelet" style={{ height: "2.9rem", width: "2.9rem" }} />
      </div>
      <Regels aantal={7} breedtes={["90%", "70%", "80%", "60%", "85%", "65%", "75%"]} />
    </Doek>
  );
}

/** Een lijst met regels: het weekmenu, de boodschappen, de inbox. */
export function SkeletLijst({
  regels = 8,
  kopRegels = 1,
}: {
  regels?: number;
  kopRegels?: number;
}) {
  return (
    <Doek>
      <Kop regels={kopRegels} />
      <Regels
        aantal={regels}
        breedtes={["80%", "55%", "70%", "45%", "85%", "60%", "75%", "50%"]}
      />
    </Doek>
  );
}
