//! Drives the real Mod Menu in Horizon's own sandbox.
//!
//! The component is built as a `.hmod`, loaded as the game loads it, and
//! then used the way a player uses it: the command, the key, the filter,
//! the search, a row, the button that asks for a mod to be turned on or
//! off, and the settings page. A feed that is missing or too new must say
//! so, not show an empty list.
//!
//! ```sh
//! cargo horizon-mod build
//! cargo run --manifest-path tools/sandbox/Cargo.toml -- target/horizon-mod/mod_menu.hmod
//! ```

use horizon_mods::{Mods, UiWidget};
use std::{env, fs, path::Path};

/// The list of mods.
const LIST: u32 = 1;
/// The button that cycles the filter.
const FILTER: u32 = 2;
/// The button that asks for a mod to be turned on or off.
const TOGGLE: u32 = 7;

/// The rows the list shows.
fn rows(mods: &Mods) -> Vec<String> {
    mods.screen(0)
        .unwrap()
        .widgets
        .iter()
        .find_map(|widget| match widget {
            UiWidget::List(list) => Some(list.rows.clone()),
            _ => None,
        })
        .unwrap()
}

/// Everything the screen says, in one line.
fn texts(mods: &Mods) -> String {
    mods.screen(0)
        .unwrap()
        .widgets
        .iter()
        .filter_map(|widget| match widget {
            UiWidget::Text(text) => Some(text.text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// The feed the launcher writes: twenty-five mods, of every kind, half of
/// them on.
fn inventory() -> String {
    let mut mods: Vec<_> = (0..25)
        .map(|i| {
            serde_json::json!({
                "id": format!("mod_{i:02}"),
                "name": format!("Mod {i:02}"),
                "version": "1.0",
                "kind": ["Sandboxed", "Content", "Native"][i % 3],
                "enabled": i % 2 == 0,
                "description": "Does a thing.",
                "authors": ["Ann"],
                "capabilities": ["hud"],
                "source": "Horizon",
            })
        })
        .collect();
    mods.push(serde_json::json!({
        "id": "veinminer", "name": "Veinminer", "version": "0.3.0",
        "kind": "Native", "enabled": true,
    }));
    serde_json::json!({ "schema": 2, "mods": mods }).to_string()
}

fn main() {
    let artifact = env::args().nth(1).expect("pass the built mod_menu.hmod");
    let dir = env::temp_dir().join(format!("modmenur-sandbox-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("mod_menu.hmod");
    fs::copy(Path::new(&artifact), &path).unwrap();

    // The mod's storage: where the launcher writes the feed and where the
    // menu keeps what the player asks for.
    let storage = dir.join(".horizon-mod-data/mod_menu");
    fs::create_dir_all(&storage).unwrap();
    let feed = storage.join("inventory.json");
    fs::write(&feed, inventory()).unwrap();

    let mut mods = Mods::load(&[path.clone()], |_| true, |_| false);
    assert!(mods.is_running(), "{:?}", mods.entries()[0].status);

    // The command opens the menu, with the list and the counts.
    assert!(mods.command("modmenu"));
    assert_eq!(rows(&mods).len(), 20, "a page holds twenty rows");
    assert!(texts(&mods).contains("26 installed | 13 enabled"));
    assert!(texts(&mods).contains("Changes apply on the next launch."));

    // The filter cycles: all, enabled, disabled, all.
    mods.ui_select(0, FILTER, 0);
    assert_eq!(rows(&mods).len(), 13, "the enabled mods");
    mods.ui_select(0, FILTER, 0);
    assert_eq!(rows(&mods).len(), 13, "the disabled mods");
    mods.ui_select(0, FILTER, 0);
    assert_eq!(rows(&mods).len(), 20, "all of them again");

    // The search, the way the command takes it.
    assert!(mods.command("modmenu VEIN"));
    assert_eq!(rows(&mods).len(), 1);
    assert!(rows(&mods)[0].contains("Veinminer"));

    // A row shows that mod's page.
    mods.ui_select(0, LIST, 0);
    assert!(texts(&mods).contains("ID: veinminer"));
    assert!(texts(&mods).contains("Type: Native"));
    assert!(texts(&mods).contains("Status: On"));

    // The button asks for the mod to be turned off, and keeps the request.
    mods.ui_select(0, TOGGLE, 0);
    let pending = fs::read_to_string(storage.join("pending.json")).unwrap();
    assert!(pending.contains("veinminer"), "{pending}");
    assert!(texts(&mods).contains("Waiting"));

    // The key opens it too.
    mods.key("key.keyboard.m", true);
    mods.tick(1);
    assert!(!rows(&mods).is_empty());

    // The page in Options > Mods.
    mods.ui_settings_opened(0);
    assert!(!mods.settings_widgets(0).is_empty());

    // A feed that is not there says so, and does not read as an instance
    // without mods.
    fs::remove_file(&feed).unwrap();
    assert!(mods.command("modmenu"));
    assert!(texts(&mods).contains("No inventory feed"));
    assert!(rows(&mods).is_empty());

    // A feed from a newer Mod Menu says so too.
    fs::write(&feed, br#"{"schema":3,"mods":[]}"#).unwrap();
    assert!(mods.command("modmenu"));
    assert!(texts(&mods).contains("newer Mod Menu"));

    // A feed that cannot be read says so.
    fs::write(&feed, b"not json").unwrap();
    assert!(mods.command("modmenu"));
    assert!(texts(&mods).contains("could not be read"));

    drop(mods);
    fs::remove_dir_all(dir).unwrap();
    println!(
        "PASS: the .hmod loads, lists the mods, pages, filters, searches, shows a mod's page, asks for it to be turned on or off, opens with M and its settings, and says what is wrong with a feed"
    );
}
