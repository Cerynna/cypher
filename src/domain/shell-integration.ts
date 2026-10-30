export type ShellEvent =
  | { readonly kind: "promptStart" }
  | { readonly kind: "inputStart" }
  | { readonly kind: "commandStart"; readonly command: string | undefined }
  | { readonly kind: "commandEnd"; readonly exitCode: number | undefined };

function decodeBase64Utf8(encoded: string): string | undefined {
  try {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function parameters(fields: readonly string[]): ReadonlyMap<string, string> {
  return new Map(
    fields.flatMap((field) => {
      const separator = field.indexOf("=");
      return separator > 0 ? [[field.slice(0, separator), field.slice(separator + 1)] as const] : [];
    }),
  );
}

export function parseSemanticPrompt(payload: string): ShellEvent | undefined {
  const [marker, ...fields] = payload.split(";");
  switch (marker) {
    case "A":
      return { kind: "promptStart" };
    case "B":
      return { kind: "inputStart" };
    case "C": {
      const encoded = parameters(fields).get("cmd64");
      return { kind: "commandStart", command: encoded === undefined ? undefined : decodeBase64Utf8(encoded) };
    }
    case "D": {
      const code = Number.parseInt(fields[0] ?? "", 10);
      return { kind: "commandEnd", exitCode: Number.isNaN(code) ? undefined : code };
    }
    default:
      return undefined;
  }
}

export function parseWorkingDirectory(payload: string): string | undefined {
  const match = /^file:\/\/[^/]*(\/.*)$/.exec(payload);
  if (!match) return undefined;
  try {
    const path = decodeURIComponent(match[1]);
    return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
  } catch {
    return undefined;
  }
}

export function directoryName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  return trimmed.split(/[\\/]/).at(-1) || "/";
}
