export type AttentionSignal = { readonly title: string | undefined; readonly body: string };

const SUBCOMMAND = /^\d+;/;

function clean(text: string): string {
  return text.replace(/[\p{Cc}‪-‮⁦-⁩]/gu, " ").replace(/\s+/g, " ").trim();
}

function signal(title: string | undefined, body: string): AttentionSignal | undefined {
  const cleanBody = clean(body);
  const cleanTitle = title === undefined ? undefined : clean(title) || undefined;
  if (cleanBody === "" && cleanTitle === undefined) return undefined;
  return { title: cleanTitle, body: cleanBody || cleanTitle || "" };
}

export function parseOsc9(payload: string): AttentionSignal | undefined {
  if (SUBCOMMAND.test(payload)) return undefined;
  const lines = payload.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return signal(lines[0].replace(/:$/, ""), lines.slice(1).join(" "));
  return signal(undefined, lines[0] ?? "");
}

export function parseOsc777(payload: string): AttentionSignal | undefined {
  const [kind, title, ...body] = payload.split(";");
  if (kind !== "notify") return undefined;
  return signal(title, body.join(";"));
}

type KittyPart = { readonly id: string; readonly done: boolean; readonly kind: "title" | "body"; readonly text: string };

function parseKitty(payload: string): KittyPart | undefined {
  const separator = payload.indexOf(";");
  if (separator === -1) return undefined;
  const metadata = new Map(
    payload
      .slice(0, separator)
      .split(":")
      .map((pair) => pair.split("=") as [string, string]),
  );
  const raw = payload.slice(separator + 1);
  let text = raw;
  if (metadata.get("e") === "1") {
    try {
      text = new TextDecoder().decode(Uint8Array.from(atob(raw), (char) => char.charCodeAt(0)));
    } catch {
      return undefined;
    }
  }
  return {
    id: metadata.get("i") ?? "",
    done: metadata.get("d") !== "0",
    kind: metadata.get("p") === "body" ? "body" : "title",
    text,
  };
}

export class KittyNotifications {
  private readonly pending = new Map<string, { title?: string; body?: string }>();

  receive(payload: string): AttentionSignal | undefined {
    const part = parseKitty(payload);
    if (!part) return undefined;
    const entry = { ...this.pending.get(part.id), [part.kind]: part.text };
    if (!part.done) {
      this.pending.set(part.id, entry);
      return undefined;
    }
    this.pending.delete(part.id);
    return signal(entry.body === undefined ? undefined : entry.title, entry.body ?? entry.title ?? "");
  }
}

export const BELL_SIGNAL: AttentionSignal = { title: undefined, body: "Le terminal demande ton attention" };
