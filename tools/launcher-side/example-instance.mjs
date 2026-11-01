#!/usr/bin/env node
//! Makes a small instance to try the tools on, with a mod of every kind.
//!
//! ```sh
//! node tools/launcher-side/example-instance.mjs /tmp/horizon-demo
//! node tools/launcher-side/modmenur.mjs menu /tmp/horizon-demo --select 0
//! ```
//!
//! Nothing here is a real mod: the `.hmod` and `.hnmod` files hold a
//! manifest and nothing else, which is all the tools read.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const home = process.argv[2] ?? join(mkdtempSync(join(tmpdir(), "horizon-demo-")), "Horizon");
mkdirSync(join(home, "horizon-mods"), { recursive: true });
mkdirSync(join(home, "horizon-native-mods"), { recursive: true });

/** A ZIP file with the given entries. */
function zip(target, files) {
  const dir = mkdtempSync(join(tmpdir(), "horizon-zip-"));
  for (const [name, text] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  execFileSync("zip", ["-q", "-r", "-X", target, "."], { cwd: dir });
}

zip(join(home, "horizon-mods", "veinminer.hmod"), {
  "horizon-mod.toml": [
    'id = "veinminer"',
    'name = "Veinminer"',
    'version = "0.3.0"',
    'description = "Breaks a whole vein at once, so mining is quicker."',
    'authors = ["Cy"]',
    'api = "0.1"',
    'capabilities = ["game-read", "hud"]',
    "",
  ].join("\n"),
  "mod.wasm": "\0asm",
});

zip(join(home, "horizon-mods", "coords_hud.hmod"), {
  "horizon-mod.toml": [
    'id = "coords_hud"',
    'name = "Coordinates HUD"',
    'version = "0.1.0"',
    'description = "Shows the position in the corner of the screen."',
    'authors = ["Ann"]',
    'api = "0.1"',
    'capabilities = ["hud"]',
    "",
  ].join("\n"),
  "mod.wasm": "\0asm",
});

mkdirSync(join(home, "horizon-mods", "towns_and_towers"), { recursive: true });
writeFileSync(
  join(home, "horizon-mods", "towns_and_towers", "horizon-mod.toml"),
  [
    'id = "towns_and_towers"',
    'name = "Towns and Towers"',
    'version = "2.4.1"',
    'description = "Adds towns and towers to the world."',
    'authors = ["Kaisyn"]',
    'api = "0.2"',
    'capabilities = ["registries"]',
    "",
  ].join("\n"),
);

zip(join(home, "horizon-native-mods", "zoom.hnmod"), {
  "horizon-native.json": JSON.stringify({
    schema: 1,
    id: "zoom",
    version: "0.2.0",
    game: "26.3",
  }),
  "mixins/zoom/horizon-mixin.toml": '[mod]\nid = "zoom"\nversion = "0.2.0"\n',
});

// What the launcher would have written: which mods are on, and where it
// got them.
writeFileSync(join(home, "horizon-mods.txt"), "mod.veinminer:true\n");
writeFileSync(
  join(home, "mod-browser.json"),
  JSON.stringify({
    entries: [
      {
        source: "Modrinth",
        project: "veinminer",
        slug: "veinminer",
        title: "Veinminer",
        kind: "mod",
        version: "0.3.0",
        number: "1",
        file: "horizon-mods/veinminer.hmod",
        checksum: "",
        page: "",
      },
      {
        source: "Horizon",
        project: "coords_hud",
        slug: "coords_hud",
        title: "Coordinates HUD",
        kind: "mod",
        version: "0.1.0",
        number: "1",
        file: "horizon-mods/coords_hud.hmod",
        checksum: "",
        page: "",
      },
    ],
  }),
);

console.log(home);
