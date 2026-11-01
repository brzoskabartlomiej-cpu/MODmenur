//! What the launcher-side tools make of an instance: the mods it has, the
//! feed the menu reads and the changes the player asked for.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { applyPending, readModsFile, writeModsFile } from "../lib/apply.mjs";
import { buildFeed, feedPath, writeFeed } from "../lib/feed.mjs";
import { parse } from "../lib/model.mjs";
import { scan } from "../lib/scan.mjs";
import { manifest, tempDir, writeZip } from "./helpers.mjs";

/** An instance with one mod of every kind, one that is broken and one the
 *  launcher put there. */
function instance() {
  const home = tempDir("instance");
  mkdirSync(join(home, "horizon-mods"), { recursive: true });
  mkdirSync(join(home, "horizon-native-mods"), { recursive: true });

  writeFileSync(
    join(home, "horizon-mods", "alpha.hmod"),
    writeZip({
      "horizon-mod.toml": manifest({
        id: "alpha",
        name: "Alpha Mod",
        version: "1.0.0",
        description: "Adds a block.",
        authors: ["Ann"],
        capabilities: ["game-read", "hud"],
      }),
      "mod.wasm": "\0asm not really",
    }),
  );

  mkdirSync(join(home, "horizon-mods", "beta"), { recursive: true });
  writeFileSync(
    join(home, "horizon-mods", "beta", "horizon-mod.toml"),
    manifest({
      id: "beta",
      name: "Beta Mod",
      version: "2.0.0",
      capabilities: ["registries"],
    }),
  );

  writeFileSync(
    join(home, "horizon-mods", "broken.hmod"),
    writeZip({ "readme.txt": "no manifest here" }),
  );

  writeFileSync(
    join(home, "horizon-native-mods", "veinminer.hnmod"),
    writeZip({
      "horizon-native.json": JSON.stringify({
        schema: 1,
        id: "veinminer",
        version: "0.3.0",
        game: "26.3",
      }),
      "mixins/veinminer/horizon-mixin.toml": '[mod]\nid = "veinminer"\nversion = "0.3.0"\n',
    }),
  );

  writeFileSync(
    join(home, "horizon-mods.txt"),
    "mod.alpha:true\nmod.veinminer:false\nkey.alpha.open:key.keyboard.k\n",
  );

  writeFileSync(
    join(home, "mod-browser.json"),
    JSON.stringify({
      entries: [
        {
          source: "Modrinth",
          project: "alpha",
          slug: "alpha",
          title: "Alpha Mod",
          kind: "mod",
          version: "1.0.0",
          number: "1",
          file: "horizon-mods/alpha.hmod",
          checksum: "",
          page: "",
        },
      ],
    }),
  );

  return home;
}

