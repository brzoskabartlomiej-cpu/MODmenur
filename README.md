# Mod Menu for Horizon

The mod menu a Horizon player is used to from Modrinth and the Forge
loader, for [Horizon](https://github.com/horizon-rust/horizon): the
installed mods, in one list, with a search, a filter, each mod's page, and
a button that turns a mod on or off.

It is a sandboxed Horizon mod (`.hmod`), so it runs inside the game, on
the player's screen, with the game's own menus and widgets.

```
Veinminer 0.3.0 [On]
Coordinates HUD 0.1.0 [Off]
Alpha Mod 1.0.0 [Invalid]
```

## What it does

- **M** opens it while playing, or **`/modmenu`**, with a word to search
  for: `/modmenu vein`.
- The list holds every installed mod: the sandboxed ones, the content ones
  and the native ones, the ones that are on and the ones that are off.
- **Show: All mods** cycles between all, enabled and disabled.
- A row shows that mod's page: its id, what it is, where it came from,
  who wrote it, what it may do, its description, and why it is not running
  when it is not.
- **Enable** and **Disable** ask for a mod to be turned on or off.
- The menu's own page lives in Options > Mods, next to the game's other
  mod settings.

Every word it says is one Horizon already says, and every rule it follows
is one Horizon already follows. The full table is in
[`docs/parity.md`](docs/parity.md); the behaviour, key by key, is in
[`docs/behavior.md`](docs/behavior.md).

## How it works

A sandboxed Horizon mod may read and write one folder: its own, under
`horizon-mods/.horizon-mod-data/mod_menu/`. So:

```
<instance>/horizon-mods/.horizon-mod-data/mod_menu/
├── inventory.json    what the launcher found: the feed the menu reads
├── pending.json      what the player asked for
└── settings.json     the menu's own settings
```

The **launcher** writes the feed. This repository's tools write it too, for
a launcher that does not:

```sh
node tools/launcher-side/modmenur.mjs feed <instance> --write
```

The **menu** writes what the player asked for into `pending.json`, because
the file that says which mods are on, `horizon-mods.txt`, is beside
`options.txt` and outside the mod's own folder. The launcher-side `apply`
writes it with the game's own rules, so the game does what the player
asked on the next launch:

```sh
node tools/launcher-side/modmenur.mjs apply <instance>
```

This is the sandbox's limit, not a choice: a mod may not write outside its
own folder. A native mod (`.hnmod`) has no such limit and can write the
file itself; the rules it would follow are the ones in
[`docs/parity.md`](docs/parity.md).

## Seeing it without building it

The tools draw the menu's screen in the terminal, with the same rows, the
same words and the same order the game draws:

```
$ node tools/launcher-side/modmenur.mjs menu <instance> --select 0
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
and `--select <n>`. The tools are described in
[`tools/launcher-side/README.md`](tools/launcher-side/README.md).

## Building it

The mod is Rust, and it needs Horizon's own toolchain. Rust **1.95 or
newer** (Horizon's runtime is wasmtime 48), the WebAssembly target, and
Horizon's mod tool:

```sh
# 1. Rust, with the target the mod is compiled for
rustup update
rustup target add wasm32-unknown-unknown

# 2. Horizon's mod tool
cargo install --git https://github.com/horizon-rust/horizon cargo-horizon-mod

# 3. the mod
cargo horizon-mod build                          # -> target/horizon-mod/mod_menu.hmod
cargo horizon-mod check target/horizon-mod/mod_menu.hmod
```

`cargo horizon-mod check` is what the registry runs before a mod is
published: it reads the manifest, refuses the imports the capabilities do
not cover, and plays the mod in the sandbox for 40 ticks, 120 frames, a
chat line and each of its commands.

The tests are the model's tests and the shared cases:

```sh
cargo test --locked
cargo fmt --all --check
cargo clippy --all-targets --locked -- -D warnings
```

The sandbox driver loads the built `.hmod` in Horizon's own runtime and
uses it the way a player does, so the parts only a running game can show
are checked too:

```sh
cargo run --manifest-path tools/sandbox/Cargo.toml -- target/horizon-mod/mod_menu.hmod
```

### Developing it

`cargo horizon-mod run` builds the mod and starts the game with it as a
dev mod: it is always on, and the game checks the file once a second, so
a rebuild reloads it while the game runs.

```sh
cargo horizon-mod run
```

A dev mod keeps its storage **beside the built file**, not in the
instance: `target/horizon-mod/.horizon-mod-data/mod_menu/`. The feed goes
there, and the instance's mods are what it lists:

```sh
node tools/launcher-side/modmenur.mjs feed <instance> --write --mods-dir target/horizon-mod
```

Press `M` in the game: the menu opens with that instance's mods. A
change the player asks for lands in the same folder, and

```sh
node tools/launcher-side/modmenur.mjs apply <instance> --mods-dir target/horizon-mod
```

writes it to `horizon-mods.txt`.

## Installing it

Put the built `.hmod` in the instance's `horizon-mods/` folder, beside
`options.txt`, and write the feed:

```sh
cp target/horizon-mod/mod_menu.hmod <instance>/horizon-mods/
node tools/launcher-side/modmenur.mjs feed <instance> --write
```

Then play the instance. The Mod Menu is off until the player turns it on
in Options > Mods, like every other mod.

## The parts of this repository

| Path | What it is |
| --- | --- |
| `src/` | the mod: the menu, its model and its own settings |
| `tests/` | the model's tests, and the cases in `tests/fixtures` |
| `tools/sandbox/` | the driver that loads the built `.hmod` and uses it |
| `tools/launcher-side/` | the tools that write the feed and apply the changes |
| `docs/` | the behaviour, the feed's schema and the parity table |
| `scripts/` | the checks that run without a Rust toolchain |

## Checking it without Rust

The Rust toolchain and crates.io are not always at hand, so the behaviour
is written down twice: once in Rust, in `src/model.rs`, and once in
JavaScript, in `tools/launcher-side/lib/model.mjs`. The cases in
`tests/fixtures/spec.json` are run against both, so the two are held to
the same rules.

```sh
npm install
npm run check      # the shared cases, the Rust syntax, the tools' tests
```

The checks are:

| Check | What it does |
| --- | --- |
| `npm run check:spec` | runs the shared cases against the rules in JavaScript |
| `npm run check:syntax` | parses the Rust sources, so a typo is caught without a compiler |
| `npm test` | the tools' own tests: the ZIP reader, the TOML reader, the scanner, the feed and the applier |
| `npm run check:sdk` | holds every SDK call the mod makes against Horizon's contract (needs `HORIZON_SRC`) |

`npm run check:sdk` is the one that matters most without a compiler:

```sh
HORIZON_SRC=/path/to/horizon npm run check:sdk
```

It reads the mod's sources and the SDK's WIT file, and says when the mod
calls something the SDK does not have.

## Licence

MIT. Horizon itself is MIT too, and this repository contains no assets of
its: no textures, no sounds, no code from the game.
