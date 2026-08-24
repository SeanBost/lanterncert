// The one place a fact `value` becomes display text. data-handling.md ▸ Cert facts ▸ Contract.

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function one(value, unit) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value !== "number") return String(value);

  switch (unit) {
    case "usd":
      return USD.format(value);
    case "percent":
      return `${NUMBER.format(value)}%`;
    case "minutes":
      return `${NUMBER.format(value)} min`;
    // The same unit spelled out, for prose - "45 min" abbreviates well in a table and not in a sentence.
    case "minutesLong":
      return `${NUMBER.format(value)} ${value === 1 ? "minute" : "minutes"}`;
    case "years":
      return `${NUMBER.format(value)} ${value === 1 ? "year" : "years"}`;
    // 0 is a verified "never", not a gap — null is the gap. data-handling.md ▸ Cert facts ▸ Contract.
    case "renewal":
      return value === 0 ? "Does not expire" : one(value, "years");
    default:
      return NUMBER.format(value);
  }
}

/** Returns null for an absent value — only the caller can say what "we don't know" looks like. */
export function formatFact(value, unit) {
  if (value === null || value === undefined) return null;
  // Unspaced, the standard form for a range. A spaced hyphen reads as a dash between two separate
  // figures; "$32-$42" reads as one span. A rendered en dash is ruled out site-wide.
  if (Array.isArray(value)) return `${one(value[0], unit)}-${one(value[1], unit)}`;
  return one(value, unit);
}
