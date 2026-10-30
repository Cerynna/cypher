use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Instant;

use serde::Serialize;

const MAX_OUTPUT_BYTES: usize = 64 * 1024;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundResult {
    exit_code: Option<i32>,
    duration_ms: u64,
    output: String,
}

fn shell_invocation(command: &str) -> Command {
    let mut invocation = if cfg!(windows) {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", command]);
        cmd
    } else {
        let mut sh = Command::new("sh");
        sh.args(["-c", command]);
        sh
    };
    invocation.stdin(Stdio::null());
    invocation
}

fn tail(text: &str, max_bytes: usize) -> &str {
    if text.len() <= max_bytes {
        return text;
    }
    let mut start = text.len() - max_bytes;
    while !text.is_char_boundary(start) {
        start += 1;
    }
    &text[start..]
}

fn execute(command: &str, cwd: Option<&str>) -> Result<BackgroundResult, String> {
    let mut invocation = shell_invocation(command);
    if let Some(dir) = cwd.map(Path::new).filter(|dir| dir.is_dir()) {
        invocation.current_dir(dir);
    }
    let started = Instant::now();
    let output = invocation.output().map_err(|e| e.to_string())?;
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    Ok(BackgroundResult {
        exit_code: output.status.code(),
        duration_ms: started.elapsed().as_millis().try_into().unwrap_or(u64::MAX),
        output: tail(&combined, MAX_OUTPUT_BYTES).to_owned(),
    })
}

#[tauri::command]
pub async fn run_background(command: String, cwd: Option<String>) -> Result<BackgroundResult, String> {
    tauri::async_runtime::spawn_blocking(move || execute(&command, cwd.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn renvoie_le_code_de_sortie_et_la_sortie_combinee() {
        let result = execute("echo bonjour; echo oups >&2; exit 3", None).unwrap();
        assert_eq!(result.exit_code, Some(3));
        assert_eq!(result.output, "bonjour\noups\n");
    }

    #[test]
    fn s_execute_dans_le_dossier_demande() {
        let dir = std::env::temp_dir();
        let result = execute("pwd", dir.to_str()).unwrap();
        let reported = std::fs::canonicalize(result.output.trim()).unwrap();
        assert_eq!(reported, std::fs::canonicalize(&dir).unwrap());
    }

    #[test]
    fn coupe_la_sortie_sur_une_frontiere_de_caractere() {
        assert_eq!(tail("ééé", 3), "é");
        assert_eq!(tail("abc", 10), "abc");
    }
}
