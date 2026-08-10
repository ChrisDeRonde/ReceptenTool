export type PageMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

export const emptyMeta: PageMeta = {
  title: null,
  description: null,
  imageUrl: null,
  siteName: null,
};

/** Wat een geslaagde strategie oplevert: tekst die naar het model kan. */
export type SourceDocument = {
  /** Welke strategie het opleverde — zichtbaar in de inbox, handig bij debuggen. */
  strategy: string;
  text: string;
  meta: PageMeta;
  canonicalUrl: string | null;
};

/** Eén regel in het spoor dat de orchestrator bijhoudt. */
export type Attempt = {
  strategy: string;
  ok: boolean;
  detail: string;
};

/** Waarmee een provider een tussenstap aan het spoor toevoegt. */
export type Note = (attempt: Attempt) => void;

/**
 * Een bronspecifieke ophaalstrategie.
 *
 * `run` geeft null terug als deze strategie niets bruikbaars vond maar de
 * volgende het nog mag proberen; gooien mag ook — de orchestrator vangt dat
 * op en noteert het in het spoor. Met `note` kan een provider ook eigen
 * tussenstappen vastleggen, zodat een stille fallback niet stil blijft.
 */
export type Provider = {
  name: string;
  canHandle: (url: URL) => boolean;
  run: (
    url: URL,
    sharedText: string,
    note: Note,
  ) => Promise<SourceDocument | null>;
};

/** Genoeg tekst om er plausibel een recept in te vinden. */
export const MIN_USEFUL_CHARS = 200;
