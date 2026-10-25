// The client's one accessor for questions: fetches the state's pool once and indexes it. Content
// security post-MVP replaces this file's fetch and nothing else.

let pending = null;

/** The pool, fetched on first call; a failed fetch is forgotten so the next call retries. */
export function loadPool(url) {
  pending ??= fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`pool ${response.status}`);
      return response.json();
    })
    .then(index)
    .catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}

/** Adds lookups by idKey and by topic slug. */
function index(pool) {
  pool.byKey = new Map(pool.questions.map((q) => [q.k, q]));
  pool.topicBySlug = new Map(pool.topics.map((t) => [t.slug, t]));
  return pool;
}
