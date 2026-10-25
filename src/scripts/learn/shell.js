// The study tool's shell: three modes switched in place, each with its own URL, each a module imported
// on first open whose panel then stays mounted. Owns history, focus, titles and the test guard.
import { loadPool } from "./bank.js";
import * as store from "./store.js";
import { reducedMotion } from "./question.js";

const MODES = ["guide", "cards", "test"];
const NAMES = { guide: "Study Guide", cards: "Practice Cards", test: "Mock Test" };
const IMPORTERS = {
  guide: () => import("./guide.js"),
  cards: () => import("./cards.js"),
  test: () => import("./test.js"),
};

/** The mode a URL asks for; anything unknown is the guide. */
const modeOf = (url) => {
  const mode = url.searchParams.get("mode");
  return mode === "cards" || mode === "test" ? mode : "guide";
};

const bare = (path) => path.replace(/\/+$/, "");

/** A URL on this page, written on the path the page loaded under, with or without its trailing slash. */
const onPage = (href) => {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || bare(url.pathname) !== bare(location.pathname)) return null;
  url.pathname = location.pathname;
  return url;
};

const relative = (url) => url.pathname + url.search + url.hash;

export function initLearn() {
  const data = JSON.parse(document.getElementById("learn-data").textContent);
  const root = document.documentElement;
  const panels = Object.fromEntries(MODES.map((m) => [m, document.getElementById(`panel-${m}`)]));
  const switchLinks = [...document.querySelectorAll(".mode-switch__link")];
  const toolGroups = [...document.querySelectorAll("[data-tools]")];

  /** @type {Record<string, any>} */
  const controllers = {};
  const loading = {};
  /** Where each mode was left, so the switch returns to it. */
  const lastUrl = Object.fromEntries(
    MODES.map((m) => [m, relative(onPage(m === "guide" ? data.learn : `${data.learn}?mode=${m}`))]),
  );
  let current = null;
  let guideScroll = 0;
  /** The control each mode had focused when it was left. */
  const focusLeft = {};

  const pool = () => loadPool(data.poolUrl);

  const syncSwitch = () => {
    for (const link of switchLinks) {
      const mode = link.dataset.mode;
      link.href = lastUrl[mode];
      if (mode === current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  };

  /** Rewrites the URL in place, for state that shouldn't cost a Back press. */
  const replaceUrl = (href) => {
    const url = onPage(href);
    if (!url) return;
    history.replaceState(history.state, "", url);
    lastUrl[modeOf(url)] = relative(url);
    syncSwitch();
  };

  const ctxFor = (mode) => ({
    data,
    mode,
    panel: panels[mode],
    tools: toolGroups.find((g) => g.dataset.tools === mode),
    pool,
    store,
    replaceUrl,
    isActive: () => current === mode,
  });

  const controllerFor = (mode) => {
    loading[mode] ??= IMPORTERS[mode]().then((module) => {
      controllers[mode] = module.mount(ctxFor(mode));
      return controllers[mode];
    });
    return loading[mode];
  };

  // ---- Showing a mode --------------------------------------------------------------------------

  /** Puts a mode's panel on screen and hands it the URL. */
  async function apply(url, { via = "link", initial = false } = {}) {
    const mode = modeOf(url);
    const changing = mode !== current;
    lastUrl[mode] = url.pathname + url.search + url.hash;

    if (!changing) {
      controllers[mode]?.enter(url, { initial });
      syncSwitch();
      return;
    }

    // The guide comes back to its scroll position, not to the last line it was sent to.
    if (current === "guide") {
      guideScroll = window.scrollY;
      lastUrl.guide = lastUrl.guide.split("#")[0];
    }
    if (current && panels[current].contains(document.activeElement)) focusLeft[current] = document.activeElement;
    controllers[current]?.leave?.();
    const leaving = current;
    current = mode;
    const ready = controllers[mode];

    const swap = () => {
      for (const m of MODES) panels[m].hidden = m !== mode;
      root.dataset.learnMode = mode;
      for (const group of toolGroups) group.hidden = group.dataset.tools !== mode;
      syncSwitch();
      ready?.enter(url, { initial });
      if (initial) return;
      if (mode !== "guide") window.scrollTo({ top: 0, behavior: "instant" });
      else if (!url.hash) window.scrollTo({ top: guideScroll, behavior: "instant" });
    };

    if (!initial && leaving && document.startViewTransition && !reducedMotion()) {
      await document.startViewTransition(swap).updateCallbackDone;
    } else {
      swap();
    }

    const controller = ready ?? (await controllerFor(mode));
    if (!ready && current === mode) controller.enter(url, { initial });

    if (!initial || mode !== "guide") document.title = `${data.stateName} ${data.term} ${NAMES[mode]} - LanternCert`;
    if (initial && mode !== "guide") {
      // Arriving straight into cards or the test puts focus in the stage, so its keys work at once.
      await controller.ready?.catch(() => {});
      if (current === mode && document.activeElement === document.body) controller.heading()?.focus({ preventScroll: true });
    } else if (!initial) {
      // A panel built from the pool has no heading until the pool lands.
      await controller.ready?.catch(() => {});
      // Going back returns focus to where the reader left it; anything else starts at the heading.
      const left = focusLeft[mode];
      const target = via === "back" && left?.isConnected && panels[mode].contains(left) ? left : controller.heading();
      if (current === mode) target?.focus({ preventScroll: true });
    }
    store.setPrefs({ cert: data.cert, state: data.state, mode });
  }

  /** Asks the mode on screen whether it may be left; only a running Mock Test ever says no. */
  const mayLeave = async (toMode) =>
    toMode === current || !controllers[current]?.guard || (await controllers[current].guard());

  async function navigate(href) {
    const url = onPage(href);
    if (!url || url.href === location.href) return;
    if (!(await mayLeave(modeOf(url)))) return;
    history.pushState({ learn: true }, "", url);
    await apply(url);
  }

  // In-tool links switch in place; a modified click opens a tab as usual.
  document.addEventListener("click", (event) => {
    const link = /** @type {HTMLElement} */ (event.target).closest?.("a[data-learn]");
    if (!(link instanceof HTMLAnchorElement)) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = onPage(link.href);
    if (!url) return;
    event.preventDefault();
    navigate(url);
  });

  // Back and Forward undo a switch. A popstate can't be canceled, so staying in a test pushes it back.
  window.addEventListener("popstate", async () => {
    const url = new URL(location.href);
    const mode = modeOf(url);
    if (mode === current && url.search === new URL(lastUrl[mode], location.href).search) {
      lastUrl[mode] = url.pathname + url.search + url.hash;
      syncSwitch();
      return;
    }
    if (!(await mayLeave(mode))) {
      history.pushState({ learn: true }, "", lastUrl[current]);
      return;
    }
    apply(url, { via: "back" });
  });

  // ---- Start -----------------------------------------------------------------------------------

  // Publishes the chrome's measured heights as --bar-h and --foot-h.
  const chrome = { "--bar-h": document.querySelector(".tool-bar"), "--foot-h": document.querySelector(".tool-foot") };
  const measure = new ResizeObserver(() => {
    for (const [name, element] of Object.entries(chrome)) root.style.setProperty(name, `${element.getBoundingClientRect().height}px`);
  });
  for (const element of Object.values(chrome)) measure.observe(element);

  const notice = document.querySelector('[data-slot="storage-notice"]');
  let noticeDismissed = false;
  try {
    noticeDismissed = sessionStorage.getItem("lanterncert:notice") === "1";
  } catch {
    /* no storage at all, which is what the notice says */
  }
  if (!store.status().persistent && !noticeDismissed && notice) {
    notice.hidden = false;
    notice.querySelector("button")?.addEventListener("click", () => {
      notice.hidden = true;
      try {
        sessionStorage.setItem("lanterncert:notice", "1");
      } catch {
        /* nothing to remember it in */
      }
    });
  }

  apply(new URL(location.href), { initial: true });

  // The pool lands while the reader is on the guide, so cards and the test usually open at once.
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 300));
  idle(() => pool().catch(() => {}));
}
