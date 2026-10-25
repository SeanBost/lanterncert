// The state's question pool as a static file, fetched by the study tool on idle.
import { certStatePaths } from "../../../../lib/cert-data.js";
import { poolForState } from "../../../../lib/learn-pool.js";

export async function getStaticPaths() {
  return await certStatePaths({ examOnly: true });
}

export async function GET({ params }) {
  const pool = await poolForState(params.cert, params.state);
  return new Response(JSON.stringify(pool), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
