//! The feed the launcher writes for the Mod Menu.
//!
//! It is the file the menu reads: what the instance has installed, in the
//! Mod Menu's own storage folder, where a sandboxed mod may read it.

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { MAX_FEED, SCHEMA } from "./model.mjs";
import { MODS_DIR, STORAGE_DIR } from "./scan.mjs";

/** The Mod Menu's id: the folder its storage is in. */
export const MOD_ID = "mod_menu";

/** Where the feed is written, in the instance. */
export function feedPath(home) {
  return join(home, MODS_DIR, STORAGE_DIR, MOD_ID, "inventory.json");
}

/** The feed for the mods an instance has installed. */
export function buildFeed(mods) {
  return {
    schema: SCHEMA,
    mods: mods.map((mod) => {
      const entry = {
        id: mod.id,
        name: mod.name,
        version: mod.version,
        kind: mod.kind,
        enabled: mod.enabled,
        description: mod.description ?? "",
        authors: mod.authors ?? [],
        capabilities: mod.capabilities ?? [],
        source: mod.source ?? "",
      };
      if (mod.problem) entry.problem = mod.problem;
      return entry;
    }),
  };
}

/** Writes the feed, atomically: a temporary sibling, then the name. */
export function writeFeed(home, feed) {
  const path = feedPath(home);
  const text = JSON.stringify(feed, null, 2) + "\n";
  if (Buffer.byteLength(text, "utf8") > MAX_FEED) {
    throw new Error("Inventory is too large; update your launcher.");
  }
  mkdirSync(dirname(path), { recursive: true });
  const part = `${path}.part`;
  writeFileSync(part, text);
  renameSync(part, path);
  return path;
}
