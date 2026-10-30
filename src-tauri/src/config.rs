use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

pub const CONFIG_CHANGED_EVENT: &str = "config-changed";
const CONFIG_FILE_NAME: &str = "config.toml";

pub struct ConfigWatcher(#[allow(dead_code)] Mutex<RecommendedWatcher>);

#[derive(Serialize)]
pub struct ConfigFile {
    path: String,
    content: Option<String>,
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    Ok(home.join(".config").join("cypher"))
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join(CONFIG_FILE_NAME))
}

fn write_atomically(path: &Path, content: &str) -> std::io::Result<()> {
    let temporary = path.with_extension("toml.tmp");
    fs::write(&temporary, content)?;
    fs::rename(&temporary, path)
}

#[tauri::command]
pub fn config_read(app: AppHandle) -> Result<ConfigFile, String> {
    let path = config_path(&app)?;
    let content = fs::read_to_string(&path).ok();
    Ok(ConfigFile {
        path: path.to_string_lossy().into_owned(),
        content,
    })
}

#[tauri::command]
pub fn config_write(app: AppHandle, content: String) -> Result<(), String> {
    let dir = config_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    write_atomically(&dir.join(CONFIG_FILE_NAME), &content).map_err(|e| e.to_string())
}

fn concerns_config(event: &notify::Event) -> bool {
    !matches!(event.kind, EventKind::Access(_))
        && event.paths.iter().any(|path| {
            path.file_name()
                .is_some_and(|name| name == CONFIG_FILE_NAME)
        })
}

pub fn watch(app: &AppHandle) -> Result<ConfigWatcher, String> {
    let dir = config_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let emitter = app.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        if result.as_ref().is_ok_and(concerns_config) {
            let _ = emitter.emit(CONFIG_CHANGED_EVENT, ());
        }
    })
    .map_err(|e| e.to_string())?;
    watcher
        .watch(&dir, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    Ok(ConfigWatcher(Mutex::new(watcher)))
}
