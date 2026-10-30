import type { SessionSnapshot, SessionStore } from "../application/ports";

const STORAGE_KEY = "cypher.session";

export class LocalSessionStore implements SessionStore {
  load(): unknown {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? undefined : JSON.parse(saved);
    } catch {
      return undefined;
    }
  }

  save(snapshot: SessionSnapshot): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("session non enregistrée", error);
    }
  }
}
