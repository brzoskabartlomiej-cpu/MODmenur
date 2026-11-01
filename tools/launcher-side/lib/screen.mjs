//! The menu's screen, as text.
//!
//! `src/menu.rs` draws this screen in the game, with the game's own
//! widgets. This draws the same screen in a terminal, so the menu can be
//! seen without building the mod: the same rows, the same words, the same
//! order, built from the same rules.

import { clean, matching, pageCount, row, wrap } from "./model.mjs";

/** The widget ids, the same as the mod's. */
export const LIST = 1;
export const FILTER_BUTTON = 2;
export const PREVIOUS = 3;
export const NEXT = 4;
export const REFRESH = 5;
export const CLEAR_SEARCH = 6;
export const TOGGLE = 7;

/**
 * The screen, as the list of widgets the game would draw.
 *
 * @param {object} state the menu's state
 */
export function widgets(state) {
  const { mods, filter, query, page, selected, pageSize, pending, error } = state;
  const out = [];
  const enabled = mods.filter((mod) => mod.enabled).length;
  out.push({ kind: "text", text: `${mods.length} installed | ${enabled} enabled` });
  out.push({ kind: "text", text: "Changes apply on the next launch." });
  if (pending.length) {
    out.push({ kind: "text", text: `${pending.length} change(s) waiting for the launcher` });
  }
  if (error) out.push({ kind: "text", text: error });
  out.push({ kind: "button", id: FILTER_BUTTON, label: `Show: ${filterLabel(filter)}` });
  if (query) {
    out.push({ kind: "text", text: `Search: ${clean(query)}` });
    out.push({ kind: "button", id: CLEAR_SEARCH, label: "Clear search" });
  }
  const rows = pageRows(state);
  out.push({ kind: "list", id: LIST, rows: rows.map(row) });
  if (!rows.length && !error) out.push({ kind: "text", text: "No matching installed mods." });
  const picked = selected !== null && selected !== undefined ? rows[selected] : null;
  if (picked) out.push(...details(picked, pending));
  const pages = pageCount(matching(mods, filter, query).length, pageSize);
  out.push({ kind: "text", text: `Page ${page + 1} / ${pages}` });
  if (page > 0) out.push({ kind: "button", id: PREVIOUS, label: "Previous page" });
  if (page + 1 < pages) out.push({ kind: "button", id: NEXT, label: "Next page" });
  out.push({ kind: "button", id: REFRESH, label: "Refresh installed mods" });
  return out;
}

/** The widgets of the picked mod's page. */
function details(mod, pending) {
  const out = [];
  out.push({ kind: "text", text: `${clean(mod.name)} ${clean(mod.version)}` });
  out.push({ kind: "text", text: `ID: ${clean(mod.id)} | Type: ${clean(mod.kind)}` });
  if (mod.source) out.push({ kind: "text", text: `Source: ${clean(mod.source)}` });
  if (mod.authors?.length) {
    out.push({ kind: "text", text: `Authors: ${clean(mod.authors.join(", "))}` });
  }
  if (mod.capabilities?.length) {
    out.push({ kind: "text", text: `May: ${clean(mod.capabilities.join(", "))}` });
  }
  for (const line of wrap(mod.description, 40, 6)) out.push({ kind: "text", text: line });
  if (mod.problem) {
    out.push({ kind: "text", text: `Problem: ${clean(mod.problem)}` });
  } else {
    out.push({ kind: "text", text: mod.enabled ? "Status: On" : "Status: Off" });
  }
  const wanted = pending.find((change) => change.id === mod.id);
  if (wanted) {
    out.push({
      kind: "text",
      text: `Waiting: turn ${clean(mod.name)} ${wanted.enabled ? "on" : "off"}`,
    });
  }
  const on = wanted ? wanted.enabled : mod.enabled;
  out.push({
    kind: "button",
    id: TOGGLE,
    label: `${on ? "Disable" : "Enable"} ${clean(mod.name)}`,
  });
  return out;
}

/** The rows of the page on screen. */
export function pageRows(state) {
  const rows = matching(state.mods, state.filter, state.query);
  const pages = pageCount(rows.length, state.pageSize);
  const page = Math.min(state.page, pages - 1);
  return rows.slice(page * state.pageSize, page * state.pageSize + state.pageSize);
}

/** What the filter button reads. */
export function filterLabel(filter) {
  if (filter === "Enabled") return "Enabled";
  if (filter === "Disabled") return "Disabled";
  return "All mods";
}

/** The screen as the player reads it. */
export function render(state) {
  const lines = [];
  for (const widget of widgets(state)) {
    if (widget.kind === "text") lines.push(widget.text);
    else if (widget.kind === "button") lines.push(`[ ${widget.label} ]`);
    else if (widget.kind === "list") {
      widget.rows.forEach((line, index) => {
        const marked = state.selected === index ? ">" : " ";
        lines.push(`${marked} ${line}`);
      });
    }
  }
  return lines.join("\n");
}
