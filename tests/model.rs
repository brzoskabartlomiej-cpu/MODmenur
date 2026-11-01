//! The model's tests: what the feed says, what the list shows and what a
//! row reads.
//!
//! The cases in `tests/fixtures/spec.json` are the behaviour both the Rust
//! model and the launcher-side check run, so the two are held to the same
//! rules.
use modmenur::model::{self, Filter, InstalledMod};
use modmenur::pending::Pending;
use modmenur::settings::Settings;
use serde::Deserialize;

/// The bytes of a fixture file.
fn fixture(name: &str) -> Vec<u8> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(name);
    std::fs::read(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

/// A mod as the list shows it, for the tests that do not need a feed.
fn installed(id: &str, enabled: bool) -> InstalledMod {
    InstalledMod {
        id: id.into(),
        name: id.into(),
        version: "1.0".into(),
        kind: "Native".into(),
        enabled,
        description: String::new(),
        authors: Vec::new(),
        capabilities: Vec::new(),
        source: String::new(),
        problem: None,
    }
}

/// The shared cases.
#[derive(Deserialize)]
struct Spec {
    feed: String,
    page_size: usize,
    cases: Vec<Case>,
    pages: Pages,
}

/// One case.
#[derive(Deserialize)]
struct Case {
    name: String,
    filter: String,
    query: String,
    expected_ids: Vec<String>,
}

/// The pages the list has.
#[derive(Deserialize)]
struct Pages {
    total: usize,
    page_count: usize,
    first_page: Vec<String>,
    second_page: Vec<String>,
}

#[test]
fn inventory_preserves_disabled_and_native_mods_and_sorts_names() {
    let inventory = model::parse(
        br#"{"schema":1,"mods":[{"id":"z","name":"Zulu","version":"1","kind":"Native","enabled":false},{"id":"a","name":"Alpha","version":"2","kind":"Sandboxed","enabled":true}]}"#,
    )
    .unwrap();
    assert_eq!(inventory.mods[0].id, "a");
    assert!(!inventory.mods[1].enabled);
    assert_eq!(inventory.mods[1].kind, "Native");
}

#[test]
fn incompatible_or_broken_feeds_do_not_look_like_an_empty_installation() {
    assert!(model::parse(b"{}").is_err());
    assert!(model::parse(br#"{"schema":3,"mods":[]}"#).is_err());
    assert!(model::parse(b"not json").is_err());
    assert!(model::parse(&vec![b' '; (1 << 20) + 1]).is_err());
    // A feed without the mods is broken too: it must not read as an
    // instance without mods.
    assert!(model::parse(br#"{"schema":1}"#).is_err());
}

#[test]
fn the_first_feed_schema_still_reads() {
    let inventory = model::parse(&fixture("feed-schema1.json")).unwrap();
    assert_eq!(inventory.schema, 1);
    assert_eq!(inventory.mods.len(), 25);
    // The fields the first feed did not have are empty, not missing.
    assert!(inventory.mods[0].description.is_empty());
    assert!(inventory.mods[0].authors.is_empty());
    assert_eq!(inventory.mods[0].kind, "Native");
}

#[test]
fn the_second_feed_schema_reads_what_a_mods_page_shows() {
    let inventory = model::parse(&fixture("feed-schema2.json")).unwrap();
    assert_eq!(inventory.schema, 2);
    let alpha = inventory
        .mods
        .iter()
        .find(|m| m.id == "alpha")
        .expect("alpha is in the feed");
    assert_eq!(alpha.description, "Adds a block and a recipe.");
    assert_eq!(alpha.authors, vec!["Ann".to_owned()]);
    assert_eq!(alpha.capabilities, vec!["registries".to_owned()]);
    assert_eq!(alpha.source, "Horizon");
}

#[test]
fn filters_search_and_page_boundaries_keep_all_installed_mods_reachable() {
    let mods: Vec<_> = (0..41)
        .map(|i| installed(&format!("mod_{i:02}"), i % 2 == 0))
        .collect();
    assert_eq!(model::page_count(mods.len(), 20), 3);
    assert_eq!(model::matching(&mods, Filter::Enabled, "").len(), 21);
    assert_eq!(model::matching(&mods, Filter::Disabled, "").len(), 20);
    assert_eq!(
        model::matching(&mods, Filter::All, "MOD_40")[0].id,
        "mod_40"
    );
    assert_eq!(model::matching(&mods, Filter::All, "native").len(), 41);
    assert_eq!(model::page_count(0, 20), 1);
    assert_eq!(Filter::All.next().next().next(), Filter::All);
    // The last page is the one after the last row.
    assert_eq!(model::clamp_page(9, 41, 20), 2);
    assert_eq!(model::clamp_page(0, 0, 20), 0);
}

#[test]
fn mod_names_cannot_inject_legacy_colors_or_multiline_rows() {
    assert_eq!(model::clean("One\nTwo§c"), "OneTwoc");
    assert_eq!(model::clean(&"界".repeat(500)).chars().count(), 180);
    let mut broken = installed("broken", true);
    broken.problem = Some("Invalid package".into());
    assert!(broken.row().ends_with("[Invalid]"));
}

#[test]
fn a_row_says_the_name_the_version_and_the_state() {
    let mut mod_ = installed("veinminer", true);
    mod_.name = "Veinminer".into();
    mod_.version = "0.3.0".into();
    assert_eq!(mod_.row(), "Veinminer 0.3.0 [On]");
    mod_.enabled = false;
    assert_eq!(mod_.row(), "Veinminer 0.3.0 [Off]");
}

#[test]
fn a_description_is_wrapped_into_lines_a_menu_can_show() {
    let text = "Adds a block and a recipe to the game, so the world has more to do.";
    let lines = model::wrap(text, 20, 3);
    assert!(lines.len() <= 3);
    for line in &lines {
        assert!(line.chars().count() <= 20, "{line}");
    }
    assert_eq!(model::wrap("", 20, 3).len(), 0);
}

#[test]
fn the_shared_cases_hold() {
    let spec: Spec =
        serde_json::from_slice(&fixture("spec.json")).expect("the shared cases are readable");
    let inventory = model::parse(&fixture(&spec.feed)).expect("the shared feed is readable");
    for case in &spec.cases {
        let filter = Filter::from_name(&case.filter);
        let ids: Vec<String> = model::matching(&inventory.mods, filter, &case.query)
            .into_iter()
            .map(|m| m.id.clone())
            .collect();
        assert_eq!(ids, case.expected_ids, "{}", case.name);
    }
    let all = model::matching(&inventory.mods, Filter::All, "");
    assert_eq!(all.len(), spec.pages.total);
    assert_eq!(
        model::page_count(all.len(), spec.page_size),
        spec.pages.page_count
    );
    let first: Vec<String> = all
        .iter()
        .take(spec.page_size)
        .map(|m| m.id.clone())
        .collect();
    assert_eq!(first, spec.pages.first_page);
    let second: Vec<String> = all
        .iter()
        .skip(spec.page_size)
        .map(|m| m.id.clone())
        .collect();
    assert_eq!(second, spec.pages.second_page);
}

#[test]
fn the_changes_the_player_asked_for_replace_each_other() {
    let mut pending = Pending::default();
    assert!(pending.is_empty());
    pending.set("alpha", true);
    pending.set("beta", false);
    assert_eq!(pending.len(), 2);
    assert_eq!(pending.get("alpha"), Some(true));
    pending.set("alpha", false);
    assert_eq!(pending.len(), 2);
    assert_eq!(pending.get("alpha"), Some(false));
    pending.clear("alpha");
    assert_eq!(pending.get("alpha"), None);
    assert_eq!(pending.len(), 1);
    // What is written is what is read.
    let bytes = pending.to_bytes();
    assert_eq!(Pending::parse(&bytes), pending);
    // A file that cannot be read is no changes.
    assert!(Pending::parse(b"not json").is_empty());
}

#[test]
fn the_settings_survive_a_file_that_cannot_be_read() {
    let mut settings = Settings::default();
    assert_eq!(settings.filter(), Filter::All);
    assert_eq!(settings.page_size, 20);
    settings.set_filter(Filter::Disabled);
    assert_eq!(settings.next_page_size(), 10);
    assert_eq!(settings.next_page_size(), 50);
    assert_eq!(settings.next_page_size(), 20);
    let bytes = settings.to_bytes();
    let read = Settings::parse(&bytes);
    assert_eq!(read.filter(), Filter::Disabled);
    assert_eq!(Settings::parse(b"not json").filter(), Filter::All);
}
