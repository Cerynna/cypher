export const ACTION_LABELS = {
  copy: "Copier la sélection",
  copyOrInterrupt: "Copier la sélection, sinon interrompre (Ctrl+C)",
  paste: "Coller",
  find: "Rechercher dans le terminal",
  zoomIn: "Agrandir le texte",
  zoomOut: "Réduire le texte",
  zoomReset: "Taille de texte par défaut",
  newTab: "Nouvel onglet",
  renameTab: "Renommer l'onglet",
  closePane: "Fermer le panneau",
  nextTab: "Onglet suivant",
  previousTab: "Onglet précédent",
  splitRight: "Diviser à droite",
  splitDown: "Diviser en bas",
  focusLeft: "Panneau de gauche",
  focusRight: "Panneau de droite",
  focusUp: "Panneau du haut",
  focusDown: "Panneau du bas",
  previousCommand: "Commande précédente",
  nextCommand: "Commande suivante",
  copyLastOutput: "Copier la sortie de la dernière commande",
  commandPalette: "Palette de commandes",
  settings: "Réglages",
  openConfigFile: "Ouvrir config.toml dans l'éditeur",
  newQuickCommand: "Créer une commande rapide",
  resumeClaude: "Reprendre une session Claude…",
  aiCommand: "IA : générer une commande",
  aiExplain: "IA : expliquer la dernière erreur",
} as const;

export type ActionId = keyof typeof ACTION_LABELS;

export const ACTION_IDS = Object.keys(ACTION_LABELS) as readonly ActionId[];

export const HIDDEN_FROM_PALETTE: ReadonlySet<ActionId> = new Set(["commandPalette", "copyOrInterrupt"]);

export function passesThroughToShell(action: ActionId, hasSelection: boolean): boolean {
  return action === "copyOrInterrupt" && !hasSelection;
}

export function isActionId(value: string): value is ActionId {
  return Object.hasOwn(ACTION_LABELS, value);
}
