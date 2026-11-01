//! Mod Menu for Horizon: the menu the usual mod menus have, for the mods a
//! Horizon instance has installed.
//!
//! Press **M** while playing, or type **`/modmenu`** (with a word to search
//! for), to open it. The list shows every installed mod, the filter and the
//! search narrow it, and the picked mod's page says what it is and asks for
//! it to be turned on or off.
//!
//! The list comes from the launcher: it writes what it found in the
//! instance's `horizon-mods/` and `horizon-native-mods/` folders into this
//! mod's own storage, and the menu reads it there. A sandboxed mod may only
//! write its own folder, so the changes the player asks for are kept there
//! too and the launcher applies them before the next launch.
//!
//! See `docs/behavior.md` for what the menu does, key by key, and
//! `docs/inventory-feed.md` for the file the launcher writes.
pub mod menu;
pub mod model;
pub mod pending;
pub mod settings;

use horizon_mod_sdk::{Mod, Registration, input, ui};
use menu::Menu;

/// The key that opens the menu. The player may rebind it on this mod's page
/// in Options > Mods, where the game lists the mod's keys.
const OPEN_KEY: &str = "key.keyboard.m";

/// The name the key is registered under.
const OPEN_KEY_NAME: &str = "open";

/// The Mod Menu.
pub struct ModMenu {
    menu: Menu,
}

impl ModMenu {
    /// Draws the menu: the screen, or the page in Options > Mods when that
    /// is the one open.
    fn show(&self) {
        if self.menu.in_settings {
            ui::set_settings(&self.menu.settings_widgets());
        } else {
            ui::open_screen(&self.menu.screen());
        }
    }

    /// Keeps the player's settings and draws them again.
    fn save_settings(&mut self) {
        let filter = self.menu.filter;
        self.menu.settings.set_filter(filter);
        self.menu.save_settings();
    }
}

impl Mod for ModMenu {
    fn init() -> Result<(Self, Registration), String> {
        input::register_key(OPEN_KEY_NAME, "Open Mod Menu", OPEN_KEY)?;
        let mut menu = Menu::new(settings::load());
        menu.read();
        let mut mod_menu = ModMenu { menu };
        // The page in Options > Mods is filled once, so it has something to
        // show before the player opens it.
        mod_menu.menu.in_settings = true;
        mod_menu.show();
        mod_menu.menu.in_settings = false;
        Ok((
            mod_menu,
            Registration::new().command("modmenu").on_tick(),
        ))
    }

    fn tick(&mut self, _tick: u64) {
        // Every tick, so the events do not pile up.
        let pressed = input::poll().iter().any(|event| {
            matches!(event, input::Event::KeyDown(name) if name == OPEN_KEY_NAME)
        });
        if !pressed {
            return;
        }
        self.menu.in_settings = false;
        if self.menu.refresh_on_open {
            self.menu.read();
        }
        self.show();
    }

    fn command(&mut self, _name: &str, args: &str) -> Result<Option<String>, String> {
        self.menu.in_settings = false;
        self.menu.query = args.trim().to_owned();
        self.menu.read();
        self.show();
        Ok(None)
    }

    fn ui_settings_opened(&mut self) {
        self.menu.in_settings = true;
        self.menu.read();
        self.show();
    }

    fn ui_select(&mut self, id: u32, row: u32) {
        match id {
            menu::LIST => self.menu.selected = Some(row as usize),
            menu::FILTER_BUTTON => {
                self.menu.filter = self.menu.filter.next();
                self.menu.page = 0;
                self.menu.selected = None;
                self.save_settings();
            }
            menu::PREVIOUS => {
                self.menu.page = self.menu.page.saturating_sub(1);
                self.menu.selected = None;
            }
            menu::NEXT => {
                let pages = self.menu.page_count();
                self.menu.page = (self.menu.page + 1).min(pages - 1);
                self.menu.selected = None;
            }
            menu::REFRESH => self.menu.read(),
            menu::CLEAR_SEARCH => {
                self.menu.query.clear();
                self.menu.page = 0;
                self.menu.selected = None;
            }
            menu::TOGGLE => self.menu.toggle_selected(),
            menu::PAGE_SIZE => {
                self.menu.page_size = self.menu.settings.next_page_size();
                self.menu.page = 0;
                self.menu.selected = None;
                self.save_settings();
            }
            menu::REFRESH_ON_OPEN => {
                self.menu.refresh_on_open = !self.menu.refresh_on_open;
                self.save_settings();
            }
            menu::OPEN_MENU => {
                self.menu.in_settings = false;
                self.menu.read();
                self.show();
                return;
            }
            _ => return,
        }
        self.show();
    }
}

horizon_mod_sdk::export_mod!(ModMenu);
