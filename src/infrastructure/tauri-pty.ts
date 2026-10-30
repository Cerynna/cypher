import { Channel, invoke } from "@tauri-apps/api/core";

export type PtySize = { readonly cols: number; readonly rows: number };

export type ShellOverride = { readonly program: string; readonly args: readonly string[] };

export type PtyOptions = PtySize & {
  readonly cwd: string | undefined;
  readonly shell: ShellOverride | undefined;
};

export type PtyListeners = {
  readonly onOutput: (data: Uint8Array) => void;
  readonly onExit: (exitCode: number) => void;
};

export class Pty {
  private constructor(private readonly id: number) {}

  static async create(options: PtyOptions, listeners: PtyListeners): Promise<Pty> {
    const output = new Channel<ArrayBuffer>();
    output.onmessage = (chunk) => listeners.onOutput(new Uint8Array(chunk));
    const exit = new Channel<number>();
    exit.onmessage = listeners.onExit;

    const id = await invoke<number>("pty_spawn", {
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd ?? null,
      shell: options.shell ?? null,
      onOutput: output,
      onExit: exit,
    });
    return new Pty(id);
  }

  write(data: string): Promise<void> {
    return invoke("pty_write", { id: this.id, data });
  }

  resize(size: PtySize): Promise<void> {
    return invoke("pty_resize", { id: this.id, ...size });
  }

  setPaused(paused: boolean): Promise<void> {
    return invoke("pty_set_paused", { id: this.id, paused });
  }

  close(): Promise<void> {
    return invoke("pty_close", { id: this.id });
  }
}
