/**
 * Integration tests for retry system
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { SmartRetryService } from "../../src/core/retry/SmartRetryService";
import type { Task } from "../../src/core/retry/types";

describe("Retry System Integration", () => {
  let retryService: SmartRetryService;

  beforeEach(() => {
    retryService = new SmartRetryService();
  });

  describe("Strategy Selection", () => {
    it("should use network retry for network errors", async () => {
      let attempts = 0;

      const task: Task = {
        name: "test-network",
        run: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error("ECONNREFUSED");
          }
          return "success";
        },
      };

      const result = await retryService.executeWithRetry(task);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.strategy).toBe("network-retry");
    });

    it("should use timeout increase for timeout errors", async () => {
      let attempts = 0;

      const task: Task = {
        name: "test-timeout",
        run: async (context) => {
          attempts++;
          if (attempts === 1) {
            throw new Error("Operation timed out");
          }
          // Verify timeout was increased
          expect(context.timeout).toBeGreaterThan(30000);
          return "success";
        },
      };

      const result = await retryService.executeWithRetry(task, {
        timeout: 30000,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("timeout-increase");
    });

    it("should use direct install fallback", async () => {
      let attempts = 0;

      const task: Task = {
        name: "test-install",
        run: async (context) => {
          attempts++;
          if (attempts === 1) {
            throw new Error("Install failed via CLI");
          }
          // Verify strategy was changed
          expect(context.metadata?.strategy).toBe("direct");
          return "success";
        },
      };

      const result = await retryService.executeWithRetry(task);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("direct-install");
    });
  });

  describe("Batch Operations", () => {
    it("should handle batch operations with shared context", async () => {
      const tasks: Task[] = [
        {
          name: "task-1",
          run: async () => "success-1",
        },
        {
          name: "task-2",
          run: async () => {
            throw new Error("ECONNREFUSED");
          },
        },
        {
          name: "task-3",
          run: async () => "success-3",
        },
      ];

      const results = await retryService.executeBatch(tasks);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false); // Failed after retries
      expect(results[2].success).toBe(true);
    });

    it("should stop batch on user abort", async () => {
      const tasks: Task[] = [
        {
          name: "task-1",
          run: async () => "success-1",
        },
        {
          name: "task-2",
          run: async () => {
            throw new Error("USER_ABORTED");
          },
        },
        {
          name: "task-3",
          run: async () => "success-3",
        },
      ];

      const results = await retryService.executeBatch(tasks);

      expect(results).toHaveLength(2); // Should stop after task-2
      expect(results[1].error?.message).toBe("USER_ABORTED");
    });
  });

  describe("Strategy Priority", () => {
    it("should try strategies in priority order", async () => {
      const strategiesUsed: string[] = [];
      let attempts = 0;

      const task: Task = {
        name: "test-priority",
        run: async (context) => {
          attempts++;
          if (attempts <= 5) {
            // Simulate network error that requires multiple strategies
            throw new Error("Network error");
          }
          return "success";
        },
      };

      const result = await retryService.executeWithRetry(task, {
        maxAttempts: 10,
      });

      // Should have tried network-retry first (lowest priority number)
      expect(result.strategy).toBe("network-retry");
    });
  });

  describe("Context Passing", () => {
    it("should pass context between retry attempts", async () => {
      let previousTimeout = 0;

      const task: Task = {
        name: "test-context",
        run: async (context) => {
          if (context.attemptCount === 0) {
            previousTimeout = context.timeout || 0;
            throw new Error("timeout");
          }

          // Timeout should have increased
          expect(context.timeout).toBeGreaterThan(previousTimeout);
          return "success";
        },
      };

      const result = await retryService.executeWithRetry(task, {
        timeout: 30000,
      });

      expect(result.success).toBe(true);
    });

    it("should preserve metadata across retries", async () => {
      let metadataChecked = false;

      const task: Task = {
        name: "test-metadata",
        run: async (context) => {
          if (context.attemptCount === 0) {
            throw new Error("Install error");
          }

          expect(context.metadata?.strategy).toBe("direct");
          metadataChecked = true;
          return "success";
        },
      };

      await retryService.executeWithRetry(task);

      expect(metadataChecked).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should return failure after max attempts", async () => {
      const task: Task = {
        name: "test-max-attempts",
        run: async () => {
          throw new Error("Persistent error");
        },
      };

      const result = await retryService.executeWithRetry(task, {
        maxAttempts: 3,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error?.message).toContain("Persistent error");
    });

    it("should handle strategy execution errors", async () => {
      const task: Task = {
        name: "test-strategy-error",
        run: async () => {
          throw new Error("Unknown error type");
        },
      };

      const result = await retryService.executeWithRetry(task);

      // Should try all applicable strategies and fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
