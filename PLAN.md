# Plan CYPHER

État : tout est implémenté et testé (tests unitaires, build), sauf mention contraire. Les points marqués *à valider* n'ont pas pu être vérifiés dans une vraie fenêtre.

## Lot 1 — Socle

- [x] Rendu GPU : `@xterm/addon-webgl`, repli sur le rendu DOM si le contexte WebGL est perdu
- [x] Unicode 11 : emojis et caractères larges (`@xterm/addon-unicode11`)
- [x] Presse-papier : Ctrl+Shift+C/V, bracketed paste, OSC 52 en écriture seule
- [x] Débit : sortie du PTY regroupée avant envoi au front
- [x] Cycle de vie : shell tué à la fermeture, `pwsh` sous Windows, repli si zsh absent
- [x] Zoom : Ctrl+= / Ctrl+- / Ctrl+0
- [x] Scrollback configurable + recherche (Ctrl+Shift+F)
- [x] Sécurité : CSP stricte, confirmation des collages multi-lignes, titres OSC filtrés
- [x] Police Kode Mono embarquée, 16 px par défaut
- [x] Thème néon cyberpunk, prompt zsh assorti
- [x] Barre de titre maison : déplacement, double-clic, réduire/agrandir/fermer, redimensionnement par les bords — *à valider sous WSLg*

## Lot 2 — Attendu aujourd'hui

- [x] Onglets : registre de sessions PTY côté Rust (`registry.rs`), barre d'onglets dans le bandeau
- [x] Splits horizontaux / verticaux, navigation clavier par position (`domain/pane-tree.ts`)
- [x] Redimensionnement des splits à la souris (glisser la séparation, double-clic = 50/50), ratio conservé dans la session
- [x] Config `~/.config/cypher/config.toml`, validée champ par champ, rechargée à chaud (`notify`)
- [x] Panneau de réglages (Ctrl+,) qui écrit `config.toml`
- [x] Thèmes : `neon`, `synthwave`, `matrix`, `abyss`, `sanguine`, `amber`, `ultraviolet`, `sakura`, `ember`, `glacier`, `ghost`, `neon-day` ; contraste vérifié par test ; aperçu en direct dans les réglages ; suivi clair/sombre du système
- [x] Effet scanlines désactivable (`[terminal] scanlines`)
- [x] Raccourcis configurables (`[keybindings]`, `"none"` pour désactiver)
- [x] Palette de commandes (Ctrl+Shift+P), recherche floue
- [x] Liens : URL cliquables, `fichier:ligne:colonne` → éditeur configurable (VSCode par défaut)
- [x] Position des onglets : haut (dans le bandeau), droite, bas, gauche (`[tabs] position`)
- [x] Commandes rapides en un clic (`[[commands]]`) : bouton emoji dans le dock, création via « + », édition dans les réglages, accès depuis la palette
- [x] Modes des commandes rapides : terminal actif, taper sans exécuter, nouvel onglet, arrière-plan (sans terminal, résultat en notification) ; notification optionnelle en mode terminal
- [x] Police Noto Color Emoji embarquée (WSL n'en fournit pas)
- [x] Notification dans l'app avec « Voir la sortie » (sortie complète, copiable) ; tooltips maison sur les boutons
- [x] Boutons diviser / réglages dans le bandeau, ✕ sur chaque panneau d'un onglet divisé
- [x] Onglets renommables (double-clic, clic droit, Ctrl+Shift+R) et colorables (clic droit), conservés dans la session

## Lot 3 — Nouvelle génération

- [x] Intégration shell dans le `.zshrc` de CYPHER : OSC 133 (A/B/C/D, commande en base64) et OSC 7
- [x] Blocs de commande : statut et durée à droite du prompt, liseré rouge sur les échecs, repères dans la barre de défilement
- [x] Navigation entre commandes (Ctrl+Shift+↑/↓), copie de la dernière sortie (Ctrl+Shift+O)
- [x] Dossier courant hérité par les nouveaux onglets/splits, affiché dans l'onglet et le titre
- [x] Notification système quand une commande longue (10 s par défaut) se termine hors focus
- [x] Restauration des onglets, splits et dossiers au redémarrage (les shells sont relancés, pas leur contenu)
- [x] Sessions Claude : celles qui tournaient à la fermeture sont proposées à la reprise au démarrage (`claude --resume <id>` dans leur panneau) ; « Reprendre une session Claude… » liste les sessions récentes du dossier
- [x] Images inline (Sixel, protocole iTerm) via `@xterm/addon-image`
- [ ] Repli d'un bloc — écarté : xterm.js ne permet pas de masquer des lignes du buffer

## Lot 4 — Optionnel

- [x] IA (Ctrl+Shift+A / Ctrl+Shift+X) : langage naturel → commande, explication du dernier échec. Appel HTTP depuis Rust, clé lue dans `ANTHROPIC_API_KEY`, jamais exposée au webview. Désactivée par défaut.
- [x] Mode Quake : raccourci global qui affiche/masque la fenêtre — *à valider, les raccourcis globaux sont peu fiables sous WSLg*
- [x] Opacité de la fenêtre et flou (acrylique Windows, vibrancy macOS) — *à valider, dépend du compositeur sous Linux*
- [ ] Mises à jour automatiques et signature — écarté tant que CYPHER n'est pas distribué

Écartés : éditeur de saisie façon Warp (zsh le fait déjà), multiplexeur détachable (tmux existe), moteur de rendu maison.

## Architecture

```
src/domain/          règles pures, aucune dépendance (keymap, workspace, pane-tree, config, themes,
                     shell-integration, command-history, links, fuzzy, ai-prompts, paste, font-size)
src/application/     WorkspaceController + ports (PaneFactory, WorkspaceRenderer, SessionStore, AppWindow)
src/infrastructure/  adapters Tauri (PTY, config, session, système)
src/ui/              xterm.js et DOM (TerminalPane, WorkspaceView, overlays)
src/main.ts          racine de composition
src-tauri/src/       pty, registry, config, editor, ai, executable
```

| Couche | Tests |
|---|---|
| Domaine | unitaires (`src/domain/*.test.ts`) |
| Application | fakes en mémoire (`workspace-controller.test.ts`) |
| Architecture | `domain` et `application` n'importent ni framework ni couche externe (`architecture.test.ts`) |
| Rust | registre de sessions, résolution des chemins, requête/réponse de l'API Claude |
