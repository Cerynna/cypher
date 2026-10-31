use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::State;

use crate::host::{Host, HostState};
use crate::repo::find_repo_root;

const LOCKFILES: [&str; 5] = [
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lock",
    "bun.lockb",
    "package-lock.json",
];

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    root: String,
    porcelain: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    dir: String,
    package_json: String,
    lockfiles: Vec<String>,
}

fn run_git(host: &Host, root: &str, args: &[&str]) -> Result<String, String> {
    let output = host
        .command("git", args, root)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn repo_root_on(host: &Host, cwd: &str) -> Option<String> {
    find_repo_root(&host.fs_path(cwd)).map(|root| host.shell_path(&root))
}

fn git_status_on(host: &Host, cwd: &str) -> Result<Option<GitStatus>, String> {
    let Some(root) = repo_root_on(host, cwd) else {
        return Ok(None);
    };
    let porcelain = run_git(
        host,
        &root,
        &[
            "-c",
            "core.quotePath=false",
            "status",
            "--porcelain=v2",
            "--branch",
            "--untracked-files=all",
        ],
    )?;
    Ok(Some(GitStatus { root, porcelain }))
}

fn git_diff_on(host: &Host, root: &str, path: &str) -> Result<String, String> {
    let pathspec = format!(":(top){path}");
    let against_head = ["--no-pager", "diff", "--no-color", "HEAD", "--", &pathspec];
    run_git(host, root, &against_head).or_else(|_| {
        run_git(
            host,
            root,
            &["--no-pager", "diff", "--no-color", "--", &pathspec],
        )
    })
}

fn manifest_dir(start: &Path, boundary: Option<&Path>) -> Option<PathBuf> {
    start
        .ancestors()
        .take_while(|dir| boundary.is_none_or(|boundary| dir.starts_with(boundary)))
        .find(|dir| dir.join("package.json").is_file())
        .map(Path::to_path_buf)
}

fn manifest_on(host: &Host, cwd: &str) -> Option<ProjectManifest> {
    let start = host.fs_path(cwd);
    let boundary = find_repo_root(&start);
    let dir = manifest_dir(&start, boundary.as_deref())?;
    let package_json = std::fs::read_to_string(dir.join("package.json")).ok()?;
    let lockfiles = LOCKFILES
        .iter()
        .filter(|name| dir.join(name).is_file())
        .map(|name| (*name).to_owned())
        .collect();
    Some(ProjectManifest {
        dir: host.shell_path(&dir),
        package_json,
        lockfiles,
    })
}

#[tauri::command]
pub async fn git_status(
    host: State<'_, HostState>,
    cwd: String,
) -> Result<Option<GitStatus>, String> {
    let host = host.current();
    tauri::async_runtime::spawn_blocking(move || git_status_on(&host, &cwd))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_diff(
    host: State<'_, HostState>,
    root: String,
    path: String,
) -> Result<String, String> {
    let host = host.current();
    tauri::async_runtime::spawn_blocking(move || git_diff_on(&host, &root, &path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn project_manifest(
    host: State<'_, HostState>,
    cwd: String,
) -> Result<Option<ProjectManifest>, String> {
    let host = host.current();
    tauri::async_runtime::spawn_blocking(move || manifest_on(&host, &cwd))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;

    fn sandbox(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("cypher-project-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn git(dir: &Path, args: &[&str]) {
        let status = Command::new("git")
            .args(["-c", "user.name=t", "-c", "user.email=t@t"])
            .args(args)
            .current_dir(dir)
            .status()
            .unwrap();
        assert!(status.success());
    }

    #[test]
    fn trouve_le_package_json_le_plus_proche_sans_sortir_du_depot() {
        let repo = sandbox("manifest");
        fs::create_dir_all(repo.join(".git")).unwrap();
        fs::create_dir_all(repo.join("packages/app/src")).unwrap();
        fs::write(repo.join("package.json"), "{}").unwrap();
        fs::write(repo.join("yarn.lock"), "").unwrap();
        let manifest = manifest_on(
            &Host::Native,
            repo.join("packages/app/src").to_str().unwrap(),
        )
        .unwrap();
        assert_eq!(manifest.dir, repo.to_string_lossy());
        assert_eq!(manifest.lockfiles, ["yarn.lock"]);

        fs::write(repo.join("packages/app/package.json"), "{\"name\":\"app\"}").unwrap();
        let manifest = manifest_on(
            &Host::Native,
            repo.join("packages/app/src").to_str().unwrap(),
        )
        .unwrap();
        assert_eq!(manifest.package_json, "{\"name\":\"app\"}");
    }

    #[test]
    fn ne_remonte_pas_au_dessus_du_depot() {
        let outer = sandbox("outer-manifest");
        fs::write(outer.join("package.json"), "{}").unwrap();
        let repo = outer.join("repo");
        fs::create_dir_all(repo.join(".git")).unwrap();
        assert_eq!(manifest_on(&Host::Native, repo.to_str().unwrap()), None);
    }

    #[test]
    fn donne_le_statut_et_le_diff_d_un_fichier() {
        let repo = sandbox("git");
        git(&repo, &["init", "-q"]);
        fs::write(repo.join("a.txt"), "un\n").unwrap();
        git(&repo, &["add", "."]);
        git(&repo, &["commit", "-qm", "init"]);
        fs::write(repo.join("a.txt"), "deux\n").unwrap();
        fs::create_dir_all(repo.join("src")).unwrap();

        let status = git_status_on(&Host::Native, repo.join("src").to_str().unwrap())
            .unwrap()
            .unwrap();
        assert_eq!(status.root, repo.to_string_lossy());
        assert!(status.porcelain.contains("# branch.head"));
        assert!(status.porcelain.contains(" a.txt"));

        let diff = git_diff_on(&Host::Native, &status.root, "a.txt").unwrap();
        assert!(diff.contains("-un") && diff.contains("+deux"));
    }

    #[test]
    fn ignore_un_dossier_hors_depot() {
        assert_eq!(git_status_on(&Host::Native, "/proc/self").unwrap(), None);
    }
}
