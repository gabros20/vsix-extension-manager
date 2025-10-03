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
  metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface RetryOptions {
  maxAttempts?: number;
  timeout?: number;
  backoffMultiplier?: number;
  strategies?: string[];
  metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface RetryResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  strategy?: string;
  attempts: number;
  duration: number;
}

export type Task<T = any> = {
  name: string;
  run: (context: RetryContext) => Promise<T>;
  metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
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
