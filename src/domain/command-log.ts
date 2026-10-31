export type LoggedCommand = {
  readonly command: string;
  readonly cwd: string | undefined;
  readonly exitCode: number | undefined;
  readonly durationMs: number | undefined;
  readonly finishedAt: number;
};

export class CommandLog {
  static readonly CAPACITY = 2000;

  private constructor(readonly entries: readonly LoggedCommand[]) {}

  static create(entries: readonly LoggedCommand[] = []): CommandLog {
    return new CommandLog(entries.slice(0, CommandLog.CAPACITY));
  }

  record(entry: LoggedCommand): CommandLog {
    if (entry.command.trim() === "") return this;
    return CommandLog.create([entry, ...this.entries]);
  }

  latestDistinct(): readonly LoggedCommand[] {
    const seen = new Set<string>();
    return this.entries.filter((entry) => {
      const key = `${entry.cwd ?? ""}\u0000${entry.command}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

function shellQuote(text: string): string {
  return /^[\w@%+=:,./~-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

export function commandIn(entry: LoggedCommand, currentCwd: string | undefined): string {
  if (!entry.cwd || entry.cwd === currentCwd) return entry.command;
  return `cd ${shellQuote(entry.cwd)} && ${entry.command}`;
}
