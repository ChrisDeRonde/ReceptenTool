"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/**
 * De lijst het toestel uit krijgen.
 *
 * Twee knoppen, want ze gaan naar verschillende plekken. **Kopiëren** levert
 * kale regels op — één product per regel, want dat is wat de app van de
 * supermarkt aankan als je erin plakt. **Delen** opent de iOS-share sheet met
 * de nette versie mét kopjes, voor een appje naar de ander.
 *
 * Client component omdat klembord en share sheet alleen vanuit een echte tik
 * mogen; de server kan dat niet voor je doen.
 */
export function CopyList({ plain, pretty }: { plain: string; pretty: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Zonder https of zonder toestemming werkt het klembord niet. Dan tonen
      // we de tekst maar gewoon, dan kun je hem zelf selecteren.
      setFailed(true);
    }
  };

  const share = async () => {
    const share = navigator.share;
    if (!share) {
      await copy();
      return;
    }
    try {
      await share.call(navigator, { title: "Boodschappen", text: pretty });
    } catch {
      // Geannuleerd of geweigerd; niets aan de hand.
    }
  };

  return (
    <div className="copy-list">
      <div className="row">
        <button type="button" onClick={copy}>
          <Icon icon={copied ? icons.done : icons.copy} size={17} />
          {copied ? "Gekopieerd" : "Kopieer lijst"}
        </button>
        <button type="button" className="secondary" onClick={share}>
          <Icon icon={icons.share} size={17} />
          Delen
        </button>
      </div>

      {failed && (
        <>
          <p className="form-error">
            Het klembord is hier niet beschikbaar — dat vraagt https. Selecteer
            de tekst hieronder en kopieer hem zelf.
          </p>
          <textarea readOnly rows={10} value={plain} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
    </div>
  );
}
