use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use tauri::{AppHandle, State};

use crate::executable::find_in_path;
use crate::host::{Host, HostState, hide_console};
use crate::wsl;

fn expand_home(path: &str, home: Option<&Path>) -> PathBuf {
    match (path.strip_prefix("~/"), home) {
        (Some(rest), Some(home)) => home.join(rest),
        _ => PathBuf::from(path),
    }
}

pub fn resolve_existing(path: &str, cwd: Option<&Path>, home: Option<&Path>) -> Option<PathBuf> {
    let expanded = expand_home(path, home);
    let candidate = match cwd {
        Some(cwd) if expanded.is_relative() => cwd.join(expanded),
        _ => expanded,
    };
    candidate.is_file().then_some(candidate)
}

fn existing_on_host(
    host: &Host,
    home: Option<String>,
    cwd: Option<String>,
    paths: &[String],
) -> Vec<Option<String>> {
    match host {
        Host::Native => {
            let home = home.map(PathBuf::from);
            let cwd = cwd.map(PathBuf::from);
            paths
                .iter()
                .map(|path| {
                    resolve_existing(path, cwd.as_deref(), home.as_deref())
                        .map(|resolved| resolved.to_string_lossy().into_owned())
                })
                .collect()
        }
        Host::Wsl { home, .. } => {
            let cwd = cwd.unwrap_or_else(|| home.clone());
            paths
                .iter()
                .map(|path| {
                    let linux = wsl::resolve_posix(path, &cwd, home);
                    host.fs_path(&linux).is_file().then_some(linux)
                })
                .collect()
        }
    }
}

#[tauri::command]
pub async fn existing_paths(
    app: AppHandle,
    host: State<'_, HostState>,
    cwd: Option<String>,
    paths: Vec<String>,
) -> Result<Vec<Option<String>>, String> {
    let host = host.current();
    let home = host.home(&app);
    tauri::async_runtime::spawn_blocking(move || existing_on_host(&host, home, cwd, &paths))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_in_editor(program: String, args: Vec<String>) -> Result<(), String> {
    let executable =
        find_in_path(&program).ok_or_else(|| format!("éditeur introuvable : {program}"))?;
    hide_console(&mut Command::new(executable))
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(drop)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn sandbox() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cypher-editor-{}", std::process::id()));
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::write(dir.join("src/main.ts"), "").unwrap();
        dir
    }

    #[test]
    fn resout_un_chemin_relatif_depuis_le_dossier_courant() {
        let dir = sandbox();
        assert_eq!(
            resolve_existing("src/main.ts", Some(&dir), None),
            Some(dir.join("src/main.ts"))
        );
    }

    #[test]
    fn developpe_le_tilde() {
        let dir = sandbox();
        assert_eq!(
            resolve_existing("~/src/main.ts", None, Some(&dir)),
            Some(dir.join("src/main.ts"))
        );
    }

    #[test]
    fn ignore_les_fichiers_absents_et_les_dossiers() {
        let dir = sandbox();
        assert_eq!(resolve_existing("absent.ts", Some(&dir), None), None);
        assert_eq!(resolve_existing("src", Some(&dir), None), None);
    }
}
