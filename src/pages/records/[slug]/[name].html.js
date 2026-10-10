// Serves each record as a standalone file, the one its page's download button saves.
import { loadRecords, recordDocument } from "../../../lib/records.js";

export async function getStaticPaths() {
  return (await loadRecords()).map((record) => ({
    params: { slug: record.id, name: record.id },
    props: { record },
  }));
}

export function GET({ props }) {
  return new Response(recordDocument(props.record), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
