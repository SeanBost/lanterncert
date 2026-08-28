// Browser-side behavior for the hero source wall. The hook is an id because at most one may be
// mounted per page. The wall renders real sources server-side and works with this script absent.

// A swap runs 2 * FADE_MS and one begins every INTERVAL_MS, so 2 * FADE_MS / INTERVAL_MS overlap.
// Keep that above two - at exactly two the only fade-in and fade-out are coincident and read as one beat.
const FADE_MS = 2000;
const INTERVAL_MS = 1000;
// Off a metronome, so the eye can't predict the next swap. 0 disables.
const JITTER = 0.0;
// Only how often a paused wall re-checks whether it may resume. Not a gap between swaps.
const POLL_MS = 200;

// Peak drift of a tile from its layout position, per axis. The sine weights below sum to 1, so this
// is a true maximum rather than an approximate one.
const DRIFT_PX = 8;
const DRIFT_DEG = 0;
// Seconds. Each tile draws its own periods from this range - see wave().
const DRIFT_PERIOD_MIN = 12;
const DRIFT_PERIOD_MAX = 16;
// A frame after a background tab returns is worth the whole hidden span, which would teleport a tile.
const MAX_FRAME_S = 0.05;

// Mirrored from the sources registry, HAND-MAINTAINED: a registry edit does not reach this list,
// so a retired URL here outlives the sweep. Refreshed 2026-08-18.
const SOURCES = [
  { title: "AZ MVD Motorcycle License and Endorsement Guide", url: "https://azdot.gov/mvd/services/driver-license-ID/motorcycle-license" },
  { title: "HI DOT Motorcycle, Scooter and Moped Rules", url: "https://hidot.hawaii.gov/highways/safe-communites/motorcycles-motor-scooters-and-mopeds-general-information/" },
  { title: "IL SOS Illinois Motorcycle Operator Manual", url: "https://www.ilsos.gov/content/dam/publications/pdf_publications/dsd_x140.pdf" },
  { title: "MA RMV Motorcycle (Class M) License Guide", url: "https://www.mass.gov/motorcycle-class-m-drivers-licenses" },
  { title: "MO DOR Missouri Motorcycle Operator Manual", url: "https://dor.mo.gov/forms/2332.pdf" },
  { title: "NJ MVC Motorcycle License and Endorsement Guide", url: "https://www.nj.gov/mvc/vehicletopics/motorcycle.htm" },
  { title: "OH BMV Motorcycle and Motor Scooter License Guide", url: "https://www.bmv.ohio.gov/dl-mo-motorcycle.aspx" },
  { title: "WA DOL Motorcycle Endorsement Guide", url: "https://dol.wa.gov/driver-licenses-and-permits/motorcycle" },
  { title: "MSF Basic RiderCourse Rider Handbook", url: "https://msf-usa.org/documents/library/basic-ridercourse-handbook/" },
  { title: "MSF Basic RiderCourse Overview", url: "https://msf-usa.org/start-your-ride/basic-ridercourse/" },
  { title: "MSF Basic RiderCourse Curriculum FAQ", url: "https://navalsafetycommand.navy.mil/Portals/100/Documents/c5.1_BRC2013.2014%20Update%20FAQs.pdf" },
  { title: "MSF Motorcycle Operator Manual", url: "https://msf-usa.org/wp-content/uploads/2023/02/motorcycle-operator-manual.pdf" },
  { title: "NHTSA Administrative Standards for State Rider Training Programs", url: "https://www.nhtsa.gov/sites/nhtsa.dot.gov/files/documents/812071-modelnatladminmotorcycle.pdf" },
  { title: "NHTSA Model National Standards for Entry-Level Rider Training", url: "https://www.nhtsa.gov/sites/nhtsa.gov/files/documents/811503.pdf" },
  { title: "Florida Motorcycle Operator Handbook", url: "https://ridesmartflorida.com/wp-content/uploads/2026/07/Motorcycle_Operators_Handbook_Final_WTweb.pdf" },
  { title: "GA DDS Basic Riders Course Guide", url: "https://dds.georgia.gov/regulated-programs/motorcycle-safety-program/basic-riders-course" },
  { title: "TX DPS Fee Schedule", url: "https://www.dps.texas.gov/section/driver-license/driver-license-fees" },
  { title: "CHP California Motorcyclist Safety Program", url: "https://www.chp.ca.gov/programs-services/programs/california-motorcyclist-safety/" },
  { title: "FLHSMV Motorcycle Course Directory", url: "https://www.flhsmv.gov/driver-licenses-id-cards/motorcycle-rider-education-endorsements/safety-course-locations/" },
  { title: "GA DDS Class M License Checklist", url: "https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-class-m-motorcycle-license" },
  { title: "TX DPS Guide to License Classes", url: "https://www.dps.texas.gov/section/driver-license/classes-driver-licenses" },
  { title: "CMSP New Rider Course Guide", url: "https://motorcyclesafetyca.com/new-riders/" },
  { title: "FLHSMV Motorcycle Endorsement FAQ", url: "https://www.flhsmv.gov/driver-licenses-id-cards/motorcycle-rider-education-endorsements/faqs/" },
  { title: "GA DDS Driver's Manual: Testing Section", url: "https://dds.georgia.gov/section-3-testing-information" },
  { title: "TX DPS Motorcycle License Guide", url: "https://www.dps.texas.gov/section/driver-license/motorcycle-license" },
  { title: "CA DMV California Driver's Handbook", url: "https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/" },
  { title: "FLHSMV Motorcycle Endorsement Guide", url: "https://www.flhsmv.gov/driver-licenses-id-cards/motorcycle-rider-education-endorsements/" },
  { title: "GA DDS Fee and Term Schedule", url: "https://dds.georgia.gov/fees-and-terms" },
  { title: "TX Statute on Driver License Classes", url: "https://statutes.capitol.texas.gov/Docs/TN/htm/TN.521.htm" },
  { title: "CA DMV Driver's License Guide", url: "https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/driver-licenses-dl/" },
  { title: "FLHSMV Fee Schedule", url: "https://www.flhsmv.gov/fees/" },
  { title: "GA DDS Motorcycle Course Registration Portal", url: "https://online.dds.ga.gov/motorcycle/index.aspx" },
  { title: "TX Statute on Vehicle Definitions", url: "https://statutes.capitol.texas.gov/Docs/TN/htm/TN.541.htm" },
  { title: "CA Driver Handbook: Getting a Permit and License", url: "https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/getting-an-instruction-permit-and-drivers-license/" },
  { title: "FLHSMV Rider Training Course Guide", url: "https://www.flhsmv.gov/driver-licenses-id-cards/motorcycle-rider-education-endorsements/florida-rider-training-program-courses/" },
  { title: "GA DDS Moped and Scooter Rules", url: "https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-class-m-motorcycle-license-0" },
  { title: "TDLR Motorcycle Course Curriculum Rules", url: "https://www.tdlr.texas.gov/mot/school-curriculum.htm" },
  { title: "CA DMV Instruction and Learner's Permit Guide", url: "https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/instruction-permits/" },
  { title: "FL Statute on the Motorcycle Safety Education Program", url: "https://www.flsenate.gov/laws/statutes/2025/322.0255" },
  { title: "GA DDS Motorcycle License Guide", url: "https://dds.georgia.gov/get-your-georgia-motorcycle-license" },
  { title: "TDLR Motorcycle School Directory", url: "https://www.tdlr.texas.gov/mot/find-schools.htm" },
  { title: "CA DMV Licensing Fee Schedule", url: "https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/licensing-fees/" },
  { title: "FL Statute on Driver License Fees", url: "https://www.flsenate.gov/laws/statutes/2025/322.21" },
  { title: "GA DDS Motorcycle Operator's Manual", url: "https://dds.georgia.gov/document/document/motorcycle-operators-manual/download" },
  { title: "TDLR Motorcycle Operator Safety Program", url: "https://www.tdlr.texas.gov/mot/" },
  { title: "CA DMV Motorcycle Handbook", url: "https://www.dmv.ca.gov/portal/file/motorcycle-driver-handbook-pdf/" },
  { title: "GA DDS Class MP Permit Checklist", url: "https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-motorcycle-permit" },
  { title: "TDLR Motorcycle Operator Training Manual", url: "https://www.tdlr.texas.gov/mot/pdf/TDLR%20Motorcycle%20Operators%20Manual.pdf" },
];

