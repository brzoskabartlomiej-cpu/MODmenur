//! The TOML reader the tools use for a mod's manifest.

import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "../lib/toml.mjs";

test("a manifest is read", () => {
  const text = [
    'id = "alpha"',
    'name = "Alpha Mod"',
    'version = "1.0.0"',
    'description = "Adds a block."',
    'authors = ["Ann", "Ben"]',
    'api = "0.1"',
    'side = "client"',
    'capabilities = ["game-read", "hud"]',
    "",
  ].join("\n");
  const manifest = parse(text);
  assert.equal(manifest.id, "alpha");
  assert.equal(manifest.name, "Alpha Mod");
  assert.equal(manifest.description, "Adds a block.");
  assert.deepEqual(manifest.authors, ["Ann", "Ben"]);
  assert.deepEqual(manifest.capabilities, ["game-read", "hud"]);
  assert.equal(manifest.side, "client");
});

test("a comment is not read", () => {
  const manifest = parse('id = "alpha" # the id\nname = "A # B"\n');
  assert.equal(manifest.id, "alpha");
  assert.equal(manifest.name, "A # B");
});

test("an array may run over several lines", () => {
  const manifest = parse('capabilities = [\n  "game-read",\n  "hud",\n]\n');
  assert.deepEqual(manifest.capabilities, ["game-read", "hud"]);
});

test("a section is read on its own", () => {
  const manifest = parse('[mod]\nid = "veinminer"\nversion = "0.3.0"\n[compatibility]\nhorizon_revision = "abc"\n');
  assert.equal(manifest.mod.id, "veinminer");
  assert.equal(manifest.mod.version, "0.3.0");
  assert.equal(manifest.compatibility.horizon_revision, "abc");
});
