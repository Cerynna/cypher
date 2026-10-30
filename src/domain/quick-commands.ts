export type QuickCommandMode = "run" | "type" | "tab" | "background";

export const QUICK_COMMAND_MODES: readonly QuickCommandMode[] = ["run", "type", "tab", "background"];

export const QUICK_COMMAND_MODE_LABELS: Readonly<Record<QuickCommandMode, string>> = {
  run: "Terminal actif",
  type: "Taper sans exécuter",
  tab: "Nouvel onglet",
  background: "Arrière-plan (notification)",
};

export const DEFAULT_EMOJI = "⚡";

export type QuickCommand = {
  readonly emoji: string;
  readonly name: string;
  readonly command: string;
  readonly mode: QuickCommandMode;
  readonly notify: boolean;
};

export type TabPosition = "top" | "right" | "bottom" | "left";

export const TAB_POSITIONS: readonly TabPosition[] = ["top", "right", "bottom", "left"];

export function isTabPosition(value: string): value is TabPosition {
  return (TAB_POSITIONS as readonly string[]).includes(value);
}

export function isQuickCommandMode(value: string): value is QuickCommandMode {
  return (QUICK_COMMAND_MODES as readonly string[]).includes(value);
}

const EMOJI_PRESENTATION_SELECTOR = /\uFE0F(?!\u20E3)/g;

export function withoutPresentationSelector(emoji: string): string {
  return emoji.replace(EMOJI_PRESENTATION_SELECTOR, "");
}

export function firstGrapheme(text: string): string | undefined {
  const [first] = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text.trim());
  return first?.segment;
}

export function createQuickCommand(fields: {
  readonly emoji?: string;
  readonly name: string;
  readonly command: string;
  readonly mode?: QuickCommandMode;
  readonly notify?: boolean;
}): QuickCommand | undefined {
  const name = fields.name.trim();
  const command = fields.command.trim();
  if (name === "" || command === "") return undefined;
  return {
    emoji: withoutPresentationSelector(firstGrapheme(fields.emoji ?? "") ?? DEFAULT_EMOJI),
    name,
    command,
    mode: fields.mode ?? "run",
    notify: fields.mode === "background" || (fields.notify ?? false),
  };
}

export function legacyMode(execute: boolean, newTab: boolean): QuickCommandMode {
  if (newTab) return "tab";
  return execute ? "run" : "type";
}

export function terminalInput(quickCommand: QuickCommand): string {
  const text = quickCommand.command.replace(/\r\n|\n/g, "\r");
  return quickCommand.mode === "type" ? text : `${text}\r`;
}

export function waitsForCompletion(quickCommand: QuickCommand): boolean {
  return quickCommand.notify && (quickCommand.mode === "run" || quickCommand.mode === "tab");
}

const ANSI_SEQUENCE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

export function plainText(output: string): string {
  return output.replace(ANSI_SEQUENCE, "").replace(/\r(?!\n)/g, "\n");
}

export type CommandOutcome = {
  readonly exitCode: number | undefined;
  readonly durationMs: number | undefined;
  readonly output: string;
  readonly cancelled?: boolean;
};

export function isOwnCompletion(quickCommand: QuickCommand, finishedCommand: string | undefined): boolean {
  const lastLine = quickCommand.command
    .split(/\r?\n/)
    .map((line) => line.trim())
    .findLast((line) => line !== "");
  return lastLine !== undefined && finishedCommand?.trim() === lastLine;
}

export type CompletionMessage = { readonly title: string; readonly body: string; readonly failed: boolean };

const MAX_SUMMARY_LENGTH = 160;

function lastLine(output: string): string {
  const line =
    output
      .split(/\r?\n/)
      .map((candidate) => candidate.trim())
      .findLast((candidate) => candidate !== "") ?? "";
  return line.length > MAX_SUMMARY_LENGTH ? `${line.slice(0, MAX_SUMMARY_LENGTH - 1)}…` : line;
}

export function completionMessage(
  quickCommand: QuickCommand,
  outcome: CommandOutcome,
  formatDuration: (ms: number) => string,
): CompletionMessage {
  const failed = !outcome.cancelled && outcome.exitCode !== 0;
  const status = outcome.cancelled ? "arrêté" : failed ? `échec (code ${outcome.exitCode ?? "?"})` : "terminé";
  const duration = outcome.durationMs === undefined ? "" : ` en ${formatDuration(outcome.durationMs)}`;
  return {
    title: `${quickCommand.emoji} ${quickCommand.name} : ${status}${duration}`,
    body: lastLine(outcome.output) || quickCommand.command,
    failed,
  };
}
