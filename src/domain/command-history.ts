import type { ShellEvent } from "./shell-integration";

export type CommandBlock<Anchor> = {
  readonly id: number;
  readonly promptAnchor: Anchor;
  readonly outputAnchor: Anchor | undefined;
  readonly endAnchor: Anchor | undefined;
  readonly command: string | undefined;
  readonly exitCode: number | undefined;
  readonly startedAt: number | undefined;
  readonly finishedAt: number | undefined;
};

const MAX_BLOCKS = 1000;

export class CommandHistory<Anchor> {
  private constructor(
    readonly blocks: readonly CommandBlock<Anchor>[],
    private readonly nextId: number,
  ) {}

  static empty<Anchor>(): CommandHistory<Anchor> {
    return new CommandHistory<Anchor>([], 1);
  }

  get current(): CommandBlock<Anchor> | undefined {
    return this.blocks.at(-1);
  }

  get lastFinished(): CommandBlock<Anchor> | undefined {
    return this.blocks.findLast((block) => block.finishedAt !== undefined);
  }

  get lastFailed(): CommandBlock<Anchor> | undefined {
    return this.blocks.findLast((block) => block.exitCode !== undefined && block.exitCode !== 0);
  }

  apply(event: ShellEvent, anchor: Anchor, at: number): CommandHistory<Anchor> {
    switch (event.kind) {
      case "promptStart":
        return this.append({
          id: this.nextId,
          promptAnchor: anchor,
          outputAnchor: undefined,
          endAnchor: undefined,
          command: undefined,
          exitCode: undefined,
          startedAt: undefined,
          finishedAt: undefined,
        });
      case "inputStart":
        return this;
      case "commandStart":
        return this.updateCurrent((block) =>
          block.startedAt === undefined
            ? { ...block, outputAnchor: anchor, command: event.command?.trim() || undefined, startedAt: at }
            : block,
        );
      case "commandEnd":
        return this.updateCurrent((block) =>
          block.startedAt !== undefined && block.finishedAt === undefined
            ? { ...block, endAnchor: anchor, exitCode: event.exitCode, finishedAt: at }
            : block,
        );
    }
  }

  private append(block: CommandBlock<Anchor>): CommandHistory<Anchor> {
    return new CommandHistory([...this.blocks, block].slice(-MAX_BLOCKS), this.nextId + 1);
  }

  private updateCurrent(update: (block: CommandBlock<Anchor>) => CommandBlock<Anchor>): CommandHistory<Anchor> {
    const current = this.current;
    if (!current) return this;
    const updated = update(current);
    return updated === current ? this : new CommandHistory([...this.blocks.slice(0, -1), updated], this.nextId);
  }
}

export function durationMs(block: CommandBlock<unknown>): number | undefined {
  if (block.startedAt === undefined || block.finishedAt === undefined) return undefined;
  return block.finishedAt - block.startedAt;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  if (minutes < 60) return `${minutes} min ${seconds} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export function shouldNotifyCompletion(
  block: CommandBlock<unknown>,
  thresholdSeconds: number,
  windowFocused: boolean,
): boolean {
  const duration = durationMs(block);
  return thresholdSeconds > 0 && !windowFocused && duration !== undefined && duration >= thresholdSeconds * 1000;
}
