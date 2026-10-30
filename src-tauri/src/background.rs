use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

use serde::Serialize;
use tauri::State;

use crate::host::{Host, HostState, hide_console};

const MAX_OUTPUT_BYTES: usize = 64 * 1024;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundResult {
    exit_code: Option<i32>,
    duration_ms: u64,
    output: String,
    cancelled: bool,
}

#[derive(Default)]
pub struct BackgroundState(Mutex<HashMap<String, u32>>);

impl BackgroundState {
    fn register(&self, id: &str, pid: u32) {
        if let Ok(mut running) = self.0.lock() {
            running.insert(id.to_owned(), pid);
        }
    }

    fn unregister(&self, id: &str) -> Option<u32> {
        self.0.lock().ok()?.remove(id)
    }

    pub fn terminate_all(&self) {
        let pids: Vec<u32> = self
            .0
            .lock()
            .map(|mut running| running.drain().map(|(_, pid)| pid).collect())
            .unwrap_or_default();
        for pid in pids {
            terminate_tree(pid);
        }
    }
}

#[derive(Default)]
struct TailBuffer {
    bytes: Vec<u8>,
}

impl TailBuffer {
    fn push(&mut self, chunk: &[u8]) {
        self.bytes.extend_from_slice(chunk);
        if self.bytes.len() > MAX_OUTPUT_BYTES * 2 {
            let excess = self.bytes.len() - MAX_OUTPUT_BYTES;
            self.bytes.drain(..excess);
        }
    }

    fn into_text(self) -> String {
        let start = self.bytes.len().saturating_sub(MAX_OUTPUT_BYTES);
        let text = String::from_utf8_lossy(&self.bytes[start..]).into_owned();
        text.trim_start_matches('\u{FFFD}').to_owned()
    }
}

fn shell_invocation(host: &Host, command: &str, cwd: Option<&str>) -> Command {
    let mut invocation = if let Host::Wsl { distro, .. } = host {
        let mut wsl = Command::new("wsl.exe");
        wsl.args(["-d", distro]);
        if let Some(dir) = cwd.filter(|dir| host.fs_path(dir).is_dir()) {
            wsl.args(["--cd", dir]);
        }
        wsl.args(["--", "sh", "-c", command]);
        wsl
    } else if cfg!(windows) {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", command]);
        cmd
    } else {
        let mut sh = Command::new("sh");
        sh.args(["-c", command]);
        sh
    };
    if let (Host::Native, Some(dir)) = (host, cwd.map(Path::new).filter(|dir| dir.is_dir())) {
        invocation.current_dir(dir);
    }
    #[cfg(unix)]
    std::os::unix::process::CommandExt::process_group(&mut invocation, 0);
    hide_console(&mut invocation);
    invocation
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    invocation
}

