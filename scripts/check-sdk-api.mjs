#!/usr/bin/env node
//! Checks that every Horizon SDK call this mod makes exists.
//!
//! The mod is Rust and cannot be compiled here, so this reads the mod's
//! sources and the SDK's contract (the WIT file and the SDK's own source)
//! and holds them against each other: a call the SDK does not have is a
//! compile error waiting to happen.
//!
//! ```sh
//! HORIZON_SRC=/path/to/horizon node scripts/check-sdk-api.mjs
//! ```

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

/** Where Horizon's source may be. */
const candidates = [
  process.env.HORIZON_SRC,
  "/tmp/horizon-upstream",
  resolve(root, "..", "horizon"),
  resolve(root, "..", "horizon-rust", "horizon"),
].filter(Boolean);

const source = candidates.find((path) =>
  existsSync(join(path, "crates", "horizon-mod-sdk", "wit", "horizon.wit")),
);

if (!source) {
  console.log(
    "SKIP: no Horizon source found. Set HORIZON_SRC to a checkout of\n" +
      "      https://github.com/horizon-rust/horizon to check the SDK calls.",
  );
  process.exit(0);
}

const wit = readFileSync(join(source, "crates", "horizon-mod-sdk", "wit", "horizon.wit"), "utf8");
const sdk = readFileSync(join(source, "crates", "horizon-mod-sdk", "src", "lib.rs"), "utf8");

const contract = parseWitness(wit);
const exports = parseExports(sdk);

const problems = [];
const checked = [];

/** The Rust sources of the mod. */
function rustSources() {
  const files = [];
  for (const dir of ["src", "tests", join("tools", "sandbox", "src")]) {
    const path = join(root, dir);
    if (!existsSync(path)) continue;
    for (const name of readdirSync(path)) {
      if (name.endsWith(".rs")) files.push(join(path, name));
    }
  }
  return files;
}

for (const file of rustSources()) {
  const text = readFileSync(file, "utf8");
  const where_ = file.slice(root.length + 1);

  // horizon_mod_sdk::ui::open_screen(...)
  for (const match of text.matchAll(/horizon_mod_sdk::(\w+)::(\w+)/g)) {
    const [, module, fn] = match;
    checked.push(`${where_}: ${module}::${fn}`);
    const iface = contract.interfaces.get(module);
    if (!iface) {
      problems.push(`${where_}: the SDK has no interface '${module}'`);
    } else if (!iface.functions.has(fn)) {
      problems.push(
        `${where_}: '${module}' has no function '${fn}' (it has ${[...iface.functions].join(", ")})`,
      );
    }
  }

  // use horizon_mod_sdk::{Mod, Registration, input, storage, ui::{ButtonWidget, ...}}
  for (const match of text.matchAll(/use horizon_mod_sdk::(\{[^;]*?\});/g)) {
    for (const leaf of parseImports(match[1])) {
      if (leaf.name === "self") continue;
      checked.push(`${where_}: ${leaf.module ? `${leaf.module}::` : ""}${leaf.name}`);
      if (leaf.module) {
        const iface = contract.interfaces.get(leaf.module);
        if (!iface) {
          problems.push(`${where_}: the SDK has no interface '${leaf.module}'`);
        } else if (!iface.records.has(pascal(leaf.name))) {
          problems.push(
            `${where_}: '${leaf.module}' has no '${leaf.name}' (it has ${[...iface.records].join(", ")})`,
          );
        }
      } else if (!exports.has(leaf.name)) {
        problems.push(`${where_}: the SDK exports no '${leaf.name}'`);
      }
    }
  }

  // A record literal: TextWidget { id, text, color }
  for (const match of text.matchAll(/\b([A-Z]\w*Widget|Screen)\s*\{([^}]*)\}/g)) {
    const [, record, body] = match;
    const fields = contract.recordFields.get(record);
    if (!fields) continue;
    for (const field of body.split(",")) {
      const name = field.split(":")[0].trim();
      if (!name || name.startsWith("//")) continue;
      checked.push(`${where_}: ${record}.${name}`);
      if (!fields.has(name)) {
        problems.push(
          `${where_}: '${record}' has no field '${name}' (it has ${[...fields].join(", ")})`,
        );
      }
    }
  }
}

