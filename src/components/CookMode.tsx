"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useVoorbijGescrold } from "@/components/Vastkop";
import { icons } from "@/lib/icons";
import { formatAmount, formatClock } from "@/lib/recipe/format";
import { ingredientsForStep, type Recipe } from "@/lib/recipe/schema";
import { opsomming } from "@/lib/tijd";

type TimerState = {
  /** Tijdstip waarop hij afgaat, als hij loopt. */
  endsAt: number | null;
  /** Resterende seconden; leidend zodra hij gepauzeerd is. */
  remaining: number;
  done: boolean;
};

export function CookMode({
  recipe,
  baseServings,
  backHref,
}: {
  recipe: Recipe;
  /** Het aantal personen waar de bron van uitging, vóór omrekenen. */
  baseServings: number | null;
  /** Terug naar het recept, met het gekozen aantal personen erin. */
  backHref: string;
}) {
  const [current, setCurrent] = useState(0);
  const [timers, setTimers] = useState<Record<number, TimerState>>({});
  const [now, setNow] = useState(() => Date.now());
  const [showAll, setShowAll] = useState(false);
  const [titelGrens, voorbijTitel] = useVoorbijGescrold();
  // Welke kant je op ging. Vooruit en terug zagen er precies hetzelfde uit:
  // de inhoud verwisselde en verder niets. Nu schuift de nieuwe stap van de
  // kant waar hij vandaan komt, en dat is het verschil tussen "er gebeurde
  // iets" en "ik ben een stap verder".
  const [richting, setRichting] = useState<"vooruit" | "terug">("vooruit");
  // Wat er al in de pan ligt, per stap. Zie de opmerking bij de lijst hieronder
  // voor waarom dit niets bewaart buiten deze pagina.
  const [gepakt, setGepakt] = useState<Set<string>>(new Set());

  const scaled = baseServings !== null && recipe.servings !== baseServings;
  const step = recipe.steps[current];
  const stepIngredients = step ? ingredientsForStep(recipe, step) : [];
  const isLast = current === recipe.steps.length - 1;

  const schermBlijftAan = useKeepScreenAwake();
  const alarm = useAlarm();

  // Een nieuwe stap begin je bovenaan. Zonder dit blijft de pagina staan waar
  // je hem liet en land je middenin de tekst van de volgende stap — merkbaar
  // sinds een stap met ingrediënten en een tip langer is dan het scherm.
  const eersteRender = useRef(true);
  useEffect(() => {
    if (eersteRender.current) {
      eersteRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [current]);

  // Eén tik per seconde voor alle lopende timers samen.
  const hasRunning = Object.values(timers).some((t) => t.endsAt !== null);
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [hasRunning]);

  // Afgelopen timers markeren en laten afgaan.
  useEffect(() => {
    const finished = Object.entries(timers).filter(
      ([, t]) => t.endsAt !== null && t.endsAt <= now && !t.done,
    );
    if (finished.length === 0) return;

    alarm();
    setTimers((prev) => {
      const next = { ...prev };
      for (const [key] of finished) {
        next[Number(key)] = { endsAt: null, remaining: 0, done: true };
      }
      return next;
    });
  }, [now, timers, alarm]);

  const startTimer = useCallback(
    (index: number, minutes: number) => {
      // De AudioContext moet op een gebruikersgebaar ontstaan, anders blijft
      // iOS stil als de timer later afgaat.
      alarm.prime();
      setTimers((prev) => {
        const existing = prev[index];
        const seconds =
          existing && !existing.done && existing.remaining > 0
            ? existing.remaining
            : minutes * 60;
        return {
          ...prev,
          [index]: { endsAt: Date.now() + seconds * 1000, remaining: seconds, done: false },
        };
      });
      setNow(Date.now());
    },
    [alarm],
  );

  const pauseTimer = useCallback((index: number) => {
    setTimers((prev) => {
      const timer = prev[index];
      if (!timer?.endsAt) return prev;
      const remaining = Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
      return { ...prev, [index]: { endsAt: null, remaining, done: false } };
    });
  }, []);

  const wisselGepakt = useCallback((sleutel: string) => {
    setGepakt((vorige) => {
      const volgende = new Set(vorige);
      if (volgende.has(sleutel)) volgende.delete(sleutel);
      else volgende.add(sleutel);
      return volgende;
    });
  }, []);

  const clearTimer = useCallback((index: number) => {
    setTimers((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  if (!step) {
    return (
      <div className="cook">
        <p className="empty">Dit recept heeft geen stappen om door te lopen.</p>
        <Link href={backHref}>Terug naar het recept</Link>
      </div>
    );
  }

  // Alleen zin als er een titel ís; een lege balk hoeft geen ruimte te maken.
  const toonTitel = voorbijTitel && Boolean(step.title);

  /** Naar een andere stap, met de richting erbij zodat de schuif klopt. */
  const naStap = (doel: number) => {
    const begrensd = Math.max(0, Math.min(recipe.steps.length - 1, doel));
    if (begrensd === current) return;
    setRichting(begrensd > current ? "vooruit" : "terug");
    setCurrent(begrensd);
  };

  const timer = timers[current];
  const remainingSeconds =
    timer?.endsAt !== null && timer?.endsAt !== undefined
      ? Math.max(0, Math.round((timer.endsAt - now) / 1000))
      : (timer?.remaining ?? 0);

  // Een timer die afgaat piept en trilt. Wie het toestel niet vasthoudt of het
  // piepje niet hoort, mist dat; deze regel zegt het hardop. Hij staat er
  // altijd en wordt alleen gevuld, zodat de schermlezer hem al kent op het
  // moment dat er iets in komt te staan.
  const afgegaan = Object.entries(timers)
    .filter(([, t]) => t.done)
    .map(([key]) => Number(key) + 1)
    .sort((a, b) => a - b);

  // Timers van andere stappen die nog lopen of net afgingen.
  const elsewhere = Object.entries(timers)
    .map(([key, value]) => ({ index: Number(key), ...value }))
    .filter((entry) => entry.index !== current && (entry.endsAt !== null || entry.done))
    .sort((a, b) => a.index - b.index);

  return (
    <div className="cook">
      {/* Blijft bovenaan staan zolang je scrolt: bij een lange stap zie je
          anders halverwege niet meer de hoeveelste van hoeveel dit is. De
          staptitel schuift erbij zodra de echte kop het beeld uit is; hij zit
          in de lege ruimte die in deze regel toch al zat, dus er verspringt
          niets als hij verschijnt. */}
      <div className="cook-top">
        <header className="cook-bar">
          <Link href={backHref} className="cook-exit">
            <Icon icon={icons.close} size={16} />
            Stoppen
          </Link>
          <span className={`cook-bar-titel ${toonTitel ? "op" : ""}`} aria-hidden>
            {step.title ?? ""}
          </span>
          <span className="cook-count">
            Stap {current + 1} van {recipe.steps.length}
            {/* Het aantal personen maakt plaats voor de staptitel. Je leest het
                één keer bij het begin; welke stap dit is wil je de hele tijd
                zien, en samen passen ze niet op één telefoonregel. */}
            {recipe.servings !== null && !toonTitel && ` · ${recipe.servings} pers.`}
          </span>
        </header>

        {/* Aantikbaar, want de segmenten stonden er al en zijn al zo breed als
            een duim. Van stap vijf terug naar stap twee was drie keer "Vorige"
            met natte handen. Geen `aria-hidden` meer nu het knoppen zijn — wel
            een label per stap, want een streepje leest niet voor. */}
        <div className="cook-progress">
          {recipe.steps.map((stap, index) => (
            <button
              key={index}
              type="button"
              className={index <= current ? "on" : ""}
              onClick={() => naStap(index)}
              aria-label={`Naar stap ${index + 1}${stap.title ? `: ${stap.title}` : ""}`}
              aria-current={index === current ? "step" : undefined}
            />
          ))}
        </div>
      </div>

      {/* `alert` en niet `status`: een timer die afgaat mag onderbreken. */}
      <p className="sr" role="alert">
        {afgegaan.length === 0
          ? ""
          : afgegaan.length === 1
            ? `De tijd voor stap ${afgegaan[0]} is om.`
            : `De tijd voor stap ${opsomming(afgegaan.map(String))} is om.`}
      </p>

      {elsewhere.length > 0 && (
        <div className="cook-elsewhere">
          {elsewhere.map((entry) => (
            <button
              key={entry.index}
              type="button"
              className={`chip ${entry.done ? "ringing" : ""}`}
              onClick={() => naStap(entry.index)}
            >
              Stap {entry.index + 1}:{" "}
              {entry.done
                ? "klaar"
                : formatClock(Math.max(0, Math.round(((entry.endsAt ?? 0) - now) / 1000)))}
            </button>
          ))}
        </div>
      )}

      {/* De sleutel dwingt een nieuwe knoop af, en daarmee begint de animatie
          opnieuw. Zonder dat blijft het dezelfde knoop met andere tekst en
          gebeurt er bij de tweede stap niets meer. */}
      <main key={current} className={`cook-step schuif-${richting}`}>
        {scaled && current === 0 && (
          <p className="notice">
            Omgerekend van {baseServings} naar {recipe.servings} personen. De
            hoeveelheden hieronder kloppen; getallen in de staptekst zijn niet
            meegeschaald.
          </p>
        )}

        {step.title && <h1>{step.title}</h1>}
        <div ref={titelGrens} className="kop-grens" aria-hidden />

        {stepIngredients.length > 0 && (
          <section className="cook-ingredients">
            <h2>Nodig voor deze stap</h2>
            {/* Aan te tikken, met een streep erdoor. Bij een stap met acht
                ingrediënten raak je anders kwijt wat er al in de pan ligt, en
                dat is precies het moment waarop de deurbel gaat. Alleen in het
                geheugen van deze pagina: verlaat je de kookmodus, dan is het
                klaar — er valt niets te bewaren aan een pan die al op staat. */}
            <ul>
              {stepIngredients.map((item, index) => {
                const sleutel = `${current}:${index}`;
                const erin = gepakt.has(sleutel);
                return (
                  <li key={index} className={erin ? "gepakt" : undefined}>
                    <label>
                      <input
                        type="checkbox"
                        checked={erin}
                        onChange={() => wisselGepakt(sleutel)}
                      />
                      <span className="amount">{formatAmount(item)}</span>
                      <span>
                        {item.name}
                        {item.note && <span className="muted">, {item.note}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="cook-text">{step.text}</p>

        {/* Koken is vooruitdenken: als er straks twintig minuten geprutteld
            moet worden, wil je dat weten terwijl je nog staat te snijden. */}
        {!isLast && (
          <p className="cook-straks">
            <span className="eyebrow">Straks</span>
            {recipe.steps[current + 1].title ?? recipe.steps[current + 1].text}
          </p>
        )}

        {step.timerMinutes !== null && (
          <Timer
            minutes={step.timerMinutes}
            timer={timer}
            remainingSeconds={remainingSeconds}
            onStart={() => startTimer(current, step.timerMinutes as number)}
            onPause={() => pauseTimer(current)}
            onClear={() => clearTimer(current)}
          />
        )}

        {step.tip && (
          <aside className="cook-tip">
            <h2>
              <Icon icon={icons.tip} size={14} />
              Let op
            </h2>
            <p>{step.tip}</p>
          </aside>
        )}

        <details
          className="cook-all"
          open={showAll}
          onToggle={(event) => setShowAll(event.currentTarget.open)}
        >
          <summary>Alle ingrediënten</summary>
          {recipe.ingredientGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.name && <h3 className="group">{group.name}</h3>}
              <ul className="ingredients">
                {group.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <span className="amount">{formatAmount(item)}</span>
                    <span>
                      {item.name}
                      {item.note && <span className="muted">, {item.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>

        {/* Onopvallend onderaan. Alleen als het werkelijk gelukt is: een
            browser die de lock weigert hoort geen belofte op het scherm te
            zetten. */}
        {schermBlijftAan && (
          <p className="cook-wakker muted">Het scherm blijft aan zolang je kookt.</p>
        )}
      </main>

      <nav className="cook-nav">
        <button
          type="button"
          className="secondary"
          disabled={current === 0}
          onClick={() => naStap(current - 1)}
        >
          <Icon icon={icons.back} size={18} />
          Vorige
        </button>
        {isLast ? (
          // Naar het recept mét het log-formulier open: dit is het enige moment
          // dat je nog precies weet hoe het ging.
          <Link
            href={`${backHref}${backHref.includes("?") ? "&" : "?"}gekookt=1#gekookt`}
            className="button"
          >
            Klaar — eet smakelijk
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => naStap(current + 1)}
          >
            Volgende stap
            <Icon icon={icons.next} size={18} />
          </button>
        )}
      </nav>
    </div>
  );
}

/**
 * Het timerblok bij een stap.
 *
 * Eén blok met drie standen: nog niet gestart, lopend (of gepauzeerd) en
 * afgegaan. De tijd is het grootste element, de knoppen zijn ronde iconen
 * ernaast, en zodra hij loopt zakt er een balkje leeg zodat je van een meter
 * afstand ziet hoe ver hij is.
 */
function Timer({
  minutes,
  timer,
  remainingSeconds,
  onStart,
  onPause,
  onClear,
}: {
  minutes: number;
  timer: TimerState | undefined;
  remainingSeconds: number;
  onStart: () => void;
  onPause: () => void;
  onClear: () => void;
}) {
  const running = timer?.endsAt != null;
  const done = timer?.done ?? false;
  const total = minutes * 60;
  // Van vol naar leeg; buiten [0,1] houden voor het geval de klok verspringt.
  const left = timer && !done ? Math.min(1, Math.max(0, remainingSeconds / total)) : done ? 0 : 1;

  return (
    <section className={`timer ${done ? "ringing" : ""}`}>
      <div className="timer-top">
        <div>
          <span className="timer-label">
            {done ? "Tijd is om" : running ? "Loopt" : "Tijd voor deze stap"}
          </span>
          <strong className="timer-clock">
            {timer ? formatClock(remainingSeconds) : formatClock(total)}
          </strong>
        </div>

        <div className="timer-buttons">
          {running ? (
            <button type="button" className="round" onClick={onPause} aria-label="Pauzeren">
              <Icon icon={icons.pause} size={20} />
            </button>
          ) : (
            <button
              type="button"
              className="round primary"
              onClick={onStart}
              aria-label={done ? "Opnieuw starten" : "Timer starten"}
            >
              <Icon icon={done ? icons.reset : icons.play} size={20} />
            </button>
          )}
          {timer && !done && (
            <button type="button" className="round" onClick={onClear} aria-label="Timer wissen">
              <Icon icon={icons.close} size={18} />
            </button>
          )}
          {done && (
            <button type="button" className="round" onClick={onClear} aria-label="Timer sluiten">
              <Icon icon={icons.done} size={20} />
            </button>
          )}
        </div>
      </div>

      {timer && (
        <div className="timer-track" aria-hidden>
          <span style={{ transform: `scaleX(${left})` }} />
        </div>
      )}
    </section>
  );
}

/**
 * Houdt het scherm aan tijdens het koken. Zonder dit valt de telefoon in slaap
 * halverwege het fruiten van een ui, en dan sta je met natte handen te vegen.
 */
/**
 * Het scherm aanhouden zolang je kookt.
 *
 * Geeft terug óf het gelukt is, en dat is de hele reden dat het niet `void`
 * meer is: de lock werkte al, maar je zag het nergens — dus legde je de
 * telefoon toch met een schuin oog neer, of tikte je hem elke minuut wakker.
 * Vertrouwen komt van zeggen wat je doet, en alleen als het waar is: een
 * browser die het weigert (batterijbesparing) hoort geen belofte op het scherm
 * te zetten.
 */
function useKeepScreenAwake(): boolean {
  const [aan, setAan] = useState(false);

  useEffect(() => {
    type WakeLockSentinel = { release: () => Promise<void> };
    const wakeLockApi = (
      navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock;
    if (!wakeLockApi) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await wakeLockApi.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        sentinel = lock;
        setAan(true);
      } catch {
        // Browser weigert het (bijv. batterijbesparing). Niet erg — maar dan
        // zeggen we het ook niet.
        setAan(false);
      }
    };

    void acquire();

    // Na terugkeren uit de achtergrond is de lock kwijt.
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  return aan;
}

type Alarm = (() => void) & { prime: () => void };

/**
 * Piepjes plus trilling als een timer afgaat. Geen geluidsbestand: een paar
 * oscillator-tonen zijn genoeg en schelen een asset.
 *
 * iOS staat audio alleen toe vanuit een gebruikersgebaar, dus `prime()` wordt
 * aangeroepen bij het starten van de timer en niet pas bij het afgaan.
 */
function useAlarm(): Alarm {
  const contextRef = useRef<AudioContext | null>(null);

  const prime = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    contextRef.current ??= new Ctor();
    void contextRef.current.resume().catch(() => {});
  }, []);

  const ring = useCallback(() => {
    navigator.vibrate?.([300, 150, 300, 150, 500]);

    const context = contextRef.current;
    if (!context) return;
    void context.resume().catch(() => {});

    // Drie korte tonen, aflopend in volume zodat het niet schril wordt.
    for (let index = 0; index < 3; index += 1) {
      const start = context.currentTime + index * 0.45;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.4);
    }
  }, []);

  const alarm = ring as Alarm;
  alarm.prime = prime;
  return alarm;
}
