//! The menu's state and the screen it draws.
//!
//! The screen is one page of the usual mod menus: the list of the installed
//! mods, the filter and the search above it, and the selected mod's page
//! below it. Horizon's mod widgets are the game's own, so the layout is the
//! game's; what the menu says is here.
use crate::model::{self, Filter, InstalledMod};
use crate::pending::Pending;
use crate::settings::Settings;
use horizon_mod_sdk::{
    storage,
    ui::{ButtonWidget, ListWidget, Screen, TextWidget, Widget},
};

/// The list of mods. Picking a row shows that mod's page.
pub const LIST: u32 = 1;
/// The button that cycles the filter.
pub const FILTER_BUTTON: u32 = 2;
/// The button that turns the page back.
pub const PREVIOUS: u32 = 3;
/// The button that turns the page forward.
pub const NEXT: u32 = 4;
/// The button that reads the list again.
pub const REFRESH: u32 = 5;
/// The button that takes the search back.
pub const CLEAR_SEARCH: u32 = 6;
/// The button that asks for a mod to be turned on or off.
pub const TOGGLE: u32 = 7;
/// The button that cycles the page size.
pub const PAGE_SIZE: u32 = 8;
/// The button that turns reading the list on open on or off.
pub const REFRESH_ON_OPEN: u32 = 9;
/// The button that opens the menu from the settings page.
pub const OPEN_MENU: u32 = 10;

/// The file the launcher writes the installed mods into.
pub const FEED: &str = "inventory.json";
/// The file the changes the player asked for are kept in.
pub const PENDING_FILE: &str = "pending.json";

const WHITE: u32 = 0xFFFFFF;
const GREY: u32 = 0xAAAAAA;
const GREEN: u32 = 0x55FF55;
const RED: u32 = 0xFF5555;
const YELLOW: u32 = 0xFFFF55;

/// A line of text.
fn text(value: impl Into<String>, color: u32) -> Widget {
    Widget::Text(TextWidget {
        id: 0,
        text: value.into(),
        color,
    })
}

/// A button the player can press.
fn button(id: u32, label: impl Into<String>) -> Widget {
    Widget::Button(ButtonWidget {
        id,
        label: label.into(),
    })
}

/// The menu's state.
pub struct Menu {
    /// The installed mods, as the feed lists them.
    pub mods: Vec<InstalledMod>,
    /// Why the list is empty, when it is.
    pub error: Option<String>,
    /// Which mods the list shows.
    pub filter: Filter,
    /// What the player searched for.
    pub query: String,
    /// The page of the list on screen.
    pub page: usize,
    /// The row picked on the page, the index within it.
    pub selected: Option<usize>,
    /// How many rows a page holds.
    pub page_size: usize,
    /// Whether the list is read again each time the menu opens.
    pub refresh_on_open: bool,
    /// The changes the player asked for.
    pub pending: Pending,
    /// The menu's own settings.
    pub settings: Settings,
    /// Whether the menu's page in Options > Mods is the one on screen.
    pub in_settings: bool,
}

impl Menu {
    /// A menu with the player's settings and nothing else.
    pub fn new(settings: Settings) -> Self {
        let filter = settings.filter();
        let page_size = settings.page_size;
        let refresh_on_open = settings.refresh_on_open;
        Self {
            mods: Vec::new(),
            error: None,
            filter,
            query: String::new(),
            page: 0,
            selected: None,
            page_size,
            refresh_on_open,
            pending: Pending::default(),
            settings,
            in_settings: false,
        }
    }

    /// Reads the feed the launcher wrote, the changes waiting and the
    /// player's settings.
    pub fn read(&mut self) {
        let result = storage::get(FEED)
            .ok_or_else(|| {
                "No inventory feed. Update the launcher, then reopen the game.".to_owned()
            })
            .and_then(|bytes| model::parse(&bytes));
        match result {
            Ok(inventory) => {
                self.mods = inventory.mods;
                self.error = None;
            }
            Err(error) => {
                self.mods.clear();
                self.error = Some(error);
            }
        }
        self.pending = storage::get(PENDING_FILE)
            .map(|bytes| Pending::parse(&bytes))
            .unwrap_or_default();
        self.page = 0;
        self.selected = None;
    }

    /// Keeps the player's settings.
    pub fn save_settings(&self) {
        let _ = storage::set(crate::settings::FILE, self.settings.to_bytes());
    }

    /// Keeps the changes the player asked for.
    pub fn save_pending(&self) {
        let _ = storage::set(PENDING_FILE, self.pending.to_bytes());
    }

    /// The mods the filter and the search keep.
    pub fn rows(&self) -> Vec<&InstalledMod> {
        model::matching(&self.mods, self.filter, &self.query)
    }

    /// The page on screen, never past the last one: the launcher may have
    /// installed fewer mods since the menu was opened.
    pub fn current_page(&self) -> usize {
        model::clamp_page(self.page, self.rows().len(), self.page_size)
    }

    /// The rows of the page on screen.
    pub fn page_rows(&self) -> Vec<&InstalledMod> {
        let rows = self.rows();
        let page = self.current_page();
        rows.into_iter()
            .skip(page * self.page_size)
            .take(self.page_size)
            .collect()
    }

    /// How many pages the list has.
    pub fn page_count(&self) -> usize {
        model::page_count(self.rows().len(), self.page_size)
    }

    /// The mod whose row is picked, if it is still there.
    pub fn selected_mod(&self) -> Option<&InstalledMod> {
        let rows = self.page_rows();
        self.selected.and_then(|index| rows.get(index).copied())
    }