test("the instance's mods are found, with their kind and state", () => {
  const home = instance();
  const { mods } = scan(home);
  const ids = mods.map((mod) => mod.id);
  // The broken mod has no id: its manifest is what says which mod it is.
  assert.deepEqual(ids, ["alpha", "beta", "", "veinminer"]);

  const alpha = mods.find((mod) => mod.id === "alpha");
  assert.equal(alpha.kind, "Sandboxed");
  assert.equal(alpha.enabled, true);
  assert.equal(alpha.description, "Adds a block.");
  assert.deepEqual(alpha.authors, ["Ann"]);
  assert.equal(alpha.source, "Modrinth");

  const beta = mods.find((mod) => mod.id === "beta");
  assert.equal(beta.kind, "Content");
  assert.equal(beta.enabled, false);
  assert.equal(beta.source, "Local file");

  const broken = mods.find((mod) => mod.name === "broken.hmod");
  // A mod whose manifest cannot be read stays visible, with the file's name
  // and the reason, the way the game's own Mods page shows it.
  assert.equal(broken.id, "");
  assert.match(broken.problem, /^Can't be read: horizon-mod.toml: missing/);

  const native = mods.find((mod) => mod.id === "veinminer");
  assert.equal(native.kind, "Native");
  assert.equal(native.version, "0.3.0");
  assert.equal(native.enabled, false);
});

test("the feed the menu reads holds every mod", () => {
  const home = instance();
  const { mods } = scan(home);
  const feed = buildFeed(mods);
  assert.equal(feed.schema, 2);
  assert.equal(feed.mods.length, 4);

  const path = writeFeed(home, feed);
  assert.equal(path, feedPath(home));
  assert.ok(existsSync(path));

  // What the menu reads is what was written.
  const read = parse(readFileSync(path));
  assert.equal(read.mods.length, 4);
  assert.equal(read.mods.find((mod) => mod.id === "alpha").enabled, true);
  assert.ok(read.mods.find((mod) => mod.name === "broken.hmod").problem);
});

test("the feed is written where a sandboxed mod may read it", () => {
  const home = instance();
  const { mods } = scan(home);
  writeFeed(home, buildFeed(mods));
  const path = feedPath(home);
  assert.ok(path.endsWith(join("horizon-mods", ".horizon-mod-data", "mod_menu", "inventory.json")));
});

test("the changes the player asked for are applied the way the game writes them", () => {
  const home = instance();
  const pending = join(home, "horizon-mods", ".horizon-mod-data", "mod_menu");
  mkdirSync(pending, { recursive: true });
  writeFileSync(
    join(pending, "pending.json"),
    JSON.stringify({
      schema: 1,
      changes: [
        { id: "beta", enabled: true },
        { id: "veinminer", enabled: false },
        { id: "alpha", enabled: false },
      ],
    }),
  );

  const { applied } = applyPending(home);
  assert.equal(applied.length, 3);

  const text = readFileSync(join(home, "horizon-mods.txt"), "utf8");
  // A native mod that is off has its own line, so the launcher's next build
  // leaves it out.
  assert.match(text, /^mod\.veinminer:false$/m);
  // A mod that is on has the line the game reads.
  assert.match(text, /^mod\.beta:true$/m);
  // A mod that is off has no line at all.
  assert.doesNotMatch(text, /^mod\.alpha:/m);
  // The keys the player chose are kept.
  assert.match(text, /^key\.alpha\.open:key\.keyboard\.k$/m);
});

test("a native mod that is turned on again is on for the launcher's build", () => {
  const home = instance();
  const state = readModsFile(home);
  state.disabled.delete("veinminer");
  state.enabled.add("veinminer");
  writeModsFile(home, state);
  const text = readFileSync(join(home, "horizon-mods.txt"), "utf8");
  assert.match(text, /^mod\.veinminer:true$/m);
  assert.doesNotMatch(text, /^mod\.veinminer:false$/m);
});

test("the file is written the way the game writes it", () => {
  const home = tempDir("mods-file");
  const state = readModsFile(home);
  assert.equal(state.enabled.size, 0);
  state.enabled.add("b");
  state.enabled.add("a");
  state.disabled.add("c");
  state.keys.set("a", new Map([["open", "key.keyboard.k"]]));
  writeModsFile(home, state);
  assert.equal(
    readFileSync(join(home, "horizon-mods.txt"), "utf8"),
    "mod.a:true\nmod.b:true\nmod.c:false\nkey.a.open:key.keyboard.k\n",
  );
});

test("the feed may go beside a dev build, whose storage is next to it", () => {
  const home = instance();
  const { mods } = scan(home);
  // A mod run as `--dev-mod target/horizon-mod/mod_menu.hmod` keeps its
  // storage beside that file, not in the instance.
  const dev = tempDir("dev");
  const path = writeFeed(home, buildFeed(mods), dev);
  assert.equal(
    path,
    join(dev, ".horizon-mod-data", "mod_menu", "inventory.json"),
  );
  assert.ok(existsSync(path));
});