fn terminate_tree(pid: u32) {
    let mut killer = if cfg!(windows) {
        let mut taskkill = Command::new("taskkill");
        taskkill.args(["/T", "/F", "/PID", &pid.to_string()]);
        taskkill
    } else {
        let mut kill = Command::new("kill");
        kill.args(["-TERM", "--", &format!("-{pid}")]);
        kill
    };
    let _ = hide_console(&mut killer)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

fn collect(
    stream: Option<impl Read + Send + 'static>,
    buffer: Arc<Mutex<TailBuffer>>,
) -> Option<thread::JoinHandle<()>> {
    let mut stream = stream?;
    Some(thread::spawn(move || {
        let mut chunk = [0u8; 8192];
        while let Ok(read) = stream.read(&mut chunk) {
            if read == 0 {
                break;
            }
            if let Ok(mut buffer) = buffer.lock() {
                buffer.push(&chunk[..read]);
            }
        }
    }))
}

fn wait_with_output(mut child: Child) -> std::io::Result<(Option<i32>, String)> {
    let buffer = Arc::new(Mutex::new(TailBuffer::default()));
    let readers = [
        collect(child.stdout.take(), Arc::clone(&buffer)),
        collect(child.stderr.take(), Arc::clone(&buffer)),
    ];
    let status = child.wait()?;
    for reader in readers.into_iter().flatten() {
        let _ = reader.join();
    }
    let output = Arc::try_unwrap(buffer)
        .ok()
        .and_then(|buffer| buffer.into_inner().ok())
        .unwrap_or_default()
        .into_text();
    Ok((status.code(), output))
}

fn execute(
    state: &BackgroundState,
    host: &Host,
    id: &str,
    command: &str,
    cwd: Option<&str>,
) -> Result<BackgroundResult, String> {
    let mut invocation = shell_invocation(host, command, cwd);
    let started = Instant::now();
    let child = invocation.spawn().map_err(|e| e.to_string())?;
    state.register(id, child.id());
    let outcome = wait_with_output(child);
    let cancelled = state.unregister(id).is_none();
    let (exit_code, output) = outcome.map_err(|e| e.to_string())?;
    Ok(BackgroundResult {
        exit_code,
        duration_ms: started.elapsed().as_millis().try_into().unwrap_or(u64::MAX),
        output,
        cancelled,
    })
}

#[tauri::command]
pub async fn run_background(
    state: State<'_, Arc<BackgroundState>>,
    host: State<'_, HostState>,
    id: String,
    command: String,
    cwd: Option<String>,
) -> Result<BackgroundResult, String> {
    let state = Arc::clone(&state);
    let host = host.current();
    tauri::async_runtime::spawn_blocking(move || {
        execute(&state, &host, &id, &command, cwd.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn cancel_background(state: State<'_, Arc<BackgroundState>>, id: String) {
    if let Some(pid) = state.unregister(&id) {
        terminate_tree(pid);
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn renvoie_le_code_de_sortie_et_la_sortie_combinee() {
        let state = BackgroundState::default();
        let result = execute(
            &state,
            &Host::Native,
            "a",
            "echo bonjour; sleep 0.05; echo oups >&2; exit 3",
            None,
        )
        .unwrap();
        assert_eq!(result.exit_code, Some(3));
        assert_eq!(result.output, "bonjour\noups\n");
        assert!(!result.cancelled);
    }

    #[test]
    fn s_execute_dans_le_dossier_demande() {
        let dir = std::env::temp_dir();
        let result = execute(
            &BackgroundState::default(),
            &Host::Native,
            "b",
            "pwd",
            dir.to_str(),
        )
        .unwrap();
        let reported = std::fs::canonicalize(result.output.trim()).unwrap();
        assert_eq!(reported, std::fs::canonicalize(&dir).unwrap());
    }

    #[test]
    fn ne_garde_que_la_fin_d_une_sortie_volumineuse() {
        let result = execute(
            &BackgroundState::default(),
            &Host::Native,
            "c",
            "yes abcdefgh | head -c 1000000; echo FIN",
            None,
        )
        .unwrap();
        assert!(result.output.len() <= MAX_OUTPUT_BYTES);
        assert!(result.output.ends_with("FIN\n"));
    }

    #[test]
    fn arrete_la_commande_et_ses_sous_processus() {
        let state = Arc::new(BackgroundState::default());
        let runner = {
            let state = Arc::clone(&state);
            thread::spawn(move || {
                execute(
                    &state,
                    &Host::Native,
                    "d",
                    "sleep 30 & sleep 30; wait",
                    None,
                )
            })
        };
        thread::sleep(Duration::from_millis(200));
        let started = Instant::now();
        let pid = state.unregister("d").unwrap();
        terminate_tree(pid);
        let result = runner.join().unwrap().unwrap();
        assert!(result.cancelled);
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn arrete_tout_a_la_fermeture() {
        let state = Arc::new(BackgroundState::default());
        let runner = {
            let state = Arc::clone(&state);
            thread::spawn(move || execute(&state, &Host::Native, "e", "sleep 30", None))
        };
        thread::sleep(Duration::from_millis(200));
        state.terminate_all();
        assert!(runner.join().unwrap().unwrap().cancelled);
    }

    #[test]
    fn tronque_la_sortie_sur_une_frontiere_de_caractere() {
        let mut buffer = TailBuffer::default();
        buffer.push("é".repeat(MAX_OUTPUT_BYTES).as_bytes());
        let text = buffer.into_text();
        assert!(text.chars().all(|c| c == 'é'));
        assert!(text.len() <= MAX_OUTPUT_BYTES);
    }
}
