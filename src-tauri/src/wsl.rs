use std::path::{Path, PathBuf};

const UNC_PREFIX: &str = r"\\wsl.localhost\";
const VERBATIM_PREFIX: &str = r"\\?\";

pub fn decode_output(bytes: &[u8]) -> String {
    let looks_utf16 = bytes.len() >= 2
        && bytes.iter().skip(1).step_by(2).filter(|&&b| b == 0).count() * 2 >= bytes.len() / 2;
    if !looks_utf16 {
        return String::from_utf8_lossy(bytes).into_owned();
    }
    let units: Vec<u16> = bytes
        .as_chunks::<2>()
        .0
        .iter()
        .map(|&pair| u16::from_le_bytes(pair))
        .collect();
    String::from_utf16_lossy(&units)
}

pub fn default_distro(listing: &str) -> Option<String> {
    listing
        .lines()
        .map(|line| line.trim_matches(|c: char| c == '\u{feff}' || c.is_whitespace()))
        .find_map(|line| line.strip_prefix('*'))
        .and_then(|rest| rest.split_whitespace().next())
        .map(str::to_owned)
}

pub fn to_unc(distro: &str, linux_path: &str) -> PathBuf {
    let relative = linux_path.trim_start_matches('/').replace('/', r"\");
    PathBuf::from(format!("{UNC_PREFIX}{distro}\\{relative}"))
}

pub fn from_unc(distro: &str, path: &Path) -> Option<String> {
    let text = path.to_string_lossy();
    let text = text
        .strip_prefix(VERBATIM_PREFIX)
        .map_or(text.as_ref(), |rest| rest);
    let text = text
        .strip_prefix("UNC\\")
        .map_or(text.to_owned(), |rest| format!(r"\\{rest}"));
    let prefix = format!("{UNC_PREFIX}{distro}");
    let rest = text
        .get(..prefix.len())?
        .eq_ignore_ascii_case(&prefix)
        .then(|| &text[prefix.len()..])?;
    let linux = rest.replace('\\', "/");
    Some(if linux.is_empty() {
        String::from("/")
    } else {
        linux
    })
}

pub fn mount_path(windows_path: &str) -> Option<String> {
    let path = windows_path
        .strip_prefix(VERBATIM_PREFIX)
        .unwrap_or(windows_path);
    let mut chars = path.chars();
    let drive = chars.next().filter(char::is_ascii_alphabetic)?;
    if chars.next() != Some(':') {
        return None;
    }
    let rest = chars.as_str().replace('\\', "/");
    Some(format!(
        "/mnt/{}{}",
        drive.to_ascii_lowercase(),
        rest.trim_end_matches('/')
    ))
}

pub fn resolve_posix(path: &str, cwd: &str, home: &str) -> String {
    let expanded = match path.strip_prefix("~/") {
        Some(rest) => format!("{}/{rest}", home.trim_end_matches('/')),
        None if path == "~" => home.to_owned(),
        None => path.to_owned(),
    };
    if expanded.starts_with('/') {
        expanded
    } else {
        format!("{}/{expanded}", cwd.trim_end_matches('/'))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_la_sortie_utf16_de_wsl_exe() {
        let bytes: Vec<u8> = "* Ubuntu  Running  2\r\n"
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect();
        assert_eq!(decode_output(&bytes), "* Ubuntu  Running  2\r\n");
        assert_eq!(decode_output(b"/home/jm"), "/home/jm");
    }

    #[test]
    fn trouve_la_distribution_par_defaut_quelle_que_soit_la_langue() {
        let listing = "  NAME              STATE           VERSION\r\n* Ubuntu            Running         2\r\n  docker-desktop    Running         2\r\n";
        assert_eq!(default_distro(listing).as_deref(), Some("Ubuntu"));
        assert_eq!(
            default_distro("  NOM  ÉTAT  VERSION\r\n* Debian  Arrêté  2"),
            Some(String::from("Debian"))
        );
        assert_eq!(
            default_distro("Le Sous-système Windows pour Linux n'a pas de distribution."),
            None
        );
    }

    #[test]
    fn convertit_un_chemin_linux_en_chemin_unc_et_inversement() {
        let unc = to_unc("Ubuntu", "/home/jm/Labo/mon dossier");
        assert_eq!(
            unc,
            PathBuf::from(r"\\wsl.localhost\Ubuntu\home\jm\Labo\mon dossier")
        );
        assert_eq!(
            from_unc("Ubuntu", &unc).as_deref(),
            Some("/home/jm/Labo/mon dossier")
        );
        assert_eq!(
            from_unc("Ubuntu", Path::new(r"\\wsl.localhost\Ubuntu")).as_deref(),
            Some("/")
        );
    }

    #[test]
    fn reconnait_les_formes_verbatim_et_ignore_les_autres_distributions() {
        let verbatim = Path::new(r"\\?\UNC\wsl.localhost\Ubuntu\home\jm");
        assert_eq!(from_unc("Ubuntu", verbatim).as_deref(), Some("/home/jm"));
        assert_eq!(
            from_unc("Ubuntu", Path::new(r"\\wsl.localhost\Debian\home")),
            None
        );
        assert_eq!(from_unc("Ubuntu", Path::new(r"C:\Users\jm")), None);
    }

    #[test]
    fn traduit_un_chemin_windows_vers_le_montage_wsl() {
        assert_eq!(
            mount_path(r"\\?\C:\Users\jm\AppData\Local\CYPHER\shell\zsh").as_deref(),
            Some("/mnt/c/Users/jm/AppData/Local/CYPHER/shell/zsh")
        );
        assert_eq!(
            mount_path(r"D:\Program Files\CYPHER\").as_deref(),
            Some("/mnt/d/Program Files/CYPHER")
        );
        assert_eq!(mount_path("/home/jm"), None);
    }

    #[test]
    fn resout_les_chemins_posix_relatifs_et_le_tilde() {
        assert_eq!(
            resolve_posix("src/main.ts", "/home/jm/cypher/", "/home/jm"),
            "/home/jm/cypher/src/main.ts"
        );
        assert_eq!(
            resolve_posix("~/notes.md", "/tmp", "/home/jm"),
            "/home/jm/notes.md"
        );
        assert_eq!(
            resolve_posix("/etc/hosts", "/tmp", "/home/jm"),
            "/etc/hosts"
        );
    }
}
