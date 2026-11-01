# The inventory feed

The menu does not look at the instance's folders: a sandboxed mod may only
read the folder `horizon-mods/.horizon-mod-data/<its id>/`. The launcher
writes what it found there, in the file `inventory.json`, and the menu
reads it.

## Where it is

```
<instance>/horizon-mods/.horizon-mod-data/mod_menu/inventory.json
```

`<instance>` is the game folder: the one with `options.txt` and
`horizon-mods/` in it.

## Schema 2

```json
{
  "schema": 2,
  "mods": [
    {
      "id": "veinminer",
      "name": "Veinminer",
      "version": "0.3.0",
      "kind": "Native",
      "enabled": false,
      "description": "Breaks a whole vein at once.",
      "authors": ["Cy"],
      "capabilities": ["game-read"],
      "source": "GitHub"
    }
  ]
}
```

| Field | What it is |
| --- | --- |
| `id` | The mod's id: `[a-z0-9_]`, 1 to 64 characters. The mod's settings and keys use it. Empty when the manifest could not be read. |
| `name` | The name the player reads. The file's name when the manifest could not be read. |
| `version` | The version the manifest writes. |
| `kind` | `Sandboxed`, `Content` or `Native`. |
| `enabled` | Whether the launcher has the mod on: the `mod.<id>:true` line in `horizon-mods.txt`. |
| `description` | What the mod says about itself. May be empty. |
| `authors` | Who wrote it. May be empty. |
| `capabilities` | What the manifest says it may do. May be empty. |
| `source` | Where it came from: `Modrinth`, `CurseForge`, `Horizon`, or `Local file`. May be empty. |
| `problem` | Why it is not running, when it is not. Not there when there is no problem. |

## Schema 1

The first feed the upstream sandboxed Mod Menu read. It is still read:

```json
{
  "schema": 1,
  "mods": [
    {"id": "mod_menu", "name": "Mod Menu", "version": "0.1.0", "kind": "Sandboxed", "enabled": true},
    {"id": "veinminer", "name": "Veinminer", "version": "0.3.0", "kind": "Native", "enabled": false}
  ]
}
```

Everything schema 2 adds is optional: a schema 1 feed's mods have no
description, no authors, no capabilities and no source.

A feed with a schema above 2 is refused, with
`Inventory needs a newer Mod Menu.`

## The rules

- The feed holds what is installed: the `.hmod` files and the mod folders
  in `horizon-mods/`, and the `.hnmod` files in `horizon-native-mods/`.
- Resource packs and shader packs are not mods and are not in it.
- A file that cannot be read stays in the feed, with `enabled: false` and
  a `problem` saying why.
- `enabled` is the launcher's setting, not proof that a mod's code runs.
- The feed holds no account information, no absolute path and no
  credentials.
- The feed is at most 1 MiB.
- It is published atomically: a temporary sibling, then the name.

## Writing it

The launcher writes it when it installs, removes, enables or disables a
mod, and before it launches an instance. This repository's tools write it
too, for a launcher that does not:

```sh
node tools/launcher-side/modmenur.mjs feed <instance> --write
```

`scan` shows what the instance has, without writing anything:

```sh
node tools/launcher-side/modmenur.mjs scan <instance>
```

## The changes the player asks for

The menu keeps them beside the feed, in `pending.json`:

```json
{
  "schema": 1,
  "changes": [
    {"id": "veinminer", "enabled": false}
  ]
}
```

They are applied to `horizon-mods.txt` with the game's own rules:

```sh
node tools/launcher-side/modmenur.mjs apply <instance>
```

The tool writes the file, writes the feed again, and empties the file of
changes, so the menu shows the new state the next time it is opened.
