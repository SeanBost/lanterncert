// Browser-side behavior for <form id="autocomplete">. Options and destination come from its dataset;
// the hook is an id because at most one may be mounted per page.

import { findExactOption } from "../lib/match-option.js";

const MAX_RESULTS = 4;

export function initAutocomplete() {
  const form = document.getElementById("autocomplete");
  if (!form) return;

  const input = form.querySelector(".autocomplete__input");
  const list = form.querySelector(".autocomplete__list");
  const submit = form.querySelector(".autocomplete__submit");
  const options = JSON.parse(form.dataset.options || "[]");
  const base = form.dataset.base || "";

  let matches = [];
  let active = -1;
  let selected = null;

  const norm = (value) => value.trim().toLowerCase();

  // Sorted BEFORE the trim, so the four shown are the first four alphabetically.
  function search(query) {
    const q = norm(query);
    if (!q) return [];
    // A typed-out name is already the answer; a code is not, so that still gets a list to confirm on.
    if (options.some((o) => o.name.toLowerCase() === q)) return [];
    return options
      .filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_RESULTS);
  }

  function sync() {
    selected = findExactOption(options, input.value);
    submit.disabled = !selected;
  }

  function close() {
    matches = [];
    active = -1;
    render();
  }

  function choose(option) {
    input.value = option.name;
    close();
    sync();
    input.focus();
    // focus() selects the whole value; a just-picked state wants a caret, not a pending overwrite.
    input.setSelectionRange(option.name.length, option.name.length);
  }

  function render() {
    list.replaceChildren();
    matches.forEach((option, i) => {
      const li = document.createElement("li");
      li.className = "autocomplete__option";
      li.id = `autocomplete-option-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === active));
      li.textContent = `${option.name} (${option.code})`;
      // mousedown, not click: blur fires first on a click and would close the list underneath it.
      li.addEventListener("mousedown", (event) => {
        event.preventDefault();
        choose(option);
      });
      list.append(li);
    });

    const open = matches.length > 0;
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
    if (active >= 0) input.setAttribute("aria-activedescendant", `autocomplete-option-${active}`);
    else input.removeAttribute("aria-activedescendant");
  }

  input.addEventListener("input", () => {
    matches = search(input.value);
    active = -1;
    render();
    sync();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") return close();
    if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      return choose(matches[active]);
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (matches.length === 0) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    active = (active + step + matches.length) % matches.length;
    render();
  });

  // Entering the field means replacing the state, not editing it. Both events are needed: the click
  // that gives focus lands after it and would otherwise collapse the selection back to a caret.
  const selectAll = () => input.select();
  input.addEventListener("focus", selectAll);
  input.addEventListener("click", selectAll);

  input.addEventListener("blur", close);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (selected) window.location.href = `${base}/${selected.code.toLowerCase()}`;
  });

  sync();
}
