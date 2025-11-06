/**
 * Temporal Worker
 * Executes workflows and activities
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { NativeConnection, Worker } from '@temporalio/worker';
import { Logger } from '@acme/shared/Logger';
import { env } from '@acme/shared/env';
import * as activities from './activities';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = new Logger('TemporalWorker');

async function run() {
  try {
    logger.info('Starting Temporal worker...', {
      temporalAddress: env.TEMPORAL_ADDRESS,
      namespace: env.TEMPORAL_NAMESPACE,
      taskQueue: env.TEMPORAL_TASK_QUEUE,
    });

    // Test that activities can be imported
    logger.info('Checking activities...', {
      activityCount: Object.keys(activities).length,
      activityNames: Object.keys(activities),
    });

    // Parse Temporal address - NativeConnection expects hostname:port, not URL
    // Handle both formats: "http://localhost:7234" -> "localhost:7234" or "localhost:7234"
    let temporalAddress = env.TEMPORAL_ADDRESS;
    try {
      const url = new URL(temporalAddress);
      temporalAddress = `${url.hostname}:${url.port || '7233'}`;
    } catch {
      // Already in hostname:port format or invalid, use as-is
    }

    logger.info('Parsed Temporal address', {
      original: env.TEMPORAL_ADDRESS,
      parsed: temporalAddress,
    });

    // Connect to Temporal Server
    const connection = await NativeConnection.connect({
      address: temporalAddress,
    });

    logger.info('Connected to Temporal server', {
      address: temporalAddress,
    });

    // Create worker
    logger.info('Creating worker...');
    const worker = await Worker.create({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowsPath: resolve(__dirname, './workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 10,
    });

    logger.info('Temporal worker created successfully', {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      maxConcurrentActivities: 10,
      maxConcurrentWorkflows: 10,
    });

    // Start worker
    await worker.run();

    logger.info('Temporal worker stopped');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log to console with full details
    console.error('\n=== Temporal Worker Error ===');
    console.error('Message:', errorMessage);
    console.error('Stack:', errorStack);
    console.error('Full error:', error);
    console.error('============================\n');

    logger.error('Failed to start Temporal worker', {
      message: errorMessage,
      stack: errorStack,
    });
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start worker
run().catch((err) => {
  logger.error('Unhandled error in worker', err);
  process.exit(1);
});
