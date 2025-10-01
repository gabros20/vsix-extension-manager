import path from "node:path";
import fs from "fs-extra";
import { robustInstallService } from "./robustInstallService";
import { getEnhancedBulkInstallService } from "./enhancedBulkInstallService";

/**
 * Test suite for the robust installation system
 * This demonstrates the enhanced error handling and race condition prevention
 */
export class RobustInstallTest {
  private testDir: string;
  private extensionsDir: string;

  constructor() {
    this.testDir = path.join(process.cwd(), "test-install");
    this.extensionsDir = path.join(this.testDir, "extensions");
  }

  /**
   * Setup test environment
   */
  async setup(): Promise<void> {
    await fs.ensureDir(this.testDir);
    await fs.ensureDir(this.extensionsDir);
  }

  /**
   * Cleanup test environment
   */
  async cleanup(): Promise<void> {
    await fs.remove(this.testDir);
  }

  /**
   * Test single VSIX installation with robust service
   */
  async testSingleInstallation(vsixPath: string): Promise<boolean> {
    console.log("🧪 Testing single VSIX installation...");

    try {
      const result = await robustInstallService.installVsix(vsixPath, this.extensionsDir, {
        force: true,
        maxRetries: 3,
        retryDelay: 1000,
      });

      if (result.success) {
        console.log("✅ Single installation successful");
        return true;
      } else {
        console.log(`❌ Single installation failed: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Single installation error: ${error}`);
      return false;
    }
  }

  /**
   * Test concurrent installations to verify race condition handling
   */
  async testConcurrentInstallations(vsixPaths: string[]): Promise<boolean> {
    console.log("🧪 Testing concurrent installations...");

    try {
      // Create multiple concurrent installation promises
      const installationPromises = vsixPaths.map((vsixPath, index) =>
        robustInstallService
          .installVsix(vsixPath, this.extensionsDir, {
            force: true,
            maxRetries: 3,
            retryDelay: 1000,
          })
          .then((result) => ({ index, result })),
      );

      // Wait for all installations to complete
      const results = await Promise.all(installationPromises);

      const successful = results.filter(({ result }) => result.success).length;
      const failed = results.filter(({ result }) => !result.success).length;

      console.log(`📊 Concurrent installation results: ${successful} successful, ${failed} failed`);

      if (failed > 0) {
        console.log("❌ Some concurrent installations failed:");
        results.forEach(({ index, result }) => {
          if (!result.success) {
            console.log(`  - VSIX ${index}: ${result.error}`);
          }
        });
      }

      return failed === 0;
    } catch (error) {
      console.log(`❌ Concurrent installation error: ${error}`);
      return false;
    }
  }

  /**
   * Test bulk installation with enhanced service
   */
  async testBulkInstallation(vsixPaths: string[]): Promise<boolean> {
    console.log("🧪 Testing bulk installation...");

    try {
      const enhancedService = getEnhancedBulkInstallService();

      // Create install tasks
      const tasks = vsixPaths.map((vsixPath) => ({
        vsixFile: {
          path: vsixPath,
          filename: path.basename(vsixPath),
          size: 1024,
          modified: new Date(),
          isValid: true,
          extensionId: path.basename(vsixPath, ".vsix"),
          version: "1.0.0",
        },
      }));

      const result = await enhancedService.installBulkVsix(
        "test-binary", // Mock binary path
        tasks,
        {
          parallel: 2,
          maxConcurrent: 2,
          batchSize: 5,
          retry: 3,
          retryDelay: 1000,
        },
      );

      console.log(
        `📊 Bulk installation results: ${result.successful} successful, ${result.failed} failed`,
      );

      if (result.failed > 0) {
        console.log("❌ Some bulk installations failed:");
        result.results.forEach((taskResult, index) => {
          if (!taskResult.success) {
            console.log(`  - Task ${index}: ${taskResult.error}`);
          }
        });
      }

      return result.failed === 0;
    } catch (error) {
      console.log(`❌ Bulk installation error: ${error}`);
      return false;
    }
  }

  /**
   * Test error recovery and retry logic
   */
  async testErrorRecovery(vsixPath: string): Promise<boolean> {
    console.log("🧪 Testing error recovery...");

    try {
      // First, install the extension
      const firstResult = await robustInstallService.installVsix(vsixPath, this.extensionsDir, {
        force: true,
      });

      if (!firstResult.success) {
        console.log("❌ Initial installation failed");
        return false;
      }

      // Try to install again (should handle "already exists" gracefully)
      const secondResult = await robustInstallService.installVsix(vsixPath, this.extensionsDir, {
        force: false, // Don't force, should fail gracefully
      });

      if (secondResult.success) {
        console.log("❌ Second installation should have failed (already exists)");
        return false;
      }

      // Force reinstall should work
      const thirdResult = await robustInstallService.installVsix(vsixPath, this.extensionsDir, {
        force: true,
      });

      if (!thirdResult.success) {
        console.log(`❌ Force reinstall failed: ${thirdResult.error}`);
        return false;
      }

      console.log("✅ Error recovery test passed");
      return true;
    } catch (error) {
      console.log(`❌ Error recovery test failed: ${error}`);
      return false;
    }
  }

  /**
   * Run comprehensive test suite
   */
  async runTestSuite(vsixPaths: string[]): Promise<boolean> {
    console.log("🚀 Starting robust installation test suite...");

    await this.setup();

    try {
      const tests = [
        () => this.testSingleInstallation(vsixPaths[0]),
        () => this.testConcurrentInstallations(vsixPaths.slice(0, 3)),
        () => this.testBulkInstallation(vsixPaths),
        () => this.testErrorRecovery(vsixPaths[0]),
      ];

      const results = await Promise.all(tests.map((test) => test()));
      const passed = results.filter(Boolean).length;
      const total = results.length;

      console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);

      if (passed === total) {
        console.log("🎉 All tests passed! Robust installation system is working correctly.");
      } else {
        console.log("⚠️ Some tests failed. Check the logs above for details.");
      }

      return passed === total;
    } finally {
      await this.cleanup();
    }
  }
}

/**
 * Utility function to run the test suite
 */
export async function runRobustInstallTest(vsixPaths: string[]): Promise<boolean> {
  const test = new RobustInstallTest();
  return test.runTestSuite(vsixPaths);
}
