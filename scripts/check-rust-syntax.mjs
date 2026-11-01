#!/usr/bin/env node
//! Parses the mod's Rust sources, so a typo is caught without a Rust
//! toolchain.
//!
//! This is a syntax check, not a compile: it says the files parse as Rust,
//! not that they build. `cargo test` and `cargo horizon-mod build` are what
//! say they build.
//!
//! ```sh
//! npm install          # tree-sitter, for the check
//! node scripts/check-rust-syntax.mjs
//! ```

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

let Parser;
let Rust;
try {
  Parser = (await import("tree-sitter")).default;
  Rust = (await import("tree-sitter-rust")).default;
} catch {
  console.log("SKIP: tree-sitter is not installed. Run `npm install` for this check.");
  process.exit(0);
}

const parser = new Parser();
parser.setLanguage(Rust);

const files = [];
for (const dir of ["src", "tests", join("tools", "sandbox", "src")]) {
  const path = join(root, dir);
  if (!existsSync(path)) continue;
  for (const name of readdirSync(path)) {
    if (name.endsWith(".rs")) files.push(join(path, name));
  }
}

let problems = 0;
for (const file of files) {
  const tree = parser.parse(readFileSync(file, "utf8"));
  const errors = [];
  const walk = (node) => {
    if (node.type === "ERROR" || node.isMissing) {
      errors.push(`${node.type} at ${node.startPosition.row + 1}:${node.startPosition.column + 1}`);
    }
    for (const child of node.children) walk(child);
  };
  walk(tree.rootNode);
  const where_ = file.slice(root.length + 1);
  if (errors.length) {
    problems += errors.length;
    console.log(`FAIL ${where_}`);
    for (const error of errors) console.log(`  ${error}`);
  } else {
    console.log(`ok   ${where_}`);
  }
}

console.log(`\n${files.length} file(s), ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
