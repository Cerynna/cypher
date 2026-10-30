# CYPHER

Émulateur de terminal perso, en Tauri 2 + xterm.js, thème néon cyberpunk.

```sh
yarn
yarn tauri dev
yarn test                      # tests TypeScript
cd src-tauri && cargo test     # tests Rust
```

## Release

La version de l'app vient de `package.json` (`tauri.conf.json` pointe dessus). Pour publier `0.2.0` :

```sh
yarn version --new-version 0.2.0   # commit « chore: release v0.2.0 » + tag v0.2.0
git push --follow-tags
```

Le tag déclenche `.github/workflows/release.yml`, qui construit en parallèle `.exe` (Windows, NSIS), `.deb` (Linux) et `.dmg` (macOS universel), puis les joint à une release GitHub **en brouillon** à publier après vérification. Les installeurs ne sont pas signés. Le workflow peut aussi être lancé à la main (« Run workflow ») pour récupérer les installeurs en artefacts sans créer de release, en choisissant la plateforme (`all`, `windows`, `linux`, `macos`) : `gh workflow run release.yml -f plateforme=windows`.

### Icône et menu Démarrer sous WSLg

Sous Wayland, WSLg retrouve l'icône d'une fenêtre via un fichier `.desktop` portant son `app_id` (`cypher`), et ne lit que `/usr/share/applications` (pas `~/.local/share/applications`). Pour l'installer, ainsi qu'une entrée « CYPHER » dans le menu Démarrer de Windows (demande `sudo`) :

```sh
./scripts/install-desktop-entry.sh
```

## Raccourcis

| Action | Raccourci |
|---|---|
| Palette de commandes | Ctrl+Shift+P |
| Réglages | Ctrl+, |
| Nouvel onglet / fermer le panneau | Ctrl+Shift+T / Ctrl+Shift+W |
| Onglet suivant / précédent | Ctrl+Tab / Ctrl+Shift+Tab |
| Renommer l'onglet | Ctrl+Shift+R, double-clic ou clic droit |
| Diviser à droite / en bas | Ctrl+Shift+D / Ctrl+Shift+E |
| Changer de panneau | Ctrl+Alt+flèches |
| Redimensionner un split | glisser la séparation · double-clic = 50/50 |
| Commande précédente / suivante | Ctrl+Shift+↑ / ↓ |
| Copier la dernière sortie | Ctrl+Shift+O |
| Copier / coller | Ctrl+Shift+C / Ctrl+Shift+V |
| Rechercher | Ctrl+Shift+F |
| Zoom | Ctrl+= / Ctrl+- / Ctrl+0 |
| IA : générer une commande / expliquer l'échec | Ctrl+Shift+A / Ctrl+Shift+X |

## Configuration

`~/.config/cypher/config.toml`, rechargé à chaud. Toutes les clés sont optionnelles ; une valeur invalide est signalée et remplacée par sa valeur par défaut.

```toml
[font]
family = "Kode Mono Variable"
size = 16
line_height = 1.15

[theme]
dark = "abyss"           # neon | synthwave | matrix | abyss | sanguine | amber | ultraviolet | sakura | ember | glacier | ghost
light = "neon-day"       # utilisé si follow_system = true et que le système est en clair
follow_system = false

[terminal]
scrollback = 10000
cursor_style = "bar"     # bar | block | underline
cursor_blink = true
copy_on_select = false
opacity = 1.0            # 0.3 à 1
blur = false             # Windows et macOS
scanlines = true         # lignes horizontales façon écran cathodique

[shell]
program = ""             # vide = zsh avec la config CYPHER, sinon pwsh / powershell
args = []
wsl = "auto"             # Windows : auto (distribution WSL par défaut), off (pwsh) ou nom de distribution

[editor]
command = "code -g {file}:{line}:{column}"

[notifications]
long_command_seconds = 10   # 0 = jamais

[ai]
enabled = false
model = "claude-opus-5-5"   # clé lue dans ANTHROPIC_API_KEY

[quake]
enabled = false
shortcut = "Control+Backquote"

[tabs]
position = "top"         # top | right | bottom | left

[[commands]]
emoji = "🧪"             # affiché comme bouton
name = "Tests"
command = "yarn test"
mode = "background"      # run (terminal actif) | type (taper sans exécuter) | tab (nouvel onglet) | background
notify = false           # notifier le résultat en mode run / tab ; toujours vrai en background

[keybindings]
"alt+t" = "newTab"
"ctrl+shift+t" = "none"
```

## Sous Windows avec WSL

Le `.exe` lance par défaut le zsh de la distribution WSL par défaut, avec la config CYPHER (`wsl.exe --cd <dossier> -- …`). Blocs de commande, nom du dépôt, liens `fichier:ligne`, reprise des sessions Claude et commandes en arrière-plan passent par WSL : les fichiers sont lus via `\\wsl.localhost\<distribution>\…` et VS Code s'ouvre en `--remote wsl+<distribution>`. La config de l'app reste côté Windows (`%USERPROFILE%\.config\cypher\config.toml`).

## Config zsh de CYPHER

Le zsh de CYPHER utilise `src-tauri/shell/zsh` (via `ZDOTDIR`) et non ton `~/.zshrc`, pour garder son propre prompt sans oh-my-zsh. Il reprend quand même ton environnement : `~/.zshenv`, `~/.profile` (donc `~/.local/bin`, `~/bin`, cargo) et nvm. Pour tes ajouts personnels (alias, `PATH`…), crée `~/.config/cypher/zshrc` : il est chargé en dernier.

## Intégration shell

Le zsh lancé par CYPHER utilise `src-tauri/shell/zsh/.zshrc` (via `ZDOTDIR`), pas `~/.zshrc`. Il émet les séquences OSC 133 (début de prompt, début et fin de commande, code de sortie) et OSC 7 (dossier courant) dont dépendent les blocs de commande, l'héritage du dossier et les notifications.
