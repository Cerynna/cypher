mod ai;
mod background;
mod claude;
mod config;
mod editor;
mod executable;
mod host;
mod input_queue;
mod pty;
mod read_gate;
mod registry;
mod repo;
mod wsl;

use std::sync::Arc;

use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(pty::PtyState::default())
        .manage(host::HostState::default())
        .manage(Arc::new(background::BackgroundState::default()))
        .setup(|app| {
            let watcher = config::watch(app.handle())?;
            app.manage(watcher);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_close,
            pty::pty_set_paused,
            config::config_read,
            config::config_write,
            editor::existing_paths,
            editor::open_in_editor,
            ai::ai_ask,
            background::run_background,
            background::cancel_background,
            claude::claude_sessions,
            repo::repo_root,
            host::host_configure
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                app.state::<pty::PtyState>().close_all();
                app.state::<Arc<background::BackgroundState>>()
                    .terminate_all();
            }
        });
}
