use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::RwLock;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::config::ConfigState;
use crate::wsl;

#[derive(Clone, Debug, Default, PartialEq)]
pub enum Host {
    #[default]
    Native,
    Wsl {
        distro: String,
        home: String,
    },
}

impl Host {
    pub fn fs_path(&self, path: &str) -> PathBuf {
        match self {
            Host::Native => PathBuf::from(path),
            Host::Wsl { distro, .. } => wsl::to_unc(distro, path),
        }
    }

    pub fn shell_path(&self, path: &Path) -> String {
        match self {
            Host::Native => path.to_string_lossy().into_owned(),
            Host::Wsl { distro, .. } => {
                wsl::from_unc(distro, path).unwrap_or_else(|| path.to_string_lossy().into_owned())
            }
        }
    }

    pub fn command(&self, program: &str, args: &[&str], cwd: &str) -> Command {
        let mut command = match self {
            Host::Native => {
                let mut native = Command::new(program);
                native.args(args).current_dir(cwd);
                native
            }
            Host::Wsl { distro, .. } => {
                let mut wsl = Command::new("wsl.exe");
                wsl.args(["-d", distro, "--cd", cwd, "--exec", program])
                    .args(args);
                wsl
            }
        };
        hide_console(&mut command).stdin(Stdio::null());
        command
    }

    pub fn home(&self, app: &AppHandle) -> Option<String> {
        match self {
            Host::Native => app
                .path()
                .home_dir()
                .ok()
                .map(|home| home.to_string_lossy().into_owned()),
            Host::Wsl { home, .. } => Some(home.clone()),
        }
    }
}

#[derive(Default)]
pub struct HostState(RwLock<Host>);

impl HostState {
    pub fn current(&self) -> Host {
        self.0.read().map(|host| host.clone()).unwrap_or_default()
    }
}

pub fn hide_console(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn wsl_output(args: &[&str]) -> Option<String> {
    let output = hide_console(Command::new("wsl.exe").args(args))
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| wsl::decode_output(&output.stdout))
}

fn resolve_wsl(mode: &str) -> Option<Host> {
    if !cfg!(windows) || mode == "off" {
        return None;
    }
    let distro = if mode == "auto" {
        wsl::default_distro(&wsl_output(&["--list", "--verbose"])?)?
    } else {
        mode.to_owned()
    };
    let home = wsl_output(&["-d", &distro, "--exec", "sh", "-c", "printf %s \"$HOME\""])?;
    let home = home.trim();
    (!home.is_empty()).then(|| Host::Wsl {
        distro,
        home: home.to_owned(),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    kind: &'static str,
    distro: Option<String>,
    config_error: Option<String>,
}

#[tauri::command]
pub async fn host_configure(
    app: AppHandle,
    state: State<'_, HostState>,
    mode: String,
) -> Result<HostInfo, String> {
    let (host, shared) = tauri::async_runtime::spawn_blocking(move || {
        let host = resolve_wsl(&mode).unwrap_or_default();
        let shared = app.state::<ConfigState>().share_with(&app, &host);
        (host, shared)
    })
    .await
    .map_err(|e| e.to_string())?;
    let config_error = shared.err();
    let info = match &host {
        Host::Native => HostInfo {
            kind: "native",
            distro: None,
            config_error,
        },
        Host::Wsl { distro, .. } => HostInfo {
            kind: "wsl",
            distro: Some(distro.clone()),
            config_error,
        },
    };
    *state.0.write().map_err(|e| e.to_string())? = host;
    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ubuntu() -> Host {
        Host::Wsl {
            distro: String::from("Ubuntu"),
            home: String::from("/home/jm"),
        }
    }

    #[test]
    fn traduit_les_chemins_vers_le_systeme_de_fichiers_de_l_hote() {
        assert_eq!(Host::Native.fs_path("/home/jm"), PathBuf::from("/home/jm"));
        assert_eq!(
            ubuntu().fs_path("/home/jm/.claude"),
            PathBuf::from(r"\\wsl.localhost\Ubuntu\home\jm\.claude")
        );
    }

    #[test]
    fn rend_les_chemins_tels_que_le_shell_les_voit() {
        let unc = PathBuf::from(r"\\wsl.localhost\Ubuntu\home\jm\cypher");
        assert_eq!(ubuntu().shell_path(&unc), "/home/jm/cypher");
        assert_eq!(Host::Native.shell_path(Path::new("/srv")), "/srv");
    }

    #[test]
    fn lance_un_programme_dans_wsl_sans_shell_intermediaire() {
        let command = ubuntu().command("git", &["status", "--porcelain=v2"], "/home/jm/cypher");
        let args: Vec<_> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert_eq!(command.get_program(), "wsl.exe");
        assert_eq!(
            args,
            [
                "-d",
                "Ubuntu",
                "--cd",
                "/home/jm/cypher",
                "--exec",
                "git",
                "status",
                "--porcelain=v2"
            ]
        );
    }

    #[test]
    fn reste_natif_hors_de_windows_ou_quand_wsl_est_desactive() {
        assert_eq!(resolve_wsl("off"), None);
        if !cfg!(windows) {
            assert_eq!(resolve_wsl("auto"), None);
            assert_eq!(resolve_wsl("Ubuntu"), None);
        }
    }
}
