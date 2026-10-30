use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use tauri::{AppHandle, Manager};

use crate::executable::find_in_path;

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

#[tauri::command]
pub fn existing_paths(app: AppHandle, cwd: Option<String>, paths: Vec<String>) -> Vec<Option<String>> {
    let home = app.path().home_dir().ok();
    let cwd = cwd.map(PathBuf::from);
    paths
        .iter()
        .map(|path| {
            resolve_existing(path, cwd.as_deref(), home.as_deref())
                .map(|resolved| resolved.to_string_lossy().into_owned())
        })
        .collect()
}

#[tauri::command]
pub fn open_in_editor(program: String, args: Vec<String>) -> Result<(), String> {
    let executable =
        find_in_path(&program).ok_or_else(|| format!("éditeur introuvable : {program}"))?;
    Command::new(executable)
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
