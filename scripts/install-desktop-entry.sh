#!/usr/bin/env sh
set -eu

project_dir=$(cd "$(dirname "$0")/.." && pwd)
user_shell=${SHELL:-/bin/sh}
target=/usr/share/applications/cypher.desktop
entry=$(mktemp)
trap 'rm -f "$entry"' EXIT

cat > "$entry" <<DESKTOP
[Desktop Entry]
Type=Application
Name=CYPHER
Comment=Terminal perso
Exec=$user_shell -ic "cd '$project_dir' && yarn tauri dev"
Path=$project_dir
Icon=$project_dir/src-tauri/icons/128x128@2x.png
StartupWMClass=cypher
Categories=System;TerminalEmulator;
Terminal=false
DESKTOP

sudo install -m 644 "$entry" "$target"
echo "Entrée installée : $target"
