// The autocomplete's option shape, derived from states.json so the two lists cannot disagree.
import states from "../content/states.json";

export const usStates = Object.values(states).map((s) => ({ name: s.name, code: s.abbreviation }));
