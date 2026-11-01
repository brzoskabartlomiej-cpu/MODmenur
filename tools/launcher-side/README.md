# The launcher-side tools

The menu is a sandboxed Horizon mod: it may read and write one folder, its
own, under `horizon-mods/.horizon-mod-data/mod_menu/`. These tools are the
other half: they write what the menu reads, and they apply what the menu
asks for.

They are plain Node, with no dependencies, and they work on any Horizon
instance folder: the one with `options.txt` and `horizon-mods/` in it.

```sh
node modmenur.mjs scan  <instance>            # what the instance has installed
node modmenur.mjs feed  <instance> [--write]  # the feed the menu reads
node modmenur.mjs apply <instance>            # apply the changes the player asked for
node modmenur.mjs menu  <instance>            # the menu's screen, as the game draws it
```

`feed` and `apply` take `--mods-dir <dir>`: the folder the mods live in.
It is the instance's `horizon-mods/`, or, for a mod run as a dev mod
(`cargo horizon-mod run`), the folder the built `.hmod` is in, because
the runtime keeps a mod's storage beside its file:

```sh
node modmenur.mjs feed <instance> --write --mods-dir target/horizon-mod
```

To try them without an instance, make one:

```sh
node tools/launcher-side/example-instance.mjs /tmp/horizon-demo
node tools/launcher-side/modmenur.mjs menu /tmp/horizon-demo --select 0
```

## scan

```
$ node modmenur.mjs scan ~/.local/share/horizon/Horizon
Coordinates HUD 0.1.0 [Off]    off      Sandboxed  horizon-mods/coords_hud.hmod
Towns and Towers 2.4.1 [Off]   off      Content    horizon-mods/towns_and_towers
Veinminer 0.3.0 [On]           on       Sandboxed  horizon-mods/veinminer.hmod
zoom 0.2.0 [Off]               off      Native     horizon-native-mods/zoom.hnmod
```

The rules are Horizon's own: a mod is a `.hmod` file or a folder with a
`horizon-mod.toml` in `horizon-mods/`, a native mod is a `.hnmod` in
`horizon-native-mods/`, and a mod is on when `horizon-mods.txt` has the
line `mod.<id>:true`.

## feed

Writes `horizon-mods/.horizon-mod-data/mod_menu/inventory.json`, where the
menu reads it. The file is at most 1 MiB and is published atomically. See
[`../../docs/inventory-feed.md`](../../docs/inventory-feed.md) for the
schema.

## apply

Applies what the player asked for in the menu, to `horizon-mods.txt`, with
the game's own rules:

| The mod is | What is written |
| --- | --- |
| a content or sandboxed mod, on | `mod.<id>:true` |
| a content or sandboxed mod, off | nothing: the line is gone |
| a native mod, on | `mod.<id>:true` |
| a native mod, off | `mod.<id>:false`, so the launcher's next build leaves it out |

The keys the player chose (`key.<id>.<name>:<key>`) are kept, and the file
is written the way the game writes it: the mods that are on, then the ones
that are off, then the keys.

Afterwards the feed is written again and the file of changes is emptied,
so the menu shows the new state the next time it is opened.

## menu

Draws the menu's screen in the terminal, with the same rows, the same
words and the same order the game draws:

```
$ node modmenur.mjs menu ~/.local/share/horizon/Horizon --select 0
4 installed | 1 enabled
Changes apply on the next launch.
[ Show: All mods ]
> Coordinates HUD 0.1.0 [Off]
  Towns and Towers 2.4.1 [Off]
  Veinminer 0.3.0 [On]
  zoom 0.2.0 [Off]
Coordinates HUD 0.1.0
ID: coords_hud | Type: Sandboxed
Source: Horizon
Authors: Ann
May: hud
Shows the position in the corner of the
screen.
Status: Off
[ Enable Coordinates HUD ]
Page 1 / 1
[ Refresh installed mods ]
```

It takes `--search <text>`, `--filter All|Enabled|Disabled`, `--page <n>`
and `--select <n>`.

This is the JavaScript copy of the screen: `src/menu.rs` draws it in the
game. The two are held to the same rules by the cases in
`tests/fixtures/spec.json`.

## The files

| File | What it does |
| --- | --- |
| `lib/scan.mjs` | what an instance has installed |
| `lib/feed.mjs` | the feed the menu reads |
| `lib/apply.mjs` | the changes the player asked for, applied |
| `lib/model.mjs` | the menu's rules: the filter, the search, the pages, the rows |
| `lib/screen.mjs` | the menu's screen, as text |
| `lib/zip.mjs` | the ZIP reader a `.hmod` and a `.hnmod` need |
| `lib/toml.mjs` | the TOML reader a mod's manifest needs |
| `test/` | the tests |

Run them with `npm test` from the repository's root.
