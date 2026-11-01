//! The Mod Menu's rules, in JavaScript.
//!
//! `src/model.rs` is the menu's own model; this file is the same rules, so
//! the launcher-side tools and the shared cases in `tests/fixtures` can be
//! run without a Rust toolchain. The Rust tests read the same cases.

/** The feed schema this Mod Menu reads. */
export const SCHEMA = 2;
/** The oldest feed this Mod Menu reads. */
export const OLDEST_SCHEMA = 1;
/** The biggest feed read. */
export const MAX_FEED = 1 << 20;
/** How many rows a page holds when the player did not choose a size. */
export const DEFAULT_PAGE_SIZE = 20;
/** The page sizes the player may choose. */
export const PAGE_SIZES = [10, 20, 50];
/** How long a mod's own text may be. */
export const MAX_TEXT = 180;

/** Reads the feed. */
export function parse(bytes) {
  const text = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes);
  if (Buffer.byteLength(text, "utf8") > MAX_FEED) {
    throw new Error("Inventory is too large; update your launcher.");
  }
  let feed;
  try {
    feed = JSON.parse(text);
  } catch {
    throw new Error("Inventory could not be read; reopen the game through the launcher.");
  }
  if (!feed || typeof feed !== "object" || !Array.isArray(feed.mods)) {
    throw new Error("Inventory could not be read; reopen the game through the launcher.");
  }
  if (!Number.isInteger(feed.schema) || feed.schema < OLDEST_SCHEMA || feed.schema > SCHEMA) {
    throw new Error("Inventory needs a newer Mod Menu.");
  }
  const mods = feed.mods.map((mod) => ({
    id: String(mod.id ?? ""),
    name: String(mod.name ?? ""),
    version: String(mod.version ?? ""),
    kind: String(mod.kind ?? "Unknown"),
    enabled: Boolean(mod.enabled),
    description: String(mod.description ?? ""),
    authors: Array.isArray(mod.authors) ? mod.authors.map(String) : [],
    capabilities: Array.isArray(mod.capabilities) ? mod.capabilities.map(String) : [],
    source: String(mod.source ?? ""),
    problem: mod.problem ? String(mod.problem) : null,
  }));
  mods.sort((a, b) => {
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { schema: feed.schema, mods };
}

/** The mods the filter and the search keep. */
export function matching(mods, filter, search) {
  const query = String(search ?? "").trim().toLowerCase();
  return mods.filter((mod) => {
    const kept =
      filter === "Enabled" ? mod.enabled : filter === "Disabled" ? !mod.enabled : true;
    return kept && haystack(mod).includes(query);
  });
}

/** What the search looks at. */
function haystack(mod) {
  return [mod.id, mod.name, mod.version, mod.kind, mod.source, ...mod.authors]
    .join(" ")
    .toLowerCase();
}

/** How many pages the list has. */
export function pageCount(count, pageSize) {
  const size = Math.max(1, pageSize ?? DEFAULT_PAGE_SIZE);
  return Math.max(1, Math.ceil(count / size));
}

/** The page of the list to show, never past the last one. */
export function clampPage(page, count, pageSize) {
  return Math.min(page, pageCount(count, pageSize) - 1);
}

/** Cuts a mod's own text. */
export function clean(text) {
  return [...String(text ?? "")]
    .filter((character) => {
      const code = character.codePointAt(0);
      const control = code < 0x20 || code === 0x7f;
      return !control && character !== "§";
    })
    .slice(0, MAX_TEXT)
    .join("");
}

/** The row the list shows. */
export function row(mod) {
  const name = [...clean(mod.name)].slice(0, 18).join("");
  const version = [...clean(mod.version)].slice(0, 8).join("");
  const state = mod.problem ? "Invalid" : mod.enabled ? "On" : "Off";
  return `${name} ${version} [${state}]`;
}

/** Wraps a mod's description into lines a narrow menu can show. */
export function wrap(text, width, lines) {
  const limit = Math.max(8, width ?? 40);
  const max = Math.max(0, lines ?? 6);
  const out = [];
  for (const paragraph of clean(text).split("\n")) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    let line = "";
    for (const word of trimmed.split(/\s+/)) {
      if (line && [...line].length + 1 + [...word].length > limit) {
        out.push(line);
        line = "";
        if (out.length === max) return out;
      }
      if (line) line += " ";
      line += word;
    }
    if (line) {
      out.push(line);
      if (out.length === max) return out;
    }
  }
  return out;
}
