import { formatDuration } from "../domain/command-history";
import {
  type CommandOutcome,
  completionMessage,
  isOwnCompletion,
  type QuickCommand,
  terminalInput,
  waitsForCompletion,
} from "../domain/quick-commands";
import type {
  BackgroundRunner,
  CommandPane,
  CommandWorkspace,
  CompletionNotifier,
  FinishedCommand,
} from "./ports";

export type QuickCommandExecution = {
  readonly finished: Promise<void>;
  readonly cancel: (() => void) | undefined;
};

export type QuickCommandRunnerDeps<P extends CommandPane> = {
  readonly workspace: CommandWorkspace<P>;
  readonly background: BackgroundRunner;
  readonly notifier: CompletionNotifier;
  readonly newId: () => string;
};

async function ownCompletion(pane: CommandPane, quickCommand: QuickCommand): Promise<FinishedCommand> {
  for (;;) {
    const finished = await pane.nextCommandFinished();
    if (isOwnCompletion(quickCommand, finished.command)) return finished;
  }
}

export class QuickCommandRunner<P extends CommandPane> {
  private constructor(private readonly deps: QuickCommandRunnerDeps<P>) {}

  static create<P extends CommandPane>(deps: QuickCommandRunnerDeps<P>): QuickCommandRunner<P> {
    return new QuickCommandRunner(deps);
  }

  run(quickCommand: QuickCommand): QuickCommandExecution {
    if (quickCommand.mode === "background") return this.runInBackground(quickCommand);
    if (quickCommand.mode === "tab" || !this.deps.workspace.focused) this.deps.workspace.newTab();
    const pane = this.deps.workspace.focused;
    if (!pane) return { finished: Promise.resolve(), cancel: undefined };
    const finished = waitsForCompletion(quickCommand)
      ? ownCompletion(pane, quickCommand).then((done) => this.announce(quickCommand, done))
      : Promise.resolve();
    pane.write(terminalInput(quickCommand));
    pane.focus();
    return { finished, cancel: undefined };
  }

  private runInBackground(quickCommand: QuickCommand): QuickCommandExecution {
    const id = this.deps.newId();
    const finished = this.deps.background
      .run(id, quickCommand.command, this.deps.workspace.focused?.cwd)
      .then((outcome) => this.announce(quickCommand, outcome));
    return { finished, cancel: () => void this.deps.background.cancel(id) };
  }

  private announce(quickCommand: QuickCommand, outcome: CommandOutcome): void {
    const message = completionMessage(quickCommand, outcome, formatDuration);
    this.deps.notifier.notify({ ...message, output: outcome.output });
  }
}