    /// Whether a mod is on, as the player last asked for it.
    pub fn is_on(&self, id: &str, was: bool) -> bool {
        self.pending.get(id).unwrap_or(was)
    }

    /// Asks for the picked mod to be turned on or off, and keeps the change.
    pub fn toggle_selected(&mut self) {
        let Some((id, enabled)) = self.selected_mod().map(|m| (m.id.clone(), m.enabled)) else {
            return;
        };
        let wanted = !self.is_on(&id, enabled);
        self.pending.set(&id, wanted);
        self.save_pending();
    }

    /// The screen the menu draws.
    pub fn screen(&self) -> Screen {
        Screen {
            title: "Mod Menu".into(),
            widgets: self.widgets(),
        }
    }

    /// The widgets of the menu.
    pub fn widgets(&self) -> Vec<Widget> {
        let mut widgets: Vec<Widget> = Vec::new();
        let enabled = self.mods.iter().filter(|m| m.enabled).count();
        widgets.push(text(
            format!("{} installed | {} enabled", self.mods.len(), enabled),
            WHITE,
        ));
        widgets.push(text("Changes apply on the next launch.", GREY));
        if !self.pending.is_empty() {
            widgets.push(text(
                format!(
                    "{} change(s) waiting for the launcher",
                    self.pending.len()
                ),
                YELLOW,
            ));
        }
        if let Some(error) = &self.error {
            widgets.push(text(error.clone(), RED));
        }
        widgets.push(button(
            FILTER_BUTTON,
            format!("Show: {}", self.filter.label()),
        ));
        if !self.query.is_empty() {
            widgets.push(text(
                format!("Search: {}", model::clean(&self.query)),
                GREY,
            ));
            widgets.push(button(CLEAR_SEARCH, "Clear search"));
        }
        let rows = self.page_rows();
        widgets.push(Widget::List(ListWidget {
            id: LIST,
            rows: rows.iter().map(|m| m.row()).collect(),
            selected: self
                .selected
                .filter(|index| *index < rows.len())
                .map(|index| index as u32),
        }));
        if rows.is_empty() && self.error.is_none() {
            widgets.push(text("No matching installed mods.", GREY));
        }
        if let Some(mod_) = self.selected_mod() {
            widgets.extend(self.details(mod_));
        }
        let page = self.current_page();
        widgets.push(text(
            format!("Page {} / {}", page + 1, self.page_count()),
            GREY,
        ));
        if page > 0 {
            widgets.push(button(PREVIOUS, "Previous page"));
        }
        if page + 1 < self.page_count() {
            widgets.push(button(NEXT, "Next page"));
        }
        widgets.push(button(REFRESH, "Refresh installed mods"));
        widgets
    }

    /// The picked mod's page: what it is, what it may do and the button
    /// that asks for it to be turned on or off.
    fn details(&self, mod_: &InstalledMod) -> Vec<Widget> {
        let mut widgets: Vec<Widget> = Vec::new();
        widgets.push(text(
            format!(
                "{} {}",
                model::clean(&mod_.name),
                model::clean(&mod_.version)
            ),
            WHITE,
        ));
        widgets.push(text(
            format!(
                "ID: {} | Type: {}",
                model::clean(&mod_.id),
                model::clean(&mod_.kind)
            ),
            GREY,
        ));
        if !mod_.source.is_empty() {
            widgets.push(text(
                format!("Source: {}", model::clean(&mod_.source)),
                GREY,
            ));
        }
        if !mod_.authors.is_empty() {
            widgets.push(text(
                format!("Authors: {}", model::clean(&mod_.authors_line())),
                GREY,
            ));
        }
        if !mod_.capabilities.is_empty() {
            widgets.push(text(
                format!("May: {}", model::clean(&mod_.capabilities_line())),
                GREY,
            ));
        }
        for line in model::wrap(&mod_.description, 40, 6) {
            widgets.push(text(line, GREY));
        }
        match &mod_.problem {
            Some(problem) => widgets.push(text(
                format!("Problem: {}", model::clean(problem)),
                RED,
            )),
            None => widgets.push(text(
                if mod_.enabled {
                    "Status: On"
                } else {
                    "Status: Off"
                },
                if mod_.enabled { GREEN } else { GREY },
            )),
        }
        if let Some(wanted) = self.pending.get(&mod_.id) {
            widgets.push(text(
                format!(
                    "Waiting: turn {} {}",
                    model::clean(&mod_.name),
                    if wanted { "on" } else { "off" }
                ),
                YELLOW,
            ));
        }
        let on = self.is_on(&mod_.id, mod_.enabled);
        widgets.push(button(
            TOGGLE,
            format!(
                "{} {}",
                if on { "Disable" } else { "Enable" },
                model::clean(&mod_.name)
            ),
        ));
        widgets
    }

    /// The widgets of the menu's page in Options > Mods.
    pub fn settings_widgets(&self) -> Vec<Widget> {
        vec![
            text("Mod Menu", WHITE),
            text("The mods installed in this instance.", GREY),
            button(
                FILTER_BUTTON,
                format!("Show: {}", self.filter.label()),
            ),
            button(PAGE_SIZE, format!("Rows a page: {}", self.page_size)),
            button(
                REFRESH_ON_OPEN,
                format!(
                    "Read the list on open: {}",
                    if self.refresh_on_open { "On" } else { "Off" }
                ),
            ),
            button(OPEN_MENU, "Open the Mod Menu"),
            text("Open it with M, or with /modmenu.", GREY),
        ]
    }
}
