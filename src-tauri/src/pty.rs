use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{Child, ChildKiller, CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::Deserialize;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State};

use crate::executable::{file_stem, find_in_path};
use crate::input_queue::InputQueue;
use crate::read_gate::ReadGate;
use crate::registry::{Registry, SessionId};

const READ_BUFFER_SIZE: usize = 8192;
const MAX_BATCH_SIZE: usize = 256 * 1024;
const FALLBACK_SHELLS: [&str; 2] = ["pwsh", "powershell"];

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    input: InputQueue,
    gate: Arc<ReadGate>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

impl Drop for PtySession {
    fn drop(&mut self) {
        let _ = self.killer.kill();
        self.gate.set_paused(false);
    }
}

#[derive(Default)]
pub struct PtyState(Mutex<Registry<PtySession>>);

impl PtyState {
    pub fn close_all(&self) {
        if let Ok(mut sessions) = self.0.lock() {
            sessions.clear();
        }
    }
}

#[derive(Deserialize)]
pub struct ShellOverride {
    program: String,
    #[serde(default)]
    args: Vec<String>,
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn zsh_with_cypher_config(app: &AppHandle, zsh: PathBuf) -> Result<CommandBuilder, String> {
    let zdotdir = app
        .path()
        .resolve("shell/zsh", BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    let mut command = CommandBuilder::new(zsh);
    command.arg("-l");
    command.env("ZDOTDIR", zdotdir);
    Ok(command)
}

fn automatic_shell(app: &AppHandle) -> Result<CommandBuilder, String> {
    if let Some(zsh) = find_in_path("zsh") {
        return zsh_with_cypher_config(app, zsh);
    }
    Ok(FALLBACK_SHELLS
        .iter()
        .find_map(|shell| find_in_path(shell))
        .map(CommandBuilder::new)
        .unwrap_or_else(CommandBuilder::new_default_prog))
}

fn overridden_shell(app: &AppHandle, shell: &ShellOverride) -> Result<CommandBuilder, String> {
    let program = find_in_path(&shell.program)
        .ok_or_else(|| format!("shell introuvable : {}", shell.program))?;
    if file_stem(&program) == Some("zsh") && shell.args.is_empty() {
        return zsh_with_cypher_config(app, program);
    }
    let mut command = CommandBuilder::new(program);
    command.args(&shell.args);
    Ok(command)
}

fn shell_command(
    app: &AppHandle,
    shell: Option<&ShellOverride>,
    cwd: Option<&str>,
) -> Result<CommandBuilder, String> {
    let mut command = match shell {
        Some(shell) => overridden_shell(app, shell)?,
        None => automatic_shell(app)?,
    };
    if let Some(dir) = cwd.map(Path::new).filter(|dir| dir.is_dir()) {
        command.cwd(dir);
    }
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("TERM_PROGRAM", "cypher");
    Ok(command)
}

fn read_chunks(mut reader: Box<dyn Read + Send>, gate: Arc<ReadGate>, chunks: Sender<Vec<u8>>) {
    let mut buffer = [0u8; READ_BUFFER_SIZE];
    loop {
        gate.wait_until_open();
        match reader.read(&mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(read) => {
                if chunks.send(buffer[..read].to_vec()).is_err() {
                    break;
                }
            }
        }
    }
}

fn next_batch(chunks: &Receiver<Vec<u8>>) -> Option<Vec<u8>> {
    let mut batch = chunks.recv().ok()?;
    while batch.len() < MAX_BATCH_SIZE {
        match chunks.try_recv() {
            Ok(chunk) => batch.extend_from_slice(&chunk),
            Err(_) => break,
        }
    }
    Some(batch)
}

fn stream_output(
    reader: Box<dyn Read + Send>,
    gate: Arc<ReadGate>,
    mut child: Box<dyn Child + Send + Sync>,
    on_output: Channel<InvokeResponseBody>,
    on_exit: Channel<u32>,
) {
    let (sender, chunks) = mpsc::channel();
    thread::spawn(move || read_chunks(reader, gate, sender));
    while let Some(batch) = next_batch(&chunks) {
        if on_output.send(InvokeResponseBody::Raw(batch)).is_err() {
            break;
        }
    }
    let exit_code = child.wait().map(|status| status.exit_code()).unwrap_or(1);
    let _ = on_exit.send(exit_code);
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<PtyState>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    shell: Option<ShellOverride>,
    on_output: Channel<InvokeResponseBody>,
    on_exit: Channel<u32>,
) -> Result<SessionId, String> {
    let pair = native_pty_system()
        .openpty(size(cols, rows))
        .map_err(|e| e.to_string())?;
    let command = shell_command(&app, shell.as_ref(), cwd.as_deref())?;
    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);

    let killer = child.clone_killer();
    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let gate = Arc::new(ReadGate::default());
    let reader_gate = Arc::clone(&gate);
    thread::spawn(move || stream_output(reader, reader_gate, child, on_output, on_exit));

    let session = PtySession {
        master: pair.master,
        input: InputQueue::spawn(writer),
        gate,
        killer,
    };
    Ok(state.0.lock().map_err(|e| e.to_string())?.insert(session))
}

fn with_session<T>(
    state: &State<PtyState>,
    id: SessionId,
    action: impl FnOnce(&mut PtySession) -> Result<T, String>,
) -> Result<T, String> {
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(id)
        .ok_or_else(|| format!("PTY {id} introuvable"))?;
    action(session)
}

#[tauri::command]
pub fn pty_write(state: State<PtyState>, id: SessionId, data: String) -> Result<(), String> {
    with_session(&state, id, |session| session.input.push(data.into_bytes()))
}

#[tauri::command]
pub fn pty_resize(
    state: State<PtyState>,
    id: SessionId,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    with_session(&state, id, |session| {
        session
            .master
            .resize(size(cols, rows))
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn pty_set_paused(state: State<PtyState>, id: SessionId, paused: bool) -> Result<(), String> {
    with_session(&state, id, |session| {
        session.gate.set_paused(paused);
        Ok(())
    })
}

#[tauri::command]
pub fn pty_close(state: State<PtyState>, id: SessionId) -> Result<(), String> {
    state.0.lock().map_err(|e| e.to_string())?.remove(id);
    Ok(())
}
