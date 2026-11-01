//! What an instance has installed.
//!
//! The rules are Horizon's own: a mod is a `.hmod` file or a folder with a
//! `horizon-mod.toml` in `horizon-mods/`, a native mod is a `.hnmod` in
//! `horizon-native-mods/`, and whether a mod is on is the `mod.<id>:true`
//! line in `horizon-mods.txt` beside `options.txt`.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

import * as toml from "./toml.mjs";
import * as zip from "./zip.mjs";

/** The folder holding the mods, beside `options.txt`. */
export const MODS_DIR = "horizon-mods";
/** The folder the launcher installs native mods in. */
export const NATIVE_DIR = "horizon-native-mods";
/** The file that says which mods are on. */
export const MODS_FILE = "horizon-mods.txt";
/** Where a mod keeps what it saves. */
export const STORAGE_DIR = ".horizon-mod-data";
/** A mod's manifest. */
export const MANIFEST = "horizon-mod.toml";
/** A mod's code. */
export const WASM = "mod.wasm";
/** What the launcher's browser installed, and where it came from. */
export const BROWSER_FILE = "mod-browser.json";

/** What the file `horizon-mods.txt` says. */
export function readModsFile(home) {
  const enabled = new Set();
  const disabled = new Set();
  let text = "";
  try {
    text = readFileSync(join(home, MODS_FILE), "utf8");
  } catch {
    return { enabled, disabled };
  }
  for (const line of text.split(/\r?\n/)) {
    const split = line.indexOf(":");
    if (split < 0) continue;
    const key = line.slice(0, split).trim();
    const value = line.slice(split + 1).trim();
    if (!key.startsWith("mod.")) continue;
    const id = key.slice("mod.".length);
    if (value === "true") enabled.add(id);
    else if (value === "false") disabled.add(id);
  }
  return { enabled, disabled };
}

/** What the launcher's browser installed, by file. */
export function readBrowser(home) {
  const byFile = new Map();
  let text = "";
  try {
    text = readFileSync(join(home, BROWSER_FILE), "utf8");
  } catch {
    return byFile;
  }
  let entries = [];
  try {
    entries = JSON.parse(text).entries ?? [];
  } catch {
    return byFile;
  }
  for (const entry of entries) {
    if (entry && typeof entry.file === "string") byFile.set(entry.file, entry);
  }
  return byFile;
}

/** The mods of an instance, in the order the list shows them. */
export function scan(home) {
  const state = readModsFile(home);
  const browser = readBrowser(home);
  const mods = [];

  for (const path of findPackages(join(home, MODS_DIR))) {
    mods.push(readPackage(home, path, state, browser));
  }
  for (const path of findNative(join(home, NATIVE_DIR))) {
    mods.push(readNative(home, path, state, browser));
  }
  mods.sort((a, b) => {
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { mods };
}

/** The `.hmod` files and mod folders in a folder, by name. */
export function findPackages(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".hmod")) {
      found.push(path);
    } else if (entry.isDirectory() && existsSync(join(path, MANIFEST))) {
      found.push(path);
    }
  }
  return found.sort();
}

/** The `.hnmod` files in a folder, by name. */
export function findNative(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".hnmod"))
      .sort()
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

/** A mod in `horizon-mods/`. */
function readPackage(home, path, state, browser) {
  const file = basename(path);
  const isFolder = statSync(path).isDirectory();
  let manifest = null;
  let problem = null;
  try {
    const text = isFolder
      ? readFileSync(join(path, MANIFEST), "utf8")
      : zip.read(readFileSync(path), MANIFEST)?.toString("utf8");
    if (text === undefined || text === null) {
      throw new Error(`${MANIFEST}: missing`);
    }
    manifest = toml.parse(text);
  } catch (error) {
    problem = `Can't be read: ${error.message}`;
  }
  const id = manifest ? String(manifest.id ?? "") : "";
  const name = manifest?.name ? String(manifest.name) : file;
  const capabilities = manifest?.capabilities ? manifest.capabilities.map(String) : [];
  let kind = capabilities.includes("registries") ? "Content" : "Sandboxed";
  if (manifest && !problem) {
    const hasCode = isFolder
      ? existsSync(join(path, WASM))
      : zip.read(readFileSync(path), WASM) !== null;
    if (!hasCode && !capabilities.includes("registries")) {
      problem = `Can't be read: ${WASM}: missing (only a content mod, with capability registries, may have no code)`;
    } else if (hasCode) {
      kind = "Sandboxed";
    }
  }
  const entry = browser.get(relative(home, path));
  return {
    id,
    name,
    version: manifest?.version ? String(manifest.version) : (entry?.version ?? ""),
    kind,
    enabled: state.enabled.has(id),
    description: manifest?.description ? String(manifest.description) : "",
    authors: manifest?.authors ? manifest.authors.map(String) : [],
    capabilities,
    source: entry?.source ? String(entry.source) : "Local file",
    problem,
    file: relative(home, path),
  };
}

/** A native mod in `horizon-native-mods/`. */
function readNative(home, path, state, browser) {
  const file = basename(path);
  let id = "";
  let version = "";
  let description = "";
  let problem = null;
  try {
    const bytes = zip.read(readFileSync(path), "horizon-native.json");
    if (!bytes) throw new Error("horizon-native.json: missing");
    const manifest = JSON.parse(bytes.toString("utf8"));
    id = String(manifest.id ?? "");
    version = String(manifest.version ?? "");
  } catch (error) {
    problem = `Can't be read: ${error.message}`;
  }
  try {
    const mixin = zip.read(readFileSync(path), `mixins/${id}/horizon-mixin.toml`);
    if (mixin) {
      const parsed = toml.parse(mixin.toString("utf8"));
      description = String(parsed.mod?.description ?? parsed.description ?? "");
      if (!version && parsed.mod?.version) version = String(parsed.mod.version);
    }
  } catch {
    // The bundle's own manifest is what counts; the mixin's is a bonus.
  }
  const entry = browser.get(relative(home, path));
  return {
    id,
    name: id || file,
    version,
    kind: "Native",
    enabled: state.enabled.has(id),
    description,
    authors: [],
    capabilities: [],
    source: entry?.source ? String(entry.source) : "Local file",
    problem,
    file: relative(home, path),
  };
}
