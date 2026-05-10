import { AgentSession } from "./agent-session";

// Sessions expire after 4 hours of inactivity
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

class SessionStore {
  private store = new Map<string, AgentSession>();

  set(session: AgentSession): void {
    this.store.set(session.id, session);
  }

  get(id: string): AgentSession | undefined {
    return this.store.get(id);
  }

  delete(id: string): void {
    this.store.delete(id);
  }

  size(): number {
    return this.store.size;
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.store) {
      if (now - session.lastActiveAt.getTime() > SESSION_TTL_MS) {
        this.store.delete(id);
      }
    }
  }
}

export const sessionStore = new SessionStore();

// Auto-purge stale sessions every 30 minutes
setInterval(() => sessionStore.purgeExpired(), 30 * 60 * 1000);
