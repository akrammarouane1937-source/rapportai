import { AgentSession } from "./agent-session";
import { SDKReportAgent } from "./sdk-agent";

// Sessions expire after 4 hours of inactivity
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

class SessionStore {
  private store = new Map<string, AgentSession>();

  set(session: AgentSession): void {
    this.store.set(session.id, session);
  }

  get(id: string): AgentSession | undefined {
    const cached = this.store.get(id);
    if (cached) return cached;
    // Try to revive from disk after a server restart
    const revived = SDKReportAgent.reviveFromDisk(id);
    if (revived) {
      this.store.set(id, revived as unknown as AgentSession);
      return revived as unknown as AgentSession;
    }
    return undefined;
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
