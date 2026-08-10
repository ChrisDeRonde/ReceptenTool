import type { Ingredient } from "./schema";

/** "300 g", "2 teentje", "" bij een snufje zonder maat. */
export function formatAmount(item: Ingredient): string {
  const quantity = item.quantity === null ? "" : formatNumber(item.quantity);
  return [quantity, item.unit].filter(Boolean).join(" ");
}

/** Hele regel op één lijn, voor plekken zonder kolommen. */
export function formatIngredient(item: Ingredient): string {
  const amount = formatAmount(item);
  const base = amount ? `${amount} ${item.name}` : item.name;
  return item.note ? `${base}, ${item.note}` : base;
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  // Half, kwart en derde lezen prettiger als breuk dan als 0,33.
  const fractions: Array<[number, string]> = [
    [0.25, "¼"],
    [0.33, "⅓"],
    [0.5, "½"],
    [0.67, "⅔"],
    [0.75, "¾"],
  ];
  const whole = Math.floor(value);
  const rest = value - whole;
  const match = fractions.find(([fraction]) => Math.abs(rest - fraction) < 0.02);
  if (match) return whole > 0 ? `${whole}${match[1]}` : match[1];
  return value.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

/** 90 -> "1:30:00", 8 -> "8:00". Voor de aftellende timer. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
