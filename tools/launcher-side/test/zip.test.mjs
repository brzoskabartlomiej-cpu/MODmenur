//! The ZIP reader the tools use for a `.hmod` and a `.hnmod`.

import assert from "node:assert/strict";
import test from "node:test";

import * as zip from "../lib/zip.mjs";
import { writeZip } from "./helpers.mjs";

test("an entry is read back", () => {
  const bytes = writeZip({
    "horizon-mod.toml": 'id = "alpha"\n',
    "mod.wasm": "\0asm not really",
  });
  assert.equal(zip.read(bytes, "horizon-mod.toml").toString("utf8"), 'id = "alpha"\n');
  assert.equal(zip.names(bytes).length, 2);
  assert.ok(zip.names(bytes).includes("horizon-mod.toml"));
});

test("an entry that is not there is nothing", () => {
  const bytes = writeZip({ "horizon-mod.toml": "id = \"alpha\"\n" });
  assert.equal(zip.read(bytes, "missing.toml"), null);
});

test("a file that is not a ZIP says so", () => {
  assert.throws(() => zip.read(Buffer.from("not a zip"), "x"), /not a ZIP/);
});
