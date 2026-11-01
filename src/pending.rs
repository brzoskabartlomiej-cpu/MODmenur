//! The changes the player asked for in the menu.
//!
//! A sandboxed mod may only write its own storage folder, so it cannot turn
//! a mod on or off itself: `horizon-mods.txt` is the game's file, beside
//! `options.txt`. The menu therefore writes what the player wants here, and
//! the launcher-side helper ([`docs/behavior.md`]) applies it with the
//! game's own rules before the next launch.
use serde::{Deserialize, Serialize};

/// The version of the file the menu writes.
pub const SCHEMA: u32 = 1;

/// One mod the player wants on or off.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Change {
    /// The mod's id.
    pub id: String,
    /// Whether it should be on.
    pub enabled: bool,
}

/// The changes waiting for the launcher.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Pending {
    /// The file's version.
    #[serde(default)]
    pub schema: u32,
    /// The changes, the last one for a mod first.
    #[serde(default)]
    pub changes: Vec<Change>,
}

impl Pending {
    /// Reads the file the menu wrote before. A file that cannot be read is
    /// no changes: the player asks again.
    pub fn parse(bytes: &[u8]) -> Self {
        serde_json::from_slice(bytes).unwrap_or_default()
    }

    /// The file the menu writes.
    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }

    /// What the player asked for about a mod, when they asked for anything.
    pub fn get(&self, id: &str) -> Option<bool> {
        self.changes
            .iter()
            .find(|c| c.id == id)
            .map(|c| c.enabled)
    }

    /// Asks for a mod to be on or off, replacing what was asked before.
    pub fn set(&mut self, id: &str, enabled: bool) {
        self.changes.retain(|c| c.id != id);
        self.changes.push(Change {
            id: id.to_owned(),
            enabled,
        });
    }

    /// Takes back what was asked for a mod.
    pub fn clear(&mut self, id: &str) {
        self.changes.retain(|c| c.id != id);
    }

    /// How many mods have a change waiting.
    pub fn len(&self) -> usize {
        self.changes.len()
    }

    /// Whether nothing is waiting.
    pub fn is_empty(&self) -> bool {
        self.changes.is_empty()
    }
}
