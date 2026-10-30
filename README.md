# CYPHER

Émulateur de terminal perso, en Tauri 2 + xterm.js, thème néon cyberpunk.

```sh
yarn
yarn tauri dev
yarn test                      # tests TypeScript
cd src-tauri && cargo test     # tests Rust
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

## Intégration shell

Le zsh lancé par CYPHER utilise `src-tauri/shell/zsh/.zshrc` (via `ZDOTDIR`), pas `~/.zshrc`. Il émet les séquences OSC 133 (début de prompt, début et fin de commande, code de sortie) et OSC 7 (dossier courant) dont dépendent les blocs de commande, l'héritage du dossier et les notifications.
