// Shared by the build and the browser so a server-rendered control can never disagree with the
// first client sync - which is what makes a submit button flash on load.

/** The option whose name or code equals `value` exactly, ignoring case and surrounding space. */
export function findExactOption(options, value) {
  const query = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!query) return null;
  return (
    options.find((o) => o.name.toLowerCase() === query || o.code.toLowerCase() === query) ?? null
  );
}
