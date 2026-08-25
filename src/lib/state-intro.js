// Fills a cert's lede template from one state's facts. src/content/intro/<cert>-intro.json ▸ _about.
// Returns an HTML string: authored copy may carry markup, facts-file values are escaped.
import { escapeHtml } from "./cert-data.js";
import { formatFact } from "./format-fact.js";

/** Sentence units, deliberately not the quick-facts panel's. An absent field renders bare. */
const PROSE_UNITS = {
	"exam.timeLimitMinutes": "minutesLong",
	"exam.passingScorePercent": "percent",
	"criteria.dmvCost": "usd",
	"criteria.classCost": "usd",
	"criteria.renewalYears": "years",
};

const PLACEHOLDER = /\{([\w.]+)\}/g;

/** @returns the { value, source } pair at "group.field", or undefined if the path names no field. */
function factAt(facts, path) {
	const [group, field] = path.split(".");
	return facts?.[group]?.[field];
}

/** The fact behind a path, throwing on a path that names nothing - a typo is not a gap. */
function requireFact(path, ctx) {
	const fact = factAt(ctx.facts, path);
	if (fact === undefined) {
		throw new Error(`${ctx.cert}-intro.json: "${path}" names no fact or meta field`);
	}
	return fact;
}

/**
 * Splits a sentence into segments so the caller acts per fact only once the variant is accepted.
 * @returns {{ segments: any[] } | null} null if any placeholder had no value.
 */
function split(text, ctx) {
	const segments = [];
	let complete = true;
	let last = 0;

	for (const match of text.matchAll(PLACEHOLDER)) {
		const [placeholder, path] = match;
		if (match.index > last) segments.push({ copy: text.slice(last, match.index) });
		last = match.index + placeholder.length;

		// Authored copy either way, but meta values are data, so they are escaped like any fact.
		if (path in ctx.meta) {
			segments.push({ copy: escapeHtml(ctx.meta[path]) });
			continue;
		}

		const fact = requireFact(path, ctx);
		if (fact.value === null) {
			complete = false;
			continue;
		}
		// A token's display string is authored copy and passes through; a number is data. tokenHtml
		// has already escaped the values it filled into that string.
		const field = path.split(".")[1];
		const token = ctx.token(field, fact, "long");
		segments.push({
			copy: token ?? escapeHtml(formatFact(fact.value, PROSE_UNITS[path])),
			sourceId: fact.source?.id ?? null,
		});
	}
	if (last < text.length) segments.push({ copy: text.slice(last) });

	return complete ? { segments } : null;
}

/** First variant that both passes its `when` and has every placeholder filled. */
function pickVariant(slot, ctx) {
	for (const variant of Array.isArray(slot) ? slot : [slot]) {
		const spec = typeof variant === "string" ? { text: variant } : variant;
		const when = Object.entries(spec.when ?? {});
		if (!when.every(([path, want]) => requireFact(path, ctx).value === want)) continue;

		const picked = split(spec.text, ctx);
		if (!picked) continue;
		// A sentence carrying no fact still makes a claim, so `cite` lets it name its own sources.
		const cite = spec.cite ?? [];
		// A gated sentence cites the fact it is gated on, which never appears as a placeholder.
		// It has no text of its own, so it attaches to the first segment.
		const gates = when.map(([path]) => requireFact(path, ctx).source?.id).filter(Boolean);
		return { segments: picked.segments, gates, cite };
	}
	return null;
}

/**
 * @param {{ cert: string, facts: any, stateName: string, template: any,
 *   token: (field: string, fact: any, form?: "short" | "long") => string | null,
 *   hrefFor: (sourceId: string) => string | null }} args
 *   `token` must be built with asHtml; `hrefFor` is called per cited fact in reading order.
 * @returns {{ html?: string, heading?: string }[]} filled blocks in order, empty ones dropped
 */
export function stateIntro({ cert, facts, stateName, template, token, hrefFor }) {
	const ctx = {
		cert,
		facts,
		token,
		meta: {
			stateName,
			localTerm: facts.meta.localTerm,
			agencyCode: facts.meta.agencyCode,
			agencyName: facts.meta.agencyName,
		},
	};

	return template.paragraphs
		.map((entry) => {
			// A heading takes no citation markers and never calls hrefFor.
			// Numbering a source here would take the number the first sentence citing it should get.
			if (!Array.isArray(entry)) {
				if (typeof entry?.heading !== "string") {
					throw new Error(`${cert}-intro.json: a block is neither a slot list nor a { heading }`);
				}
				const picked = pickVariant(entry.heading, ctx);
				return { heading: picked ? picked.segments.map(({ copy }) => copy).join("") : "" };
			}

			const parts = [];
			for (const slot of entry) {
				const picked = pickVariant(slot, ctx);
				if (!picked) continue;
				// Gates first: they are the sentence's subject even with no text of their own.
				for (const id of picked.gates) hrefFor(id);
				const text = picked.segments
					.map(({ copy, sourceId }) => {
						const href = sourceId ? hrefFor(sourceId) : null;
						return href ? `<a href="${href}">${copy}</a>` : copy;
					})
					.join("");
				// Trailing markers, since a `cite` sentence has no fact value to carry the link.
				const markers = picked.cite
					.map((id) => {
						const href = hrefFor(id);
						return `<a class="cite" href="${href}">[${href.replace("#source-", "")}]</a>`;
					})
					.join("");
				parts.push(text + markers);
			}
			return { html: parts.join(" ") };
		})
		.filter((block) => (block.heading ?? block.html) !== "");
}
