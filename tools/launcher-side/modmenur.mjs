#!/usr/bin/env node
//! The launcher-side half of Mod Menu for Horizon.
//!
//! The menu is a sandboxed mod: it may read its own storage folder and
//! nothing else. This writes what it reads there, and applies what it
//! asks for.
//!
//! ```sh
//! node modmenur.mjs scan  <instance>          # what the instance has installed
//! node modmenur.mjs feed  <instance> [--write] # the feed the menu reads
//! node modmenur.mjs apply <instance>           # apply the changes the player asked for
//! ```
//!
//! `<instance>` is the game folder: the one with `options.txt` and
//! `horizon-mods/` in it.

import { resolve } from "node:path";

import { applyPending, clearPending, pendingPath, readPending } from "./lib/apply.mjs";
import { buildFeed, feedPath, writeFeed } from "./lib/feed.mjs";
import { row } from "./lib/model.mjs";
import { scan } from "./lib/scan.mjs";
import { render } from "./lib/screen.mjs";

const [, , command, ...rest] = process.argv;

function usage() {
  console.log(
    [
      "Mod Menu for Horizon, launcher side.",
      "",
      "  scan  <instance>            what the instance has installed",
      "  feed  <instance> [--write]  the feed the menu reads",
      "  apply <instance>            apply the changes the player asked for",
      "  menu  <instance>            the menu's screen, as the game draws it",
      "",
      "The menu's screen takes --search <text>, --filter All|Enabled|Disabled,",
      "--page <n> and --select <n>.",
    ].join("\n"),
  );
}

if (!command || !["scan", "feed", "apply", "menu"].includes(command)) {
  usage();
  process.exit(command ? 1 : 0);
}

const home = resolve(rest[0] ?? process.cwd());
const flags = new Set(rest.slice(1));

if (command === "scan") {
  const { mods } = scan(home);
  for (const mod of mods) {
    const state = mod.problem ? "problem" : mod.enabled ? "on" : "off";
    console.log(
      `${row(mod).padEnd(34)} ${state.padEnd(8)} ${mod.kind.padEnd(10)} ${mod.file}`,
    );
    if (mod.problem) console.log(`  ${mod.problem}`);
  }
  console.log(`\n${mods.length} mod(s) in ${home}`);
}

if (command === "feed") {
  const { mods } = scan(home);
  const feed = buildFeed(mods);
  if (flags.has("--write")) {
    const path = writeFeed(home, feed);
    console.log(`wrote ${path}`);
  } else {
    console.log(JSON.stringify(feed, null, 2));
  }
}

if (command === "apply") {
  const { applied, file } = applyPending(home);
  if (!applied.length) {
    console.log(`nothing to apply (${pendingPath(home)})`);
  } else {
    for (const change of applied) {
      console.log(`${change.enabled ? "enable" : "disable"} ${change.id} (${change.kind})`);
    }
    console.log(`wrote ${file}`);
    clearPending(home);
    const { mods } = scan(home);
    writeFeed(home, buildFeed(mods));
    console.log(`refreshed ${feedPath(home)}`);
  }
}

if (command === "menu") {
  const { mods } = scan(home);
  const flag = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined);
  const search = flag("--search") ?? "";
  const filter = flag("--filter") ?? "All";
  const page = Number(flag("--page") ?? 0);
  const picked = flag("--select");
  const selected = picked === undefined ? null : Number(picked);
  console.log(
    render({
      mods,
      filter: filter === "Enabled" || filter === "Disabled" ? filter : "All",
      query: search,
      page,
      selected,
      pageSize: 20,
      pending: readPending(home),
      error: null,
    }),
  );
}
