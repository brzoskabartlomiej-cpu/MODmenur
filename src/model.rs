//! The Mod Menu's model: what the launcher says is installed, what the
//! player filters and searches, and how a row reads.
//!
//! The launcher writes the inventory it scanned into the Mod Menu's own
//! storage (`inventory.json`); this module reads it, keeps it in the order
//! the list shows and turns a filter, a search and a page into the rows the
//! screen draws.
use serde::Deserialize;

/// The feed schema this Mod Menu reads. `1` is the launcher's first feed:
/// id, name, version, kind and enabled. `2` adds what a mod's page shows
/// besides its name: description, authors, capabilities and source.
pub const SCHEMA: u32 = 2;

/// The oldest feed this Mod Menu reads.
pub const OLDEST_SCHEMA: u32 = 1;

/// The biggest feed read: the launcher's own cap, so a feed that is too big
/// is the launcher's mistake, not a mod's.
pub const MAX_FEED: usize = 1 << 20;

/// How many rows a page holds when the player did not choose a size.
pub const DEFAULT_PAGE_SIZE: usize = 20;

/// The page sizes the player may choose, in the order the button cycles them.
pub const PAGE_SIZES: [usize; 3] = [10, 20, 50];

/// How long a mod's own text may be before it is cut: enough for a
/// description, short enough to keep a row on one line.
pub const MAX_TEXT: usize = 180;

/// One installed mod, as the feed describes it.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct InstalledMod {
    /// The mod's id: `[a-z0-9_]`, the name its settings and keys use.
    pub id: String,
    /// The name the player reads.
    pub name: String,
    /// The version, as the mod's manifest writes it.
    #[serde(default)]
    pub version: String,
    /// What the mod is: `Sandboxed`, `Content` or `Native`.
    #[serde(default = "unknown_kind")]
    pub kind: String,
    /// Whether the launcher has it on.
    pub enabled: bool,
    /// What the mod says about itself.
    #[serde(default)]
    pub description: String,
    /// Who wrote it.
    #[serde(default)]
    pub authors: Vec<String>,
    /// What it may do, as the manifest's capabilities.
    #[serde(default)]
    pub capabilities: Vec<String>,
    /// Where it came from: the registry, Modrinth, a file put in by hand.
    #[serde(default)]
    pub source: String,
    /// Why it is not running, when it is not.
    #[serde(default)]
    pub problem: Option<String>,
}

/// The kind of a mod whose feed entry left it out.
fn unknown_kind() -> String {
    "Unknown".to_owned()
}

/// The feed the launcher wrote.
#[derive(Debug, Deserialize)]
pub struct Inventory {
    /// The feed's schema.
    pub schema: u32,
    /// The installed mods. Required: a feed without it is broken, and a
    /// broken feed must not read as an empty installation.
    pub mods: Vec<InstalledMod>,
}

/// Reads the feed.
///
/// The messages are the ones the launcher-side menu has always said, so a
/// player reads the same words whatever wrote the feed.
pub fn parse(bytes: &[u8]) -> Result<Inventory, String> {
    if bytes.len() > MAX_FEED {
        return Err("Inventory is too large; update your launcher.".into());
    }
    let mut inventory: Inventory = serde_json::from_slice(bytes)
        .map_err(|_| "Inventory could not be read; reopen the game through the launcher.")?;
    if inventory.schema < OLDEST_SCHEMA || inventory.schema > SCHEMA {
        return Err("Inventory needs a newer Mod Menu.".into());
    }
    // The list shows the mods by name; the id breaks a tie.
    inventory
        .mods
        .sort_by_key(|m| (m.name.to_lowercase(), m.id.clone()));
    Ok(inventory)
}

/// Which mods the list shows.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Filter {
    /// Every installed mod.
    #[default]
    All,
    /// The mods the launcher has on.
    Enabled,
    /// The mods the launcher has off.
    Disabled,
}

impl Filter {
    /// The next filter, the order the button cycles them: all, enabled,
    /// disabled, all again.
    pub fn next(self) -> Self {
        match self {
            Self::All => Self::Enabled,
            Self::Enabled => Self::Disabled,
            Self::Disabled => Self::All,
        }
    }

