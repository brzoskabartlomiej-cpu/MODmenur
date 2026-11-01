# What the menu does

This is the menu's behaviour, key by key. The parity table in
[`parity.md`](parity.md) says which of the three menus each of these
follows.

## Opening it

| | |
| --- | --- |
| **M** | Opens the menu while playing. The key is registered as `key.keyboard.m`; the player may rebind it on this mod's page in Options > Mods, where the game lists the mod's keys. |
| `/modmenu` | Opens the menu, whatever the player is doing. |
| `/modmenu vein` | Opens the menu with the search set to `vein`: the mods whose id, name, version, kind, source or authors hold it. The search is not case sensitive. |
| Options > Mods > Mod Menu | The menu's own page: the filter, the page size, whether the list is read again on open, and a button that opens the menu. |

The menu is one screen: the list of mods, the filter and the search above
it, and the picked mod's page below it.

## The list

The list shows every installed mod, by name; the id breaks a tie. A row
reads:

```
Veinminer 0.3.0 [On]
```

`[On]` and `[Off]` say what the launcher has the mod set to; `[Invalid]`
says the mod could not be read, and the reason is on its page.

The list holds twenty rows a page. **Next page** and **Previous page**
turn the page, and the screen says which page it is (`Page 1 / 2`). An
empty list says `No matching installed mods.`

## The filter

**Show: All mods** cycles between the three the upstream menu has:

| Filter | What it shows |
| --- | --- |
| All mods | every installed mod |
| Enabled | the mods the launcher has on |
| Disabled | the mods the launcher has off |

Changing the filter goes back to the first page.

## A mod's page

Picking a row shows that mod's page under the list:

```
Veinminer 0.3.0
ID: veinminer | Type: Native
Source: GitHub
Authors: Cy
May: game-read
Breaks a whole vein at once.
Status: On
```

- **ID** and **Type**: the mod's id and what it is (`Sandboxed`, `Content`
  or `Native`).
- **Source**: where the launcher got it, when it says.
- **Authors**: who wrote it.
- **May**: what the mod's manifest says it may do (its capabilities).
- The description, wrapped to the menu's width.
- **Status**: `On` or `Off`, in the mod's colour, or the reason it is not
  running, in red.
- **Waiting**: what the player asked for, when it differs from what the
  launcher has.

## Turning a mod on or off

The button on the mod's page reads **Enable Veinminer** when the mod is
off and **Disable Veinminer** when it is on.

A sandboxed mod may only write its own folder, so the menu cannot write
`horizon-mods.txt`, the file that says which mods are on. It keeps what
the player asked for in `pending.json`, in its own folder, and the
launcher-side `apply` writes it with the game's own rules:

| The mod is | What the game writes |
| --- | --- |
| a content or sandboxed mod, on | `mod.<id>:true` |
| a content or sandboxed mod, off | nothing: the line is gone |
| a native mod, on | `mod.<id>:true` |
| a native mod, off | `mod.<id>:false`, so the launcher's next build leaves it out |

Until then the screen says how many changes are waiting, and the mod's page
says `Waiting: turn Veinminer off`. The change takes effect on the next
launch, which is what the game's own Mods page does too.

## Refreshing

**Refresh installed mods** reads the feed again, so the list shows what the
launcher has installed now. The menu also reads it again each time it
opens, unless the player turned that off on the settings page.

## When something is wrong

| What the player sees | What it means |
| --- | --- |
| `No inventory feed. Update the launcher, then reopen the game.` | The launcher has not written the feed. The menu cannot know what is installed. |
| `Inventory could not be read; reopen the game through the launcher.` | The feed is there but cannot be read. |
| `Inventory needs a newer Mod Menu.` | The feed is from a newer menu than this one. |
| `Inventory is too large; update your launcher.` | The feed is over 1 MiB. |

None of these shows an empty list as if the instance had no mods: a
broken feed is said to be broken.

## The menu's own settings

On the mod's page in Options > Mods:

| Setting | What it does |
| --- | --- |
| **Show: All mods** | The filter the menu opens with. |
| **Rows a page: 20** | Cycles 10, 20, 50. |
| **Read the list on open: On** | Whether the feed is read again each time the menu opens. |
| **Open the Mod Menu** | Opens the menu without leaving Options. |

They are kept in `settings.json`, in the menu's own folder.
