use std::env;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};

const MAX_SCANNED_LINES: usize = 400;
const MAX_PREVIEW_CHARS: usize = 140;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSession {
    id: String,
    created_ms: u64,
    modified_ms: u64,
    preview: Option<String>,
}

pub fn project_dir_name(cwd: &str) -> String {
    cwd.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

fn millis(time: std::io::Result<SystemTime>) -> Option<u64> {
    let elapsed = time.ok()?.duration_since(UNIX_EPOCH).ok()?;
    elapsed.as_millis().try_into().ok()
}

fn message_text(entry: &Value) -> Option<String> {
    let content = &entry["message"]["content"];
    if let Some(text) = content.as_str() {
        return Some(text.to_owned());
    }
    content
        .as_array()?
        .iter()
        .filter(|block| block["type"] == "text")
        .find_map(|block| block["text"].as_str().map(str::to_owned))
}

fn summarize(text: &str) -> Option<String> {
    let line = text.lines().map(str::trim).find(|line| !line.is_empty())?;
    if line.starts_with('<') {
        return None;
    }
    let mut preview: String = line.chars().take(MAX_PREVIEW_CHARS).collect();
    if line.chars().count() > MAX_PREVIEW_CHARS {
        preview.push('…');
    }
    Some(preview)
}

pub fn first_prompt(path: &Path) -> Option<String> {
    let reader = BufReader::new(File::open(path).ok()?);
    reader
        .lines()
        .take(MAX_SCANNED_LINES)
        .map_while(Result::ok)
        .filter_map(|line| serde_json::from_str::<Value>(&line).ok())
        .filter(|entry| entry["type"] == "user" && entry["isMeta"] != true)
        .find_map(|entry| message_text(&entry).as_deref().and_then(summarize))
}

pub fn list_sessions(project_dir: &Path, limit: usize) -> Vec<ClaudeSession> {
    let Ok(entries) = fs::read_dir(project_dir) else {
        return Vec::new();
    };
    let mut sessions: Vec<ClaudeSession> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "jsonl"))
        .filter_map(|path| {
            let metadata = fs::metadata(&path).ok()?;
            let modified_ms = millis(metadata.modified())?;
            Some(ClaudeSession {
                id: path.file_stem()?.to_str()?.to_owned(),
                created_ms: millis(metadata.created()).unwrap_or(modified_ms),
                modified_ms,
                preview: first_prompt(&path),
            })
        })
        .collect();
    sessions.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    sessions.truncate(limit);
    sessions
}

fn claude_home(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = env::var_os("CLAUDE_CONFIG_DIR") {
        return Ok(PathBuf::from(dir));
    }
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    Ok(home.join(".claude"))
}

#[tauri::command]
pub async fn claude_sessions(app: AppHandle, cwd: String, limit: usize) -> Result<Vec<ClaudeSession>, String> {
    let project_dir = claude_home(&app)?.join("projects").join(project_dir_name(&cwd));
    tauri::async_runtime::spawn_blocking(move || list_sessions(&project_dir, limit))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sandbox(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("cypher-claude-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn encode_le_dossier_comme_claude_code() {
        assert_eq!(project_dir_name("/home/jm/Labo/cypher"), "-home-jm-Labo-cypher");
        assert_eq!(project_dir_name("/home/jm/my.app_v2"), "-home-jm-my-app-v2");
    }

    #[test]
    fn retrouve_le_premier_vrai_message_de_l_utilisateur() {
        let dir = sandbox("preview");
        let file = dir.join("abc.jsonl");
        let lines = [
            r#"{"type":"mode"}"#,
            r#"{"type":"user","isMeta":true,"message":{"content":"meta"}}"#,
            r#"{"type":"user","message":{"content":"<command-name>/clear</command-name>"}}"#,
            r#"{"type":"user","message":{"content":[{"type":"text","text":"\nAjoute le mode Quake\nmerci"}]}}"#,
        ];
        fs::write(&file, lines.join("\n")).unwrap();
        assert_eq!(first_prompt(&file).as_deref(), Some("Ajoute le mode Quake"));
    }

    #[test]
    fn liste_les_sessions_de_la_plus_recente_a_la_plus_ancienne() {
        let dir = sandbox("list");
        fs::write(dir.join("old.jsonl"), r#"{"type":"user","message":{"content":"ancienne"}}"#).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(dir.join("new.jsonl"), r#"{"type":"user","message":{"content":"récente"}}"#).unwrap();
        fs::write(dir.join("notes.txt"), "ignoré").unwrap();
        let sessions = list_sessions(&dir, 10);
        let ids: Vec<&str> = sessions.iter().map(|session| session.id.as_str()).collect();
        assert_eq!(ids, ["new", "old"]);
        assert_eq!(sessions[0].preview.as_deref(), Some("récente"));
        assert_eq!(list_sessions(&dir, 1).len(), 1);
    }

    #[test]
    fn renvoie_une_liste_vide_si_le_dossier_n_existe_pas() {
        assert!(list_sessions(Path::new("/nonexistent/cypher"), 5).is_empty());
    }
}