    /// What the button reads.
    pub fn label(self) -> &'static str {
        match self {
            Self::All => "All mods",
            Self::Enabled => "Enabled",
            Self::Disabled => "Disabled",
        }
    }

    /// The filter's name in the settings file.
    pub fn name(self) -> &'static str {
        match self {
            Self::All => "All",
            Self::Enabled => "Enabled",
            Self::Disabled => "Disabled",
        }
    }

    /// The filter a settings file names.
    pub fn from_name(name: &str) -> Self {
        match name {
            "Enabled" => Self::Enabled,
            "Disabled" => Self::Disabled,
            _ => Self::All,
        }
    }
}

/// The mods the list shows: the ones the filter keeps, then the ones the
/// search finds.
///
/// The search looks at the fields the menu shows about a mod: its id, name,
/// version, kind, authors and where it came from. It is the search of the
/// usual mod menus, over what Horizon's feed has.
pub fn matching<'a>(
    mods: &'a [InstalledMod],
    filter: Filter,
    search: &str,
) -> Vec<&'a InstalledMod> {
    let query = search.trim().to_lowercase();
    mods.iter()
        .filter(|m| {
            let kept = match filter {
                Filter::All => true,
                Filter::Enabled => m.enabled,
                Filter::Disabled => !m.enabled,
            };
            kept && haystack(m).contains(&query)
        })
        .collect()
}

/// What the search looks at, in one lowercased string.
fn haystack(m: &InstalledMod) -> String {
    let mut text = format!(
        "{} {} {} {} {}",
        m.id,
        m.name,
        m.version,
        m.kind,
        m.source
    );
    for author in &m.authors {
        text.push(' ');
        text.push_str(author);
    }
    text.to_lowercase()
}

/// How many pages the list has: one, even when it is empty, so the player
/// always sees where they are.
pub fn page_count(count: usize, page_size: usize) -> usize {
    let size = page_size.max(1);
    count.div_ceil(size).max(1)
}

/// The page of the list to show, never past the last one.
pub fn clamp_page(page: usize, count: usize, page_size: usize) -> usize {
    page.min(page_count(count, page_size) - 1)
}

/// Cuts a mod's own text: no control characters (a name may not break the
/// row over two lines), no legacy colour code, and not too long.
pub fn clean(text: &str) -> String {
    text.chars()
        .filter(|c| !c.is_control() && *c != '§')
        .take(MAX_TEXT)
        .collect()
}

impl InstalledMod {
    /// The row the list shows: the name, the version and whether the mod is
    /// on, off or broken.
    pub fn row(&self) -> String {
        format!(
            "{} {} [{}]",
            clean(&self.name).chars().take(18).collect::<String>(),
            clean(&self.version).chars().take(8).collect::<String>(),
            if self.problem.is_some() {
                "Invalid"
            } else if self.enabled {
                "On"
            } else {
                "Off"
            }
        )
    }

    /// Who wrote it, as one line.
    pub fn authors_line(&self) -> String {
        self.authors.join(", ")
    }

    /// What it may do, as one line.
    pub fn capabilities_line(&self) -> String {
        self.capabilities.join(", ")
    }

    /// The description, cut to what a line may hold.
    pub fn description_line(&self) -> String {
        clean(&self.description)
    }
}

/// Wraps a mod's description into lines a narrow menu can show.
pub fn wrap(text: &str, width: usize, lines: usize) -> Vec<String> {
    let width = width.max(8);
    let mut out: Vec<String> = Vec::new();
    for paragraph in clean(text).split('\n') {
        let paragraph = paragraph.trim();
        if paragraph.is_empty() {
            continue;
        }
        let mut line = String::new();
        for word in paragraph.split_whitespace() {
            if !line.is_empty() && line.chars().count() + 1 + word.chars().count() > width {
                out.push(std::mem::take(&mut line));
                if out.len() == lines {
                    return out;
                }
            }
            if !line.is_empty() {
                line.push(' ');
            }
            line.push_str(word);
        }
        if !line.is_empty() {
            out.push(line);
            if out.len() == lines {
                return out;
            }
        }
    }
    out
}
