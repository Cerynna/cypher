export type AiPrompt = { readonly system: string; readonly prompt: string };

export type ShellContext = { readonly platform: string; readonly shell: string; readonly cwd: string | undefined };

const MAX_OUTPUT_LINES = 200;

export function commandPrompt(request: string, context: ShellContext): AiPrompt {
  return {
    system: [
      `Tu génères des commandes pour ${context.shell} sur ${context.platform}.`,
      "Réponds uniquement par la commande, prête à être exécutée, sur une seule ligne si possible.",
      "Pas d'explication, pas de bloc de code, pas de texte autour.",
    ].join(" "),
    prompt: [`Dossier courant : ${context.cwd ?? "inconnu"}`, `Demande : ${request}`].join("\n"),
  };
}

export function explainPrompt(command: string, exitCode: number, output: string, context: ShellContext): AiPrompt {
  const lines = output.split("\n");
  const kept = lines.slice(-MAX_OUTPUT_LINES).join("\n");
  const truncated = lines.length > MAX_OUTPUT_LINES ? `(${lines.length - MAX_OUTPUT_LINES} premières lignes omises)\n` : "";
  return {
    system: [
      `Tu aides un développeur dans son terminal (${context.shell} sur ${context.platform}).`,
      "Explique en français, en quelques phrases, pourquoi la commande a échoué,",
      "puis propose la correction la plus probable avec la commande à lancer.",
    ].join(" "),
    prompt: [
      `Dossier courant : ${context.cwd ?? "inconnu"}`,
      `Commande : ${command}`,
      `Code de sortie : ${exitCode}`,
      "Sortie :",
      `${truncated}${kept}`,
    ].join("\n"),
  };
}

export function extractCommand(answer: string): string {
  const fenced = /```[\w-]*\n([\s\S]*?)```/.exec(answer);
  const body = fenced ? fenced[1] : answer;
  return body
    .trim()
    .replace(/^\$\s+/, "")
    .replace(/^`(.*)`$/s, "$1")
    .trim();
}