// The trait the mod implements, and what it asks for.
const traitMethods = [...sdk.matchAll(/fn (\w+)\s*\(/g)].map((match) => match[1]);
for (const method of [
  "init",
  "tick",
  "frame",
  "command",
  "chat",
  "ui_select",
  "ui_closed",
  "ui_settings_opened",
]) {
  checked.push(`Mod::${method}`);
  if (!traitMethods.includes(method)) {
    problems.push(`the SDK's Mod trait has no '${method}'`);
  }
}
for (const method of ["command", "on_tick", "on_frame", "on_chat"]) {
  checked.push(`Registration::${method}`);
  if (!new RegExp(`pub fn ${method}\\b`).test(sdk)) {
    problems.push(`the SDK's Registration has no '${method}'`);
  }
}

console.log(`Horizon source: ${source}`);
console.log(`checked ${checked.length} SDK use(s) in the mod's sources`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}
console.log("every SDK call the mod makes exists");

/** The interfaces, their functions and their records, from the WIT. */
function parseWitness(text) {
  const interfaces = new Map();
  const recordFields = new Map();
  let current = null;
  let record = null;
  let variant = null;
  let fields = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const iface = trimmed.match(/^interface (\w+)\s*\{/);
    if (iface) {
      current = iface[1];
      interfaces.set(current, { functions: new Set(), records: new Set() });
      continue;
    }
    if (!current) continue;
    if (trimmed.startsWith("}")) {
      if (record) {
        record = null;
        fields = null;
      } else if (variant) {
        variant = null;
      } else {
        current = null;
      }
      continue;
    }
    const rec = trimmed.match(/^record ([\w-]+)\s*\{/);
    if (rec) {
      record = rec[1];
      fields = new Set();
      recordFields.set(record, fields);
      interfaces.get(current).records.add(pascal(record));
      continue;
    }
    const var_ = trimmed.match(/^variant ([\w-]+)\s*\{/);
    if (var_) {
      variant = var_[1];
      interfaces.get(current).records.add(pascal(variant));
      continue;
    }
    if (record) {
      const field = trimmed.match(/^([a-z][\w-]*)\s*:/);
      if (field) fields.add(snake(field[1]));
      continue;
    }
    const func = trimmed.match(/^([a-z][\w-]*)\s*:/);
    if (func && !trimmed.startsWith("variant")) {
      interfaces.get(current).functions.add(snake(func[1]));
    }
  }
  return { interfaces, recordFields };
}

/** What the SDK's own source exports. */
function parseExports(text) {
  const names = new Set();
  for (const match of text.matchAll(/pub use [^;]+;/g)) {
    const statement = match[0];
    const braces = statement.match(/\{([^}]*)\}/);
    if (braces) {
      for (const name of braces[1].split(",")) {
        const clean = name.trim();
        if (clean) names.add(clean.split("::").pop());
      }
    } else {
      const path = statement.replace(/^pub use /, "").replace(/;$/, "").trim();
      names.add(path.split("::").pop());
    }
  }
  for (const match of text.matchAll(/pub (?:trait|struct|fn|mod) (\w+)/g)) names.add(match[1]);
  return names;
}

/** The names in a `use` list, with the module they came from. */
function parseImports(text) {
  const leaves = [];
  let index = 0;

  function parseList(module) {
    while (index < text.length) {
      while (index < text.length && /[\s,]/.test(text[index])) index += 1;
      if (index >= text.length) return;
      if (text[index] === "}") {
        index += 1;
        return;
      }
      let name = "";
      while (index < text.length && /[\w:]/.test(text[index])) {
        name += text[index];
        index += 1;
      }
      while (index < text.length && /\s/.test(text[index])) index += 1;
      if (text[index] === "{") {
        index += 1;
        parseList(name.replace(/::$/, "") || module);
      } else if (name) {
        leaves.push({ module, name });
      }
    }
  }

  parseList(null);
  return leaves;
}

/** A WIT name in Rust's spelling. */
function snake(name) {
  return name.replace(/-/g, "_");
}

/** A WIT name in Rust's spelling of a type. */
function pascal(name) {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
