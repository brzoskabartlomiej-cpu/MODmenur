//! The changes the player asked for in the menu, applied to the instance.
//!
//! The menu is a sandboxed mod: it may only write its own storage folder,
//! so it cannot turn a mod on or off itself. It writes what the player
//! asked for, and this applies it with Horizon's own rules, the ones the
//! game's Options > Mods page uses:
//!
//! - a mod that is on has the line `mod.<id>:true` in `horizon-mods.txt`;
//! - a native mod that is off has the line `mod.<id>:false`, so the
//!   launcher's next build leaves it out;
//! - any other mod that is off has no line at all.
//!
//! The file is written the way the game writes it: the mods that are on,
//! then the ones that are off, then the keys.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { MODS_FILE, scan } from "./scan.mjs";

/** The file the menu writes the changes into. */
export function pendingPath(home) {
  return join(home, "horizon-mods", ".horizon-mod-data", "mod_menu", "pending.json");
}

/** The changes waiting, or none. */
export function readPending(home) {
  try {
    const feed = JSON.parse(readFileSync(pendingPath(home), "utf8"));
    const changes = Array.isArray(feed.changes) ? feed.changes : [];
    return changes
      .filter((change) => change && typeof change.id === "string")
      .map((change) => ({ id: change.id, enabled: Boolean(change.enabled) }));
  } catch {
    return [];
  }
}

/** What `horizon-mods.txt` holds, as the game reads it. */
export function readModsFile(home) {
  const enabled = new Set();
  const disabled = new Set();
  const keys = new Map();
  let text = "";
  try {
    text = readFileSync(join(home, MODS_FILE), "utf8");
  } catch {
    return { enabled, disabled, keys };
  }
  for (const line of text.split(/\r?\n/)) {
    const split = line.indexOf(":");
    if (split < 0) continue;
    const key = line.slice(0, split).trim();
    const value = line.slice(split + 1).trim();
    if (key.startsWith("mod.")) {
      const id = key.slice("mod.".length);
      if (value === "true") enabled.add(id);
      else if (value === "false") disabled.add(id);
    } else if (key.startsWith("key.")) {
      const rest = key.slice("key.".length);
      const dot = rest.indexOf(".");
      if (dot > 0) {
        const id = rest.slice(0, dot);
        const name = rest.slice(dot + 1);
        if (!keys.has(id)) keys.set(id, new Map());
        keys.get(id).set(name, value);
      }
    }
  }
  return { enabled, disabled, keys };
}

/** Writes `horizon-mods.txt` the way the game writes it. */
export function writeModsFile(home, { enabled, disabled, keys }) {
  const path = join(home, MODS_FILE);
  if (enabled.size === 0 && disabled.size === 0 && keys.size === 0 && !existsSync(path)) {
    return null;
  }
  const lines = [];
  for (const id of [...enabled].sort()) lines.push(`mod.${id}:true`);
  for (const id of [...disabled].sort()) lines.push(`mod.${id}:false`);
  for (const id of [...keys.keys()].sort()) {
    for (const [name, key] of [...keys.get(id).entries()].sort()) {
      lines.push(`key.${id}.${name}:${key}`);
    }
  }
  const text = lines.length ? lines.join("\n") + "\n" : "";
  writeFileSync(path, text);
  return path;
}

/** Applies the changes waiting for the launcher. */
export function applyPending(home) {
  const changes = readPending(home);
  if (!changes.length) return { applied: [], file: null };
  const { mods } = scan(home);
  const kinds = new Map(mods.map((mod) => [mod.id, mod.kind]));
  const state = readModsFile(home);
  const applied = [];
  for (const change of changes) {
    const native = kinds.get(change.id) === "Native";
    if (native) {
      if (change.enabled) {
        state.enabled.add(change.id);
        state.disabled.delete(change.id);
      } else {
        state.enabled.delete(change.id);
        state.disabled.add(change.id);
      }
    } else if (change.enabled) {
      state.enabled.add(change.id);
      state.disabled.delete(change.id);
    } else {
      state.enabled.delete(change.id);
      state.disabled.delete(change.id);
    }
    applied.push({ ...change, kind: kinds.get(change.id) ?? "Unknown" });
  }
  const file = writeModsFile(home, state);
  return { applied, file };
}

/** Takes the changes back, so the menu asks again. */
export function clearPending(home) {
  const path = pendingPath(home);
  if (!existsSync(path)) return null;
  writeFileSync(path, JSON.stringify({ schema: 1, changes: [] }, null, 2) + "\n");
  return path;
}
