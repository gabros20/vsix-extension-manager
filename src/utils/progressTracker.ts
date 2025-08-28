/**
 * Progress tracking utilities for file downloads
 */

export interface ProgressInfo {
  downloaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  timeElapsed: number; // milliseconds
  timeRemaining?: number; // milliseconds (estimated)
}

export type ProgressCallback = (progress: ProgressInfo) => void;

/**
 * Progress tracker class for monitoring download progress
 */
export class ProgressTracker {
  private startTime: number;
  private lastUpdateTime: number;
  private lastDownloaded: number;
  private total: number;
  private downloaded: number;
  private callback: ProgressCallback;

  constructor(total: number, callback: ProgressCallback) {
    this.total = total;
    this.downloaded = 0;
    this.callback = callback;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.lastDownloaded = 0;
  }

  /**
   * Update progress with new downloaded amount
   */
  update(downloaded: number): void {
    this.downloaded = downloaded;
    const now = Date.now();
    const timeElapsed = now - this.startTime;

    // Calculate speed (average over last update period)
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    const bytesSinceLastUpdate = downloaded - this.lastDownloaded;

    let speed = 0;
    if (timeSinceLastUpdate > 0) {
      speed = (bytesSinceLastUpdate / timeSinceLastUpdate) * 1000; // bytes per second
    }

    const percentage = this.total > 0 ? (downloaded / this.total) * 100 : 0;

    // Estimate time remaining
    let timeRemaining: number | undefined;
    if (speed > 0 && this.total > 0) {
      const remainingBytes = this.total - downloaded;
      timeRemaining = (remainingBytes / speed) * 1000; // milliseconds
    }

    const progressInfo: ProgressInfo = {
      downloaded,
      total: this.total,
      percentage,
      speed,
      timeElapsed,
      timeRemaining,
    };

    this.callback(progressInfo);

    // Update last values for next calculation
    this.lastUpdateTime = now;
    this.lastDownloaded = downloaded;
  }

  /**
   * Mark progress as complete
   */
  complete(): void {
    this.update(this.total);
  }
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

/**
 * Format speed to human readable format
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Format time duration to human readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Create a simple progress bar string
 */
export function createProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${" ".repeat(empty)}] ${percentage.toFixed(1)}%`;
}
