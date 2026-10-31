# Changelog

## [Non publié]

## [0.4.0] - 2026-10-31

### Ajouté
- Panneau latéral à droite (bouton dans la barre) avec trois outils :
  - Presse-papiers (Ctrl+Shift+H) : les 50 dernières copies, faites dans CYPHER ou ailleurs, gardées en mémoire seulement ; un clic colle dans le terminal actif.
  - Claude (Ctrl+Shift+K) : les sessions Claude Code ouvertes, celles qui attendent ta réponse en premier ; un clic mène à l'onglet.
  - Projet (Ctrl+Shift+G) : branche, avance et retard, fichiers modifiés (clic = diff, ↗ = éditeur) et scripts du `package.json`, lancés avec le bon gestionnaire.
- Scripts du projet aussi dans la palette de commandes.
- Recherche dans l'historique des commandes de tous les onglets (Ctrl+Alt+R) : Entrée tape la commande, Maj+Entrée l'exécute, dans son dossier d'origine.
- Notes (Ctrl+Shift+N) : fenêtre flottante déplaçable et redimensionnable, éditeur Markdown avec aperçu, enregistrée dans `~/.config/cypher/notes.md` ; Ctrl+Entrée envoie la ligne au terminal.

### Modifié
- Les onglets n'affichent plus leur numéro.

### Corrigé
- Le titre des notifications de Claude Code (« Claude Code ») est séparé du message.

## [0.3.1] - 2026-10-31

### Corrigé
- Le terminal garde le focus après une commande sous Windows : plus besoin de recliquer dedans pour enchaîner.

### Ajouté
- Mise à jour automatique sous macOS.

## [0.3.0] - 2026-10-31

### Ajouté
- CYPHER sous Windows avec WSL : le `.exe` lance le zsh de la distribution par défaut, avec blocs de commande, nom du dépôt, liens `fichier:ligne`, reprise des sessions Claude et commandes en arrière-plan.
- Notification Claude : badge sur l'onglet et notification quand Claude Code attend ou a fini (OSC 9, 777, 99 et cloche).
- Config partagée avec WSL : le `.exe` lit `~/.config/cypher/config.toml` de la distribution.
- Mises à jour automatiques, au démarrage et via « Rechercher une mise à jour » dans la palette.
- Copier-coller façon Windows Terminal : Ctrl+C copie la sélection (sinon interrompt), Ctrl+V colle, clic droit copie ou colle.
- Ouverture maximisée et plein écran avec F11.

### Corrigé
- Emojis invisibles sous Windows.
- `claude` et les outils de `~/.local/bin` introuvables dans le zsh de CYPHER sous Windows.

## [0.2.0] - 2026-10-30

### Ajouté
- Nom du dépôt git dans les onglets.
- Sélecteur d'emoji pour les commandes rapides.

## [0.1.0] - 2026-10-30

### Ajouté
- Terminal Tauri 2 + xterm.js, thème néon cyberpunk, 12 thèmes (Abysse par défaut).
- zsh avec la config CYPHER : blocs de commande, durée et code de sortie, héritage du dossier courant.
- Onglets en haut, en bas ou sur les côtés, renommage et couleur ; splits redimensionnables à la souris.
- Commandes rapides avec emoji, en mode run, type, nouvel onglet ou arrière-plan avec notification du résultat.
- Reprise des onglets et des sessions Claude à la réouverture.
- Palette de commandes, réglages, recherche, liens `fichier:ligne`, assistant IA.
