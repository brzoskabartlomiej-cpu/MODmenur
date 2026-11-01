#!/usr/bin/env node
//! Runs the shared cases: the behaviour the menu has, checked without a
//! Rust toolchain.
//!
//! The cases in `tests/fixtures/spec.json` are what `tests/model.rs` runs
//! against the Rust model and what `tools/launcher-side/test/model.test.mjs`
//! runs against the JavaScript one. This runs them and says what they were.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { matching, pageCount, parse } from "../tools/launcher-side/lib/model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const fixtures = join(root, "tests", "fixtures");

const spec = JSON.parse(readFileSync(join(fixtures, "spec.json"), "utf8"));
const feed = parse(readFileSync(join(fixtures, spec.feed)));

let failures = 0;
for (const testCase of spec.cases) {
  const ids = matching(feed.mods, testCase.filter, testCase.query).map((mod) => mod.id);
  const same = JSON.stringify(ids) === JSON.stringify(testCase.expectedIds);
  if (!same) failures += 1;
  console.log(`${same ? "ok  " : "FAIL"} ${testCase.name}`);
  if (!same) {
    console.log(`  expected: ${testCase.expectedIds.join(", ")}`);
    console.log(`  got:      ${ids.join(", ")}`);
  }
}

const all = matching(feed.mods, "All", "");
const pages = pageCount(all.length, spec.pageSize);
const pagesOk = pages === spec.pages.pageCount && all.length === spec.pages.total;
if (!pagesOk) failures += 1;
console.log(`${pagesOk ? "ok  " : "FAIL"} ${all.length} mods over ${pages} page(s)`);

console.log(`\n${spec.cases.length + 1} case(s), ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
