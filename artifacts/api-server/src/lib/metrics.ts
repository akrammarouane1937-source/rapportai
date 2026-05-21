import { logger } from "./logger";

// ─── Token cost table (USD per 1M tokens) ────────────────────────────────────
const COST_PER_MTK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":         { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0  },
};

const HEAVY_SECTIONS = new Set(["partie-i", "partie-ii", "introduction", "conclusion"]);

function modelForSection(section: string): string {
  return HEAVY_SECTIONS.has(section) ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
}

export function estimateCost(section: string, outputWords: number): number {
  const model = modelForSection(section);
  const rates = COST_PER_MTK[model] ?? COST_PER_MTK["claude-sonnet-4-6"];
  const inputTokens  = 500;
  const outputTokens = Math.round(outputWords * 1.4);
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

export function estimateTokens(outputWords: number): number {
  return 500 + Math.round(outputWords * 1.4); // input + output
}

// ─── In-memory metrics store ──────────────────────────────────────────────────

interface AgentEvent {
  sessionId:  string;
  section:    string;
  latencyMs:  number;
  success:    boolean;
  wordCount:  number;
  tokensUsed: number;
  costUsd:    number;
  attempts:   number;
  error?:     string;
  ts:         number;
}

class MetricsStore {
  private events: AgentEvent[] = [];
  private readonly MAX_EVENTS = 2000;

  // Daily counters — reset at midnight
  private dayStart       = this.todayMidnight();
  dailyStarted           = 0;
  dailyCompleted         = 0;
  dailyCostUsd           = 0;
  dailyTokensUsed        = 0;
  private dailyLatencyMs = 0; // sum, divide by dailyCompleted for avg

  private todayMidnight(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private checkDayRollover() {
    if (Date.now() >= this.dayStart + 86_400_000) {
      this.logDailySummary();
      this.dayStart        = this.todayMidnight();
      this.dailyStarted    = 0;
      this.dailyCompleted  = 0;
      this.dailyCostUsd    = 0;
      this.dailyTokensUsed = 0;
      this.dailyLatencyMs  = 0;
    }
  }

  recordStart() {
    this.checkDayRollover();
    this.dailyStarted++;
  }

  record(event: Omit<AgentEvent, "ts">) {
    this.checkDayRollover();
    const full: AgentEvent = { ...event, ts: Date.now() };
    this.events.push(full);
    if (this.events.length > this.MAX_EVENTS) this.events.shift();

    if (event.success) {
      this.dailyCompleted++;
      this.dailyCostUsd    += event.costUsd;
      this.dailyTokensUsed += event.tokensUsed;
      this.dailyLatencyMs  += event.latencyMs;

      logger.info({
        event:       "agent_completed",
        report_id:   event.sessionId,
        agent:       event.section,
        tokens_used: event.tokensUsed,
        latency_ms:  event.latencyMs,
        attempts:    event.attempts,
        word_count:  event.wordCount,
        cost_usd:    event.costUsd.toFixed(5),
      });
    } else {
      logger.error({
        event:     "agent_failed",
        report_id: event.sessionId,
        agent:     event.section,
        error:     event.error,
        attempts:  event.attempts,
      });
    }

    this.checkAlerts(event);
  }

  private checkAlerts(latest: AgentEvent) {
    const recent = this.events.filter((e) => e.section === latest.section).slice(-50);
    if (recent.length >= 10) {
      const failRate = recent.filter((e) => !e.success).length / recent.length;
      if (failRate > 0.1) {
        logger.warn({
          alert:       "HIGH_FAILURE_RATE",
          section:     latest.section,
          fail_rate:   (failRate * 100).toFixed(1) + "%",
          sample_size: recent.length,
        }, `⚠️ Failure rate ${(failRate * 100).toFixed(0)}% on ${latest.section}`);
      }
    }

    if (latest.latencyMs > 8 * 60 * 1000) {
      logger.warn({
        alert:      "SLOW_GENERATION",
        section:    latest.section,
        latency_ms: latest.latencyMs,
      }, `⚠️ Generation took ${(latest.latencyMs / 60000).toFixed(1)}min on ${latest.section}`);
    }

    if (this.dailyCostUsd > 10 && this.dailyCompleted % 10 === 0) {
      logger.warn({
        alert:          "DAILY_COST_HIGH",
        daily_cost_usd: this.dailyCostUsd.toFixed(2),
      }, `⚠️ Daily cost reached $${this.dailyCostUsd.toFixed(2)}`);
    }
  }

  private logDailySummary() {
    const completionRate = this.dailyStarted > 0
      ? ((this.dailyCompleted / this.dailyStarted) * 100).toFixed(1)
      : "N/A";
    const avgLatencyMs = this.dailyCompleted > 0
      ? Math.round(this.dailyLatencyMs / this.dailyCompleted)
      : 0;

    logger.info({
      event:            "daily_summary",
      started:          this.dailyStarted,
      completed:        this.dailyCompleted,
      completion_rate:  completionRate + "%",
      avg_latency_ms:   avgLatencyMs,
      total_tokens:     this.dailyTokensUsed,
      cost_usd:         this.dailyCostUsd.toFixed(3),
    });
  }

  getStats() {
    const last200 = this.events.slice(-200);
    const bySection: Record<string, {
      success: number; fail: number; avgLatencyMs: number; totalCost: number; totalTokens: number;
    }> = {};

    for (const e of last200) {
      if (!bySection[e.section]) {
        bySection[e.section] = { success: 0, fail: 0, avgLatencyMs: 0, totalCost: 0, totalTokens: 0 };
      }
      const s = bySection[e.section];
      if (e.success) s.success++; else s.fail++;
      s.avgLatencyMs += e.latencyMs;
      s.totalCost    += e.costUsd;
      s.totalTokens  += e.tokensUsed;
    }
    for (const s of Object.values(bySection)) {
      const total = s.success + s.fail;
      if (total > 0) s.avgLatencyMs = Math.round(s.avgLatencyMs / total);
    }

    const avgLatencyMs = this.dailyCompleted > 0
      ? Math.round(this.dailyLatencyMs / this.dailyCompleted)
      : 0;

    return {
      daily: {
        started:         this.dailyStarted,
        completed:       this.dailyCompleted,
        completion_rate: this.dailyStarted > 0
          ? ((this.dailyCompleted / this.dailyStarted) * 100).toFixed(1) + "%"
          : "N/A",
        avg_latency_ms:  avgLatencyMs,
        total_tokens:    this.dailyTokensUsed,
        cost_usd:        this.dailyCostUsd.toFixed(3),
      },
      by_section:  bySection,
      sample_size: last200.length,
    };
  }
}

export const metrics = new MetricsStore();
