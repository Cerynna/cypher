use std::path::{Path, PathBuf};

use tauri::State;

use crate::host::HostState;

pub fn find_repo_root(dir: &Path) -> Option<PathBuf> {
    dir.ancestors()
        .find(|ancestor| ancestor.join(".git").exists())
        .map(Path::to_path_buf)
}

#[tauri::command]
pub async fn repo_root(host: State<'_, HostState>, cwd: String) -> Result<Option<String>, String> {
    let host = host.current();
    tauri::async_runtime::spawn_blocking(move || {
        find_repo_root(&host.fs_path(&cwd)).map(|root| host.shell_path(&root))
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn sandbox(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cypher-repo-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn trouve_la_racine_depuis_un_sous_dossier() {
        let repo = sandbox("nested");
        fs::create_dir_all(repo.join(".git")).unwrap();
        fs::create_dir_all(repo.join("src/domain")).unwrap();
        assert_eq!(find_repo_root(&repo.join("src/domain")), Some(repo.clone()));
        assert_eq!(find_repo_root(&repo), Some(repo));
    }

    #[test]
    fn reconnait_un_worktree_ou_sous_module_dont_git_est_un_fichier() {
        let worktree = sandbox("worktree");
        fs::write(worktree.join(".git"), "gitdir: /ailleurs/.git/worktrees/x").unwrap();
        assert_eq!(find_repo_root(&worktree), Some(worktree));
    }

    #[test]
    fn prend_le_depot_le_plus_proche() {
        let outer = sandbox("outer");
        fs::create_dir_all(outer.join(".git")).unwrap();
        let inner = outer.join("vendor/lib");
        fs::create_dir_all(inner.join(".git")).unwrap();
        fs::create_dir_all(inner.join("src")).unwrap();
        assert_eq!(find_repo_root(&inner.join("src")), Some(inner));
        assert_eq!(find_repo_root(&outer.join("vendor")), Some(outer));
    }

    #[test]
    fn ne_trouve_rien_hors_d_un_depot() {
        assert_eq!(find_repo_root(Path::new("/proc/self")), None);
    }
}
