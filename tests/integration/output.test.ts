/**
 * Integration tests for output system
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { CommandResultBuilder } from "../../src/core/output/CommandResultBuilder";
import { OutputFormatter } from "../../src/core/output/formatters";

describe("Output System Integration", () => {
  let builder: CommandResultBuilder;
  let formatter: OutputFormatter;

  beforeEach(() => {
    builder = new CommandResultBuilder("test-command");
    formatter = new OutputFormatter();
  });

  describe("Result Building", () => {
    it("should build result with automatic status calculation", () => {
      builder.addSuccess({ id: "ext-1", name: "Extension 1" });
      builder.addSuccess({ id: "ext-2", name: "Extension 2" });
      builder.addFailure({ id: "ext-3", name: "Extension 3", message: "Failed" });

      const result = builder.build();

      expect(result.status).toBe("partial");
      expect(result.totals?.successful).toBe(2);
      expect(result.totals?.failed).toBe(1);
      expect(result.totals?.total).toBe(3);
    });

    it("should generate automatic summary", () => {
      builder.addSuccess({ id: "ext-1", name: "Extension 1" });
      builder.addSuccess({ id: "ext-2", name: "Extension 2" });

      const result = builder.build();

      expect(result.summary).toContain("Successfully completed 2");
    });

    it("should calculate totals correctly", () => {
      builder.addSuccess({ id: "ext-1" });
      builder.addSuccess({ id: "ext-2" });
      builder.addFailure({ id: "ext-3" });
      builder.addSkipped({ id: "ext-4" });
      builder.addWarningItem({ code: "WARN", message: "Warning" });

      const result = builder.build();

      expect(result.totals).toEqual({
        total: 4,
        successful: 2,
        failed: 1,
        skipped: 1,
        warnings: 1,
        duration: expect.any(Number),
      });
    });

    it("should handle errors with suggestions", () => {
      builder.addError({
        code: "TIMEOUT",
        message: "Operation timed out",
        context: "ext-1",
        suggestion: "Try increasing timeout with --timeout flag",
      });

      const result = builder.build();

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].suggestion).toContain("timeout");
    });

    it("should preserve metadata", () => {
      builder.setMetadata({ editor: "cursor", retries: 2 });

      const result = builder.build();

      expect(result.metadata?.editor).toBe("cursor");
      expect(result.metadata?.retries).toBe(2);
    });
  });

  describe("Status Calculation", () => {
    it("should return ok for all successes", () => {
      builder.addSuccess({ id: "ext-1" });
      builder.addSuccess({ id: "ext-2" });

      const result = builder.build();

      expect(result.status).toBe("ok");
    });

    it("should return error for all failures", () => {
      builder.addFailure({ id: "ext-1" });
      builder.addFailure({ id: "ext-2" });

      const result = builder.build();

      expect(result.status).toBe("error");
    });

    it("should return partial for mixed results", () => {
      builder.addSuccess({ id: "ext-1" });
      builder.addFailure({ id: "ext-2" });

      const result = builder.build();

      expect(result.status).toBe("partial");
    });

    it("should return ok for skipped items only", () => {
      builder.addSkipped({ id: "ext-1" });
      builder.addSkipped({ id: "ext-2" });

      const result = builder.build();

      expect(result.status).toBe("ok");
    });
  });

  describe("Output Formatting", () => {
    it("should format human-readable output", () => {
      builder.addSuccess({ id: "ext-1", name: "Extension 1" });
      builder.addFailure({ id: "ext-2", name: "Extension 2" });

      const result = builder.build();
      const output = formatter.format(result, { format: "human" });

      expect(output.content).toContain("Extension 1");
      expect(output.content).toContain("Extension 2");
      expect(output.exitCode).toBe(1); // Partial failure
    });

    it("should format JSON output", () => {
      builder.addSuccess({ id: "ext-1", name: "Extension 1" });

      const result = builder.build();
      const output = formatter.format(result, { format: "json" });

      const parsed = JSON.parse(output.content);
      expect(parsed.status).toBe("ok");
      expect(parsed.items).toHaveLength(1);
      expect(output.exitCode).toBe(0);
    });

    it("should format pretty JSON output", () => {
      builder.addSuccess({ id: "ext-1" });

      const result = builder.build();
      const output = formatter.format(result, { format: "json-pretty" });

      expect(output.content).toContain("\n"); // Has indentation
      const parsed = JSON.parse(output.content);
      expect(parsed.status).toBe("ok");
    });

    it("should respect quiet mode", () => {
      builder.addSuccess({ id: "ext-1", name: "Extension 1" });
      builder.addSuccess({ id: "ext-2", name: "Extension 2" });

      const result = builder.build();
      const output = formatter.format(result, {
        format: "human",
        quiet: true,
      });

      // Should be minimal in quiet mode
      expect(output.content.split("\n").length).toBeLessThan(5);
    });

    it("should include stack traces in debug mode", () => {
      builder.addError({
        code: "ERROR",
        message: "Test error",
        stack: "Error: Test error\n  at ...",
      });

      const result = builder.build();
      const output = formatter.format(result, {
        format: "human",
        includeStack: true,
      });

      expect(output.content).toContain("Stack:");
    });
  });

  describe("Error Construction", () => {
    it("should create result from error", () => {
      const error = new Error("Command failed");
      error.name = "CommandError";

      const result = CommandResultBuilder.fromError("test-command", error);

      expect(result.status).toBe("error");
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].message).toBe("Command failed");
      expect(result.summary).toContain("Command failed");
    });
  });

  describe("Integration with Retry System", () => {
    it("should track retry attempts in metadata", () => {
      builder.addSuccess({
        id: "ext-1",
        name: "Extension 1",
        details: {
          strategy: "network-retry",
          attempts: 3,
        },
      });

      const result = builder.build();

      expect(result.items![0].details).toEqual({
        strategy: "network-retry",
        attempts: 3,
      });
    });
  });
});
