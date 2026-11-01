//! The Mod Menu's own settings, kept in its storage (`settings.json`).
//!
//! They are the player's own choices: which mods the list shows, how many
//! rows a page holds and whether the list is read again each time the menu
//! opens.
use crate::model::{Filter, DEFAULT_PAGE_SIZE, PAGE_SIZES};
use horizon_mod_sdk::storage;
use serde::{Deserialize, Serialize};

/// The version of the settings file.
pub const SCHEMA: u32 = 1;

/// The file the settings are kept in.
pub const FILE: &str = "settings.json";

/// The page size a fresh settings file holds.
fn default_page_size() -> usize {
    DEFAULT_PAGE_SIZE
}

/// Whether a fresh settings file reads the list on open.
fn default_refresh_on_open() -> bool {
    true
}

/// The Mod Menu's settings.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Settings {
    /// The file's version.
    #[serde(default)]
    pub schema: u32,
    /// Which mods the list shows: `All`, `Enabled` or `Disabled`.
    #[serde(default)]
    pub filter: String,
    /// How many rows a page holds.
    #[serde(default = "default_page_size")]
    pub page_size: usize,
    /// Whether the list is read again each time the menu opens.
    #[serde(default = "default_refresh_on_open")]
    pub refresh_on_open: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema: SCHEMA,
            filter: Filter::All.name().to_owned(),
            page_size: DEFAULT_PAGE_SIZE,
            refresh_on_open: true,
        }
    }
}

impl Settings {
    /// Reads the settings the menu kept. A file that cannot be read is the
    /// default settings: the player sets them again.
    pub fn parse(bytes: &[u8]) -> Self {
        serde_json::from_slice(bytes).unwrap_or_default()
    }

    /// The settings the menu kept, or the default ones.
    pub fn load() -> Self {
        storage::get(FILE)
            .map(|bytes| Settings::parse(&bytes))
            .unwrap_or_default()
    }

    /// The file the menu keeps them in.
    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }

    /// Which mods the list shows.
    pub fn filter(&self) -> Filter {
        Filter::from_name(&self.filter)
    }

    /// Sets which mods the list shows.
    pub fn set_filter(&mut self, filter: Filter) {
        self.filter = filter.name().to_owned();
    }

    /// The next page size, the order the button cycles them.
    pub fn next_page_size(&mut self) -> usize {
        let index = PAGE_SIZES
            .iter()
            .position(|size| *size == self.page_size)
            .map(|index| (index + 1) % PAGE_SIZES.len())
            .unwrap_or(0);
        self.page_size = PAGE_SIZES[index];
        self.page_size
    }
}
