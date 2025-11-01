/**
 * Retry system type definitions
 * Provides intelligent retry with escalating strategies
 */

export interface RetryContext {
  attemptCount: number;
  lastError?: Error;
  startTime: number;
  timeout?: number;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

export interface RetryOptions {
  maxAttempts?: number;
  timeout?: number;
  backoffMultiplier?: number;
  strategies?: string[];
  metadata?: Record<string, unknown>;
}

export interface RetryResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  strategy?: string;
  attempts: number;
  duration: number;
}

export type Task<T = unknown> = {
  name: string;
  run: (context: RetryContext) => Promise<T>;
  metadata?: Record<string, unknown>;
};

export interface RetryStrategy {
  name: string;
  priority: number;
  canHandle(error: Error, context: RetryContext): boolean;
  attempt<T>(task: Task<T>, context: RetryContext): Promise<T>;
  getDescription(error: Error, context: RetryContext): string;
}

export interface RetryStrategyFactory {
  create(): RetryStrategy;
}
