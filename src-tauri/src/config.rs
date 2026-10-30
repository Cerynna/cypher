use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, RwLock};
use std::time::Duration;

use notify::{EventKind, PollWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::host::Host;

pub const CONFIG_CHANGED_EVENT: &str = "config-changed";
const CONFIG_FILE_NAME: &str = "config.toml";
const UNC_POLL_INTERVAL: Duration = Duration::from_secs(2);

#[derive(Clone, Debug, PartialEq)]
struct ConfigLocation {
    dir: PathBuf,
    display_dir: String,
}

impl ConfigLocation {
    fn file(&self) -> PathBuf {
        self.dir.join(CONFIG_FILE_NAME)
    }

    fn display_file(&self) -> String {
        let separator = if self.display_dir.starts_with('/') {
            "/"
        } else {
            std::path::MAIN_SEPARATOR_STR
        };
        format!("{}{separator}{CONFIG_FILE_NAME}", self.display_dir)
    }
}

fn shared_location(host: &Host) -> Option<ConfigLocation> {
    let Host::Wsl { home, .. } = host else {
        return None;
    };
    let display_dir = format!("{}/.config/cypher", home.trim_end_matches('/'));
    Some(ConfigLocation {
        dir: host.fs_path(&display_dir),
        display_dir,
    })
}

pub struct ConfigState {
    location: RwLock<ConfigLocation>,
    watcher: Mutex<Option<Box<dyn Watcher + Send>>>,
}

impl ConfigState {
    fn location(&self) -> Result<ConfigLocation, String> {
        self.location
            .read()
            .map(|location| location.clone())
            .map_err(|e| e.to_string())
    }

    fn relocate(
        &self,
        app: &AppHandle,
        location: ConfigLocation,
        poll: bool,
    ) -> Result<(), String> {
        fs::create_dir_all(&location.dir).map_err(|e| e.to_string())?;
        let watcher = watch_dir(app, &location.dir, poll)?;
        *self.location.write().map_err(|e| e.to_string())? = location;
        *self.watcher.lock().map_err(|e| e.to_string())? = Some(watcher);
        Ok(())
    }

    pub fn share_with(&self, app: &AppHandle, host: &Host) -> Result<(), String> {
        let Some(shared) = shared_location(host) else {
            return Ok(());
        };
        let current = self.location()?;
        if current == shared {
            return Ok(());
        }
        if !shared.file().exists() && current.file().exists() {
            fs::create_dir_all(&shared.dir).map_err(|e| e.to_string())?;
            fs::copy(current.file(), shared.file()).map_err(|e| e.to_string())?;
        }
        self.relocate(app, shared, true)
    }
}

#[derive(Serialize)]
pub struct ConfigFile {
    path: String,
    content: Option<String>,
}

fn write_atomically(path: &Path, content: &str) -> std::io::Result<()> {
    let temporary = path.with_extension("toml.tmp");
    fs::write(&temporary, content)?;
    fs::rename(&temporary, path)
}

#[tauri::command]
pub fn config_read(state: State<'_, ConfigState>) -> Result<ConfigFile, String> {
    let location = state.location()?;
    Ok(ConfigFile {
        path: location.display_file(),
        content: fs::read_to_string(location.file()).ok(),
    })
}

#[tauri::command]
pub fn config_write(state: State<'_, ConfigState>, content: String) -> Result<(), String> {
    let location = state.location()?;
    fs::create_dir_all(&location.dir).map_err(|e| e.to_string())?;
    write_atomically(&location.file(), &content).map_err(|e| e.to_string())
}

fn concerns_config(event: &notify::Event) -> bool {
    !matches!(event.kind, EventKind::Access(_))
        && event.paths.iter().any(|path| {
            path.file_name()
                .is_some_and(|name| name == CONFIG_FILE_NAME)
        })
}

fn watch_dir(app: &AppHandle, dir: &Path, poll: bool) -> Result<Box<dyn Watcher + Send>, String> {
    let emitter = app.clone();
    let handler = move |result: notify::Result<notify::Event>| {
        if result.as_ref().is_ok_and(concerns_config) {
            let _ = emitter.emit(CONFIG_CHANGED_EVENT, ());
        }
    };
    // Les chemins \\wsl.localhost ne remontent pas d'événements ReadDirectoryChangesW : on les sonde.
    let mut watcher: Box<dyn Watcher + Send> = if poll {
        let config = notify::Config::default().with_poll_interval(UNC_POLL_INTERVAL);
        Box::new(PollWatcher::new(handler, config).map_err(|e| e.to_string())?)
    } else {
        Box::new(notify::recommended_watcher(handler).map_err(|e| e.to_string())?)
    };
    watcher
        .watch(dir, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    Ok(watcher)
}

pub fn watch(app: &AppHandle) -> Result<ConfigState, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let dir = home.join(".config").join("cypher");
    let state = ConfigState {
        location: RwLock::new(ConfigLocation {
            display_dir: dir.to_string_lossy().into_owned(),
            dir: dir.clone(),
        }),
        watcher: Mutex::new(None),
    };
    let location = state.location()?;
    state.relocate(app, location, false)?;
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partage_la_config_du_home_wsl() {
        let host = Host::Wsl {
            distro: String::from("Ubuntu"),
            home: String::from("/home/jm/"),
        };
        let location = shared_location(&host).unwrap();
        assert_eq!(
            location.dir,
            PathBuf::from(r"\\wsl.localhost\Ubuntu\home\jm\.config\cypher")
        );
        assert_eq!(
            location.display_file(),
            "/home/jm/.config/cypher/config.toml"
        );
    }

    #[test]
    fn garde_la_config_locale_en_natif() {
        assert_eq!(shared_location(&Host::Native), None);
    }
}
