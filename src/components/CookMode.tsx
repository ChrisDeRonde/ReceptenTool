"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatAmount, formatClock } from "@/lib/recipe/format";
import { ingredientsForStep, type Recipe } from "@/lib/recipe/schema";

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

  const scaled = baseServings !== null && recipe.servings !== baseServings;
  const step = recipe.steps[current];
  const stepIngredients = step ? ingredientsForStep(recipe, step) : [];
  const isLast = current === recipe.steps.length - 1;

  useKeepScreenAwake();
  const alarm = useAlarm();

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

  const timer = timers[current];
  const remainingSeconds =
    timer?.endsAt !== null && timer?.endsAt !== undefined
      ? Math.max(0, Math.round((timer.endsAt - now) / 1000))
      : (timer?.remaining ?? 0);

  // Timers van andere stappen die nog lopen of net afgingen.
  const elsewhere = Object.entries(timers)
    .map(([key, value]) => ({ index: Number(key), ...value }))
    .filter((entry) => entry.index !== current && (entry.endsAt !== null || entry.done))
    .sort((a, b) => a.index - b.index);

  return (
    <div className="cook">
      <header className="cook-bar">
        <Link href={backHref} className="cook-exit sans">
          ✕ Stoppen
        </Link>
        <span className="sans muted">
          Stap {current + 1} van {recipe.steps.length}
          {recipe.servings !== null && ` · ${recipe.servings} pers.`}
        </span>
      </header>

      <div className="cook-progress" aria-hidden>
        {recipe.steps.map((_, index) => (
          <span key={index} className={index <= current ? "on" : ""} />
        ))}
      </div>

      {elsewhere.length > 0 && (
        <div className="cook-elsewhere sans">
          {elsewhere.map((entry) => (
            <button
              key={entry.index}
              type="button"
              className={`chip ${entry.done ? "ringing" : ""}`}
              onClick={() => setCurrent(entry.index)}
            >
              Stap {entry.index + 1}:{" "}
              {entry.done
                ? "klaar"
                : formatClock(Math.max(0, Math.round(((entry.endsAt ?? 0) - now) / 1000)))}
            </button>
          ))}
        </div>
      )}

      <main className="cook-step">
        {scaled && current === 0 && (
          <p className="notice sans">
            Omgerekend van {baseServings} naar {recipe.servings} personen. De
            hoeveelheden hieronder kloppen; getallen in de staptekst zijn niet
            meegeschaald.
          </p>
        )}

        {step.title && <h1>{step.title}</h1>}

        {stepIngredients.length > 0 && (
          <section className="cook-ingredients">
            <h2 className="sans">Nodig voor deze stap</h2>
            <ul>
              {stepIngredients.map((item, index) => (
                <li key={index}>
                  <span className="amount">{formatAmount(item)}</span>
                  <span>
                    {item.name}
                    {item.note && <span className="muted">, {item.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="cook-text">{step.text}</p>

        {step.timerMinutes !== null && (
          <section className={`cook-timer ${timer?.done ? "ringing" : ""}`}>
            <div className="cook-timer-face">
              <span className="sans muted">
                {timer?.done ? "Tijd is om" : "Tijd voor deze stap"}
              </span>
              <strong>
                {timer ? formatClock(remainingSeconds) : `${step.timerMinutes} min`}
              </strong>
            </div>
            <div className="row">
              {timer?.endsAt ? (
                <button type="button" onClick={() => pauseTimer(current)}>
                  Pauzeren
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startTimer(current, step.timerMinutes as number)}
                >
                  {timer && !timer.done && timer.remaining > 0
                    ? "Hervatten"
                    : `Timer starten (${step.timerMinutes} min)`}
                </button>
              )}
              {timer && (
                <button type="button" className="secondary" onClick={() => clearTimer(current)}>
                  Wissen
                </button>
              )}
            </div>
          </section>
        )}

        {step.tip && (
          <aside className="cook-tip">
            <h2 className="sans">Let op</h2>
            <p>{step.tip}</p>
          </aside>
        )}

        <details
          className="cook-all"
          open={showAll}
          onToggle={(event) => setShowAll(event.currentTarget.open)}
        >
          <summary className="sans">Alle ingrediënten</summary>
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
      </main>

      <nav className="cook-nav">
        <button
          type="button"
          className="secondary"
          disabled={current === 0}
          onClick={() => setCurrent((index) => Math.max(0, index - 1))}
        >
          Vorige
        </button>
        {isLast ? (
          <Link href={backHref} className="cook-done sans">
            Klaar — eet smakelijk
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setCurrent((index) => Math.min(recipe.steps.length - 1, index + 1))}
          >
            Volgende stap
          </button>
        )}
      </nav>
    </div>
  );
}

/**
 * Houdt het scherm aan tijdens het koken. Zonder dit valt de telefoon in slaap
 * halverwege het fruiten van een ui, en dan sta je met natte handen te vegen.
 */
function useKeepScreenAwake(): void {
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
      } catch {
        // Browser weigert het (bijv. batterijbesparing). Niet erg.
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
