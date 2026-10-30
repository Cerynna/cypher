import { describe, expect, it } from "vitest";
import { commandPrompt, explainPrompt, extractCommand } from "./ai-prompts";

const context = { platform: "Linux", shell: "zsh", cwd: "/home/jm/Labo" };

describe("prompts IA", () => {
  it("donne le contexte du shell pour générer une commande", () => {
    const { system, prompt } = commandPrompt("trouve les fichiers de plus de 1 Go", context);
    expect(system).toContain("zsh sur Linux");
    expect(prompt).toBe("Dossier courant : /home/jm/Labo\nDemande : trouve les fichiers de plus de 1 Go");
  });

  it("ne garde que la fin d'une sortie trop longue", () => {
    const output = Array.from({ length: 250 }, (_, index) => `ligne ${index + 1}`).join("\n");
    const { prompt } = explainPrompt("make", 2, output, context);
    expect(prompt).toContain("(50 premières lignes omises)");
    expect(prompt).not.toContain("ligne 50\n");
    expect(prompt).toContain("ligne 250");
  });
});

describe("extractCommand", () => {
  it.each([
    ["ls -la", "ls -la"],
    ["```bash\nfind . -size +1G\n```", "find . -size +1G"],
    ["$ git status", "git status"],
    ["`du -sh *`", "du -sh *"],
  ])("%j → %j", (answer, command) => {
    expect(extractCommand(answer)).toBe(command);
  });
});
