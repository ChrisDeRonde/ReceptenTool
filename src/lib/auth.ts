import { timingSafeEqual } from "node:crypto";

/**
 * De ingest-endpoint hangt aan het open internet en accepteert werk dat geld
 * kost (een modelaanroep per item). Eén gedeeld token is voor twee gebruikers
 * genoeg, mits het lang en random is — zie .env.example.
 */
export function isAuthorized(request: Request): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected || expected.length < 16) {
    // Liever alles weigeren dan een open endpoint met een zwak standaardtoken.
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
