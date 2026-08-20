// Cloudflare attaches the viewer's region to every request it serves. For US IPs regionCode is the
// two-letter state code, which is the form findExactOption already matches on.

export function onRequestGet({ request }) {
  const { country, regionCode } = request.cf ?? {};
  const state = country === "US" && regionCode ? regionCode : null;

  return new Response(JSON.stringify({ state }), {
    headers: {
      "content-type": "application/json",
      // Per-visitor: a shared cache would hand one reader's state to the next.
      "cache-control": "no-store",
    },
  });
}
