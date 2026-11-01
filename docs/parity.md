# Parity: what the menu does, and where each thing comes from

Three things are called a mod menu here, and this table says which of them
each behaviour follows. Horizon's source is at
`83f15fa276c44711276b6ceb5f0fe0c9c534dc66` (26.3, mod API 0.1); the paths
below are in that tree.

- **The usual mod menu** is the one a player knows from Modrinth and the
  Forge loader: a list of the installed mods, with a search, a switch per
  mod and a page per mod.
- **Horizon's own Options > Mods** is the game's page: every installed mod,
  what it may do, why it is not running, and a switch.
- **The upstream sandboxed Mod Menu** (`levzzz5154/horizon-mod-menu`) is the
  read-only browser that shipped for Horizon: `M`, `/modmenu`, the filter,
  the search, the pages, the inventory feed.

Mod Menu for Horizon follows the usual mod menu for what the player sees,
Horizon's own page for what it says about each mod, and the upstream
sandboxed menu for the rest: the key, the command, the filter, the feed and
the words it uses when something is wrong.

## The list

| What the player does | The usual mod menu | Horizon's Options > Mods | The upstream sandboxed menu | Mod Menu for Horizon |
| --- | --- | --- | --- | --- |
| Opens the menu | a key, or `/modmenu` | a page in Options | `M`, or `/modmenu` | `M` (rebindable), or `/modmenu` |
| Sees the mods | a list with a search and a switch per mod | a list of the installed mods | a list of the installed mods | a list of the installed mods |
| Sees a mod's name and version | yes | `Name version` | `Name version` | `Name version` |
| Sees whether a mod is on | a switch | a switch | `[On]`, `[Off]`, `[Invalid]` | `[On]`, `[Off]`, `[Invalid]` |
| Sees a mod's description | on the mod's page | under the row | not shown | on the mod's page, wrapped to the menu's width |
| Sees who wrote it | on the mod's page | not shown | not shown | on the mod's page |
| Sees what a mod may do | not shown | "May add blocks and items" | not shown | the manifest's capabilities |
| Sees why a mod is not running | not shown | the reason | a `problem` string | the reason, in red |
| Turns a mod on or off | a switch per mod | a switch | **read only** | a button on the mod's page, kept until the launcher applies it |
| Searches | a search field | not shown | `/modmenu text` | `/modmenu text` |
| Filters | not shown | not shown | All / Enabled / Disabled | All / Enabled / Disabled |
| Pages | no | no | 20 a page | 20 a page (10 or 50 on the settings page) |
| Refreshes | reloads the list | on the page | a button | a button |
| Is told a change waits | no | "the next launch" | "Changes apply on the next launch." | the same words, and how many changes wait |

## The words

Every message is the one Horizon already uses, so a player who has seen
the game's own Mods page reads the same words.

| Message | Where it comes from |
| --- | --- |
| `Can't be read: <why>` | `crates/horizon-client/src/game/mods.rs`, the game's own row |
| `Doesn't run any more: needs a native port` | the same file, for a WebAssembly mod the game no longer runs |
| `Installed, not built into this game: build the game with it in the launcher (Settings > Native mods), then play the instance that build is in.` | `crates/horizon-client-render/src/mod_list.rs`, `NOT_BUILT` |
| `No inventory feed. Update the launcher, then reopen the game.` | the upstream sandboxed menu |
| `Inventory could not be read; reopen the game through the launcher.` | the upstream sandboxed menu |
| `Inventory needs a newer Mod Menu.` | the upstream sandboxed menu |
| `Inventory is too large; update your launcher.` | the upstream sandboxed menu |
| `Changes apply on the next launch.` | the upstream sandboxed menu |

## The files

| File | Who writes it | Who reads it | What is in it |
| --- | --- | --- | --- |
| `horizon-mods.txt` | the game (Options > Mods), the launcher, this repository's `apply` | the game, the launcher | `mod.<id>:true`, `mod.<id>:false`, `key.<id>.<name>:<key>` |
| `horizon-mods/<file>.hmod`, `horizon-mods/<folder>/` | the launcher, the player | the game | a mod and its `horizon-mod.toml` |
| `horizon-native-mods/<id>.hnmod` | the launcher | the launcher (it builds them into the game) | a native mod's bundle |
| `horizon-mods/.horizon-mod-data/mod_menu/inventory.json` | the launcher, or this repository's `feed` | this mod | the feed: what is installed |
| `horizon-mods/.horizon-mod-data/mod_menu/pending.json` | this mod | this repository's `apply` | what the player asked for |
| `horizon-mods/.horizon-mod-data/mod_menu/settings.json` | this mod | this mod | the menu's own settings |

## Where each rule comes from in Horizon's source

| Rule | Where |
| --- | --- |
| A mod is a `.hmod` file or a folder with a `horizon-mod.toml` | `crates/horizon-mods/src/manifest.rs`, `find()` |
| A mod's manifest: id, name, version, description, authors, api, capabilities | the same file, `Manifest` |
| A mod that is on has `mod.<id>:true` in `horizon-mods.txt` | `crates/horizon-client-render/src/mod_list.rs`, `ModList` |
| A native mod that is off has `mod.<id>:false`, so the launcher's build leaves it out | the same file |
| The keys the player chose are `key.<id>.<name>:<key>` | the same file |
| The rows of the Mods page, and the reasons a mod is not running | `crates/horizon-client/src/game/mods.rs`, `start_mods()` |
| A mod's storage is `horizon-mods/.horizon-mod-data/<id>/` | `crates/horizon-mods/src/manifest.rs`, `STORAGE_DIR` |
| The launcher's own list of what it installed, and where it came from | `launcher/src/browser/installed.rs`, `mod-browser.json` |
| The launcher turns a mod on by writing `mod.<id>:true` | `launcher/src/browser/java.rs`, `set_enabled()` |

## What this menu cannot do, and why

- **It cannot turn a mod on or off by itself.** A sandboxed mod may only
  write the folder `horizon-mods/.horizon-mod-data/<its id>/`. The file
  that says which mods are on, `horizon-mods.txt`, is beside `options.txt`,
  outside that folder, and the sandbox does not let a mod write there. The
  menu therefore keeps what the player asked for in `pending.json`, and the
  launcher-side `apply` writes it with the game's own rules. A native mod
  (`.hnmod`) has no such limit: it runs with the player's own rights and
  can write the file itself.
- **It has no search field.** Horizon's mod screens have text, buttons,
  items and lists, and nothing to type into. The search is the command's
  argument, as in the upstream sandboxed menu: `/modmenu vein`.
- **It has no switch on each row.** A list widget gives the game a row, and
  the game gives the mod the row that was picked; there is no button per
  row. The button that turns a mod on or off is on the mod's page, below
  the list.
- **It cannot diagnose a mod that fails at runtime.** It says what the
  launcher found: what is installed, what is on, and what could not be
  read. A mod that loads and then stops is the game's own business.
