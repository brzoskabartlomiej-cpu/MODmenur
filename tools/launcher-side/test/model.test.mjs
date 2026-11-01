//! The shared cases: the same ones `tests/model.rs` runs against the Rust
//! model, so both are held to the same rules.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { clean, matching, pageCount, parse, row, wrap } from "../lib/model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "..", "tests", "fixtures");

function fixture(name) {
  return readFileSync(join(fixtures, name));
}

const spec = JSON.parse(fixture("spec.json"));

test("the feed is read and sorted by name", () => {
  const feed = parse(fixture(spec.feed));
  assert.equal(feed.schema, 2);
  assert.equal(feed.mods.length, 25);
  assert.equal(feed.mods[0].name, "Alpha Mod");
});

test("the first feed schema still reads", () => {
  const feed = parse(fixture("feed-schema1.json"));
  assert.equal(feed.schema, 1);
  assert.equal(feed.mods.length, 25);
  assert.equal(feed.mods[0].description, "");
});

test("a broken or newer feed is not an empty installation", () => {
  assert.throws(() => parse("{}"), /could not be read/);
  assert.throws(() => parse('{"schema":3,"mods":[]}'), /newer Mod Menu/);
  assert.throws(() => parse("not json"), /could not be read/);
  assert.throws(() => parse(" ".repeat((1 << 20) + 1)), /too large/);
});

test("the shared cases hold", () => {
  const feed = parse(fixture(spec.feed));
  for (const testCase of spec.cases) {
    const ids = matching(feed.mods, testCase.filter, testCase.query).map((mod) => mod.id);
    assert.deepEqual(ids, testCase.expectedIds, testCase.name);
  }
});

test("the pages keep every mod reachable", () => {
  const feed = parse(fixture(spec.feed));
  const all = matching(feed.mods, "All", "");
  assert.equal(all.length, spec.pages.total);
  assert.equal(pageCount(all.length, spec.pageSize), spec.pages.pageCount);
  assert.deepEqual(
    all.slice(0, spec.pageSize).map((mod) => mod.id),
    spec.pages.firstPage,
  );
  assert.deepEqual(
    all.slice(spec.pageSize).map((mod) => mod.id),
    spec.pages.secondPage,
  );
});

test("a row says the name, the version and the state", () => {
  const feed = parse(fixture(spec.feed));
  const alpha = feed.mods.find((mod) => mod.id === "alpha");
  assert.equal(row(alpha), "Alpha Mod 1.0.0 [On]");
  const broken = feed.mods.find((mod) => mod.id === "broken");
  assert.match(row(broken), /\[Invalid\]$/);
});

test("a name may not break the row or colour it", () => {
  assert.equal(clean("One\nTwo§c"), "OneTwoc");
  assert.equal([...clean("界".repeat(500))].length, 180);
});

test("a description is wrapped into lines a menu can show", () => {
  const lines = wrap("Adds a block and a recipe to the game, so the world has more to do.", 20, 3);
  assert.ok(lines.length <= 3);
  for (const line of lines) assert.ok([...line].length <= 20, line);
  assert.equal(wrap("", 20, 3).length, 0);
});
