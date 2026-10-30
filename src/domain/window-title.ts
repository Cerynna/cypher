const APP_NAME = "CYPHER";
const MAX_LENGTH = 80;
const UNSAFE_CHARACTERS = /[\p{Cc}​-‏‪-‮⁦-⁩]/gu;

export function windowTitle(shellTitle: string): string {
  const title = shellTitle.replace(UNSAFE_CHARACTERS, "").trim();
  if (title === "") return APP_NAME;
  const shortened = title.length > MAX_LENGTH ? `${title.slice(0, MAX_LENGTH - 1)}…` : title;
  return `${shortened} — ${APP_NAME}`;
}
