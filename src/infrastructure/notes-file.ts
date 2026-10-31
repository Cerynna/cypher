import { invoke } from "@tauri-apps/api/core";

export function readNotes(): Promise<string> {
  return invoke("notes_read");
}

export function writeNotes(content: string): Promise<void> {
  return invoke("notes_write", { content });
}
