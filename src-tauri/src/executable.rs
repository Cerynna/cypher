use std::env;
use std::path::{Path, PathBuf};

const WINDOWS_EXTENSIONS: [&str; 3] = ["exe", "cmd", "bat"];

fn candidates(dir: &Path, program: &str) -> Vec<PathBuf> {
    if cfg!(windows) {
        WINDOWS_EXTENSIONS
            .iter()
            .map(|extension| dir.join(format!("{program}.{extension}")))
            .collect()
    } else {
        vec![dir.join(program)]
    }
}

pub fn find_in_path(program: &str) -> Option<PathBuf> {
    let direct = Path::new(program);
    if direct.is_absolute() {
        return direct.is_file().then(|| direct.to_path_buf());
    }
    env::split_paths(&env::var_os("PATH")?)
        .flat_map(|dir| candidates(&dir, program))
        .find(|candidate| candidate.is_file())
}

pub fn file_stem(program: &Path) -> Option<&str> {
    program.file_stem().and_then(|stem| stem.to_str())
}
