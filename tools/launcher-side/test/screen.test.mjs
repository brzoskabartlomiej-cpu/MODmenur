//! The menu's screen, drawn as text: what the player reads.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parse } from "../lib/model.mjs";
import { FILTER_BUTTON, LIST, TOGGLE, render, widgets } from "../lib/screen.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "..", "tests", "fixtures");
const feed = parse(readFileSync(join(fixtures, "feed-schema2.json")));

function state(over = {}) {
  return {
    mods: feed.mods,
    filter: "All",
    query: "",
    page: 0,
    selected: null,
    pageSize: 20,
    pending: [],
    error: null,
    ...over,
  };
}

test("the screen opens with the list and the counts", () => {
  const text = render(state());
  assert.match(text, /^25 installed \| 12 enabled/);
  assert.match(text, /Changes apply on the next launch\./);
  assert.match(text, /\[ Show: All mods \]/);
  assert.match(text, /Page 1 \/ 2/);
  assert.match(text, /\[ Refresh installed mods \]/);
});

test("the list holds a page of rows", () => {
  const list = widgets(state()).find((widget) => widget.kind === "list");
  assert.equal(list.id, LIST);
  assert.equal(list.rows.length, 20);
  assert.ok(list.rows[0].startsWith("Alpha Mod 1.0.0 [On]"));
});

test("the filter and the search narrow the list", () => {
  const enabled = widgets(state({ filter: "Enabled" })).find((w) => w.kind === "list");
  assert.equal(enabled.rows.length, 12);
  const searched = widgets(state({ query: "vein" })).find((w) => w.kind === "list");
  assert.equal(searched.rows.length, 1);
  assert.ok(searched.rows[0].includes("Veinminer"));
  assert.match(render(state({ query: "vein" })), /\[ Clear search \]/);
});

test("a picked mod shows its page", () => {
  const text = render(state({ selected: 0 }));
  assert.match(text, /ID: alpha \| Type: Sandboxed/);
  assert.match(text, /Authors: Ann/);
  assert.match(text, /May: registries/);
  assert.match(text, /Status: On/);
  assert.match(text, /\[ Disable Alpha Mod \]/);
});

test("a mod that is off is asked to be enabled", () => {
  const text = render(state({ selected: 1 }));
  assert.match(text, /\[ Enable Beta Mod \]/);
});

test("what the player asked for is said", () => {
  const text = render(
    state({ selected: 0, pending: [{ id: "alpha", enabled: false }] }),
  );
  assert.match(text, /1 change\(s\) waiting for the launcher/);
  assert.match(text, /Waiting: turn Alpha Mod off/);
});

test("a broken feed is said to be broken", () => {
  const text = render(state({ error: "No inventory feed. Update the launcher, then reopen the game." }));
  assert.match(text, /No inventory feed/);
});

test("the buttons are the ones the menu answers to", () => {
  const ids = widgets(state({ selected: 0 })).filter((w) => w.kind === "button").map((w) => w.id);
  assert.ok(ids.includes(FILTER_BUTTON));
  assert.ok(ids.includes(TOGGLE));
});
