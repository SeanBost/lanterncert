// Answers the viewer's US state code from Cloudflare's request data, or null outside the US.
export function onRequestGet({ request }) {
  const { country, regionCode } = request.cf ?? {};
  const state = country === "US" && regionCode ? regionCode : null;

  return new Response(JSON.stringify({ state }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