/** The integers 0..length-1 in random order, Fisher-Yates. Draws the sources and orders the swaps. */
function randomOrder(length) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One axis of drift: two out-of-step sines summing to a peak of 1, as a function of seconds.
    The two periods almost never divide each other, so the path never closes into a loop the eye learns. */
function wave() {
  const term = () => ({
    w: (2 * Math.PI) / (DRIFT_PERIOD_MIN + Math.random() * (DRIFT_PERIOD_MAX - DRIFT_PERIOD_MIN)),
    phase: Math.random() * 2 * Math.PI,
  });
  const [a, b] = [term(), term()];
  return (t) => 0.6 * Math.sin(a.w * t + a.phase) + 0.4 * Math.sin(b.w * t + b.phase);
}

/** Committed and canceled rather than left filling, so the passes can't stack up over a long visit. */
async function fade(el, from, to) {
  const anim = el.animate([{ opacity: from }, { opacity: to }], {
    duration: FADE_MS,
    easing: "ease-out",
    fill: "forwards",
  });
  await anim.finished;
  anim.commitStyles();
  anim.cancel();
}

export function initHeroArt() {
  const wall = document.getElementById("source-wall");
  if (!wall) return;

  const cells = [...wall.querySelectorAll(".source-tile")].map((el) => ({
    el,
    title: el.querySelector(".source-tile__title"),
    host: el.querySelector(".source-tile__host"),
  }));
  if (!cells.length) return;

  // Two sources per tile, drawn half the deck apart, so 24 tiles cover 48 with no repeat on screen.
  const draw = randomOrder(SOURCES.length);
  cells.forEach((cell, i) => {
    cell.pair = [
      SOURCES[draw[i % SOURCES.length]],
      SOURCES[draw[(i + cells.length) % SOURCES.length]],
    ];
    cell.shown = 0;
    paint(cell);
  });

  function paint(cell) {
    const source = cell.pair[cell.shown];
    cell.el.href = source.url;
    cell.title.textContent = source.title;
    cell.host.textContent = source.url;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let onScreen = true;
  new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting)).observe(wall);

  // Nothing moves in a background tab, off screen, or while someone is typing their state.
  const form = document.getElementById("autocomplete");
  const paused = () => document.hidden || !onScreen || !!form?.contains(document.activeElement);

  // Each tile drifts a couple of pixels on its own clock. Transform, not margin: the layout box never
  // moves, and the tile's overflow clip travels with it so the ellipsis can't re-cut mid-drift.
  cells.forEach((cell) => (cell.drift = { x: wave(), y: wave(), r: wave() }));

  // An accumulated clock rather than the wall clock, so a pause resumes from the phase it stopped at.
  let driftT = 0;
  let lastFrame = 0;
  function drift(now) {
    const elapsed = Math.min((now - lastFrame) / 1000, MAX_FRAME_S);
    lastFrame = now;
    if (!paused()) {
      driftT += elapsed;
      for (const cell of cells) {
        const { x, y, r } = cell.drift;
        cell.el.style.transform =
          `translate(${(x(driftT) * DRIFT_PX).toFixed(2)}px, ${(y(driftT) * DRIFT_PX).toFixed(2)}px)` +
          ` rotate(${(r(driftT) * DRIFT_DEG).toFixed(3)}deg)`;
      }
    }
    requestAnimationFrame(drift);
  }
  requestAnimationFrame(drift);

  // Re-shuffled every pass, so the eye cannot learn the order.
  // The in-flight skip guards the pass boundary: without it one tile could run two animations.
  let queue = [];
  const inFlight = new Set();
  function nextIndex() {
    if (!queue.length) queue = randomOrder(cells.length);
    const slot = Math.max(0, queue.findIndex((i) => !inFlight.has(i)));
    return queue.splice(slot, 1)[0];
  }

  async function swap(index) {
    const cell = cells[index];
    inFlight.add(index);
    // Mid-fade a tile stops being a link, via the pointer-events rule in global.css.
    // tabindex="-1" is permanent and set in the markup - nothing here may touch it.
    cell.el.setAttribute("aria-disabled", "true");
    await fade(cell.el, 1, 0);
    cell.shown ^= 1;
    paint(cell);
    await fade(cell.el, 0, 1);
    cell.el.removeAttribute("aria-disabled");
    inFlight.delete(index);
  }

  // Started rather than awaited, so a swap still running overlaps the ones after it. That single
  // line is what stacks the fades; a paused wall stops STARTING swaps and lets the rest land.
  async function run() {
    for (;;) {
      while (paused()) await wait(POLL_MS);
      swap(nextIndex());
      await wait(INTERVAL_MS * (1 + (Math.random() * 2 - 1) * JITTER));
    }
  }

  run();
}
