export type PastePlan =
  | { readonly kind: "direct"; readonly text: string }
  | { readonly kind: "confirm"; readonly text: string; readonly lineCount: number };

const CONTROL_CHARACTERS_EXCEPT_WHITESPACE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;
const LINE_BREAK = /\r\n|\r|\n/;

export function planPaste(rawText: string, bracketedPasteMode: boolean): PastePlan {
  const text = rawText.replace(CONTROL_CHARACTERS_EXCEPT_WHITESPACE, "");
  if (bracketedPasteMode || !LINE_BREAK.test(text)) return { kind: "direct", text };
  return { kind: "confirm", text, lineCount: text.split(LINE_BREAK).length };
}
