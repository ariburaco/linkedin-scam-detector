/**
 * Temporal Schedules Setup
 * Configures CRON schedules for automated workflows
 */

import { Connection, Client } from '@temporalio/client';
import { Logger } from '@acme/shared/Logger';
import { env } from '@acme/shared/env';

const logger = new Logger('TemporalSchedules');

export interface ScheduleConfig {
  scheduleId: string;
  cronExpression: string;
  workflowType: string;
  workflowArgs: any[];
  description: string;
  paused?: boolean;
}

/**
 * Schedule Configurations
 */
export const schedules: ScheduleConfig[] = [
  // LinkedIn Job Scraping Schedules (Discovery)
  {
    scheduleId: 'scrape-linkedin-jobs-daily',
    cronExpression: '0 2 * * *', // 2 AM daily
    workflowType: 'ScrapeLinkedInJobs',
    workflowArgs: [
      {
        searchParams: {
          keywords: 'software engineer',
          location: 'United States',
          maxResults: 100,
        },
        scrapeDetails: false,
      },
    ],
    description: 'Daily LinkedIn job scraping for software engineers',
    paused: true, // Start paused, enable when ready
  },
  {
    scheduleId: 'scrape-linkedin-jobs-hourly',
    cronExpression: '0 * * * *', // Every hour
    workflowType: 'ScrapeLinkedInJobs',
    workflowArgs: [
      {
        searchParams: {
          keywords: 'developer',
          location: 'Remote',
          maxResults: 50,
        },
        scrapeDetails: false,
      },
    ],
    description: 'Hourly LinkedIn job scraping for remote developers',
    paused: true, // Start paused, enable for testing
  },
  // Process Discovered Jobs Schedules (Processing)
  {
    scheduleId: 'process-discovered-jobs-hourly',
    cronExpression: '0 * * * *', // Every hour
    workflowType: 'ProcessDiscoveredJobs',
    workflowArgs: [
      {
        batchSize: 50,
        priority: true,
        triggerExtraction: false, // Will be controlled by feature flags
        triggerEmbedding: false, // Will be controlled by feature flags
      },
    ],
    description:
      'Process discovered jobs hourly - scrape details and create Job entries',
    paused: true, // Start paused, enable when ready
  },
  {
    scheduleId: 'process-discovered-jobs-daily',
    cronExpression: '0 3 * * *', // 3 AM daily (after discovery at 2 AM)
    workflowType: 'ProcessDiscoveredJobs',
    workflowArgs: [
      {
        batchSize: 200,
        priority: true,
        triggerExtraction: false,
        triggerEmbedding: false,
      },
    ],
    description:
      'Process discovered jobs daily - handle backlog with larger batch',
    paused: true, // Start paused, enable when ready
  },
];

/**
 * Create or update a schedule
 */
async function createOrUpdateSchedule(
  client: Client,
  config: ScheduleConfig
): Promise<void> {
  try {
    logger.info('Creating/updating schedule in scheduled namespace', {
      scheduleId: config.scheduleId,
      cronExpression: config.cronExpression,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const handle = client.schedule.getHandle(config.scheduleId);

    // Try to describe the schedule (check if it exists)
    try {
      await handle.describe();
      logger.info('Schedule exists, checking if update needed', {
        scheduleId: config.scheduleId,
      });

      // For simplicity, we'll delete and recreate instead of updating
      // Temporal schedule updates are complex and often easier to recreate
      logger.info('Deleting existing schedule to recreate', {
        scheduleId: config.scheduleId,
      });
      await handle.delete();

      // Fall through to creation logic below
      throw new Error('Schedule deleted, will recreate');
    } catch (error) {
      // Schedule doesn't exist, create it
      logger.info('Creating schedule in scheduled namespace', {
        scheduleId: config.scheduleId,
        namespace: env.TEMPORAL_NAMESPACE,
      });

      await client.schedule.create({
        scheduleId: config.scheduleId,
        spec: {
          cronExpressions: [config.cronExpression],
        },
        action: {
          type: 'startWorkflow',
          workflowType: config.workflowType,
          args: config.workflowArgs,
          taskQueue: env.TEMPORAL_TASK_QUEUE,
          workflowId: `${config.scheduleId}-${Date.now()}`,
        },
        policies: {
          overlap: 'BUFFER_ONE', // Buffer one execution if previous is still running
          catchupWindow: '1 day', // Catch up missed executions within 1 day
        },
        state: {
          paused: config.paused || false,
          note: config.description,
        },
      });

      logger.info('Schedule created successfully in scheduled namespace', {
        scheduleId: config.scheduleId,
        namespace: env.TEMPORAL_NAMESPACE,
      });
    }
  } catch (error) {
    logger.error('Failed to create/update schedule', {
      scheduleId: config.scheduleId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Setup all schedules
 */
export async function setupSchedules(): Promise<void> {
  try {
    logger.info('Setting up Temporal schedules in scheduled namespace...', {
      count: schedules.length,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    // Parse Temporal address - Connection expects hostname:port, not URL
    // Handle both formats: "http://localhost:7234" -> "localhost:7234" or "localhost:7234"
    let temporalAddress = env.TEMPORAL_ADDRESS;
    try {
      const url = new URL(temporalAddress);
      temporalAddress = `${url.hostname}:${url.port || '7233'}`;
    } catch {
      // Already in hostname:port format or invalid, use as-is
    }

    logger.info('Parsed Temporal address for schedule setup', {
      original: env.TEMPORAL_ADDRESS,
      parsed: temporalAddress,
    });

    // Connect to Temporal
    const connection = await Connection.connect({
      address: temporalAddress,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE, // Use scheduled namespace
    });

    logger.info('Connected to Temporal for schedule setup', {
      namespace: env.TEMPORAL_NAMESPACE,
    });

    // Create/update all schedules
    for (const schedule of schedules) {
      await createOrUpdateSchedule(client, schedule);
    }

    logger.info('All schedules set up successfully in scheduled namespace', {
      namespace: env.TEMPORAL_NAMESPACE,
      total: schedules.length,
      active: schedules.filter((s) => !s.paused).length,
      paused: schedules.filter((s) => s.paused).length,
    });

    // Close connection
    await connection.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Failed to setup schedules', {
      message: errorMessage,
      stack: errorStack,
      temporalAddress: env.TEMPORAL_ADDRESS,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    // Also log to console for better visibility
    console.error('\n=== Schedule Setup Error ===');
    console.error('Message:', errorMessage);
    console.error('Stack:', errorStack);
    console.error('Temporal Address:', env.TEMPORAL_ADDRESS);
    console.error('Namespace:', env.TEMPORAL_NAMESPACE);
    console.error('============================\n');

    throw error;
  }
}

/**
 * List all schedules
 */
export async function listSchedules(): Promise<void> {
  try {
    // Parse Temporal address
    let temporalAddress = env.TEMPORAL_ADDRESS;
    try {
      const url = new URL(temporalAddress);
      temporalAddress = `${url.hostname}:${url.port || '7233'}`;
    } catch {
      // Already in hostname:port format
    }

    const connection = await Connection.connect({
      address: temporalAddress,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    logger.info('Listing all schedules in scheduled namespace...', {
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const schedules = client.schedule.list();

    for await (const schedule of schedules) {
      logger.info('Schedule', {
        scheduleId: schedule.scheduleId,
        spec: schedule.spec,
        info: schedule.info,
      });
    }

    await connection.close();
  } catch (error) {
    logger.error('Failed to list schedules', error as Error);
    throw error;
  }
}

/**
 * Pause a schedule
 */
export async function pauseSchedule(scheduleId: string): Promise<void> {
  try {
    // Parse Temporal address
    let temporalAddress = env.TEMPORAL_ADDRESS;
    try {
      const url = new URL(temporalAddress);
      temporalAddress = `${url.hostname}:${url.port || '7233'}`;
    } catch {
      // Already in hostname:port format
    }

    const connection = await Connection.connect({
      address: temporalAddress,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const handle = client.schedule.getHandle(scheduleId);
    await handle.pause('Paused via CLI');

    logger.info('Schedule paused', {
      scheduleId,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    await connection.close();
  } catch (error) {
    logger.error('Failed to pause schedule', {
      scheduleId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Unpause a schedule
 */
export async function unpauseSchedule(scheduleId: string): Promise<void> {
  try {
    // Parse Temporal address
    let temporalAddress = env.TEMPORAL_ADDRESS;
    try {
      const url = new URL(temporalAddress);
      temporalAddress = `${url.hostname}:${url.port || '7233'}`;
    } catch {
      // Already in hostname:port format
    }

    const connection = await Connection.connect({
      address: temporalAddress,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const handle = client.schedule.getHandle(scheduleId);
    await handle.unpause('Unpaused via CLI');

    logger.info('Schedule unpaused', {
      scheduleId,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    await connection.close();
  } catch (error) {
    logger.error('Failed to unpause schedule', {
      scheduleId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  try {
    // Parse Temporal address
    let temporalAddress = env.TEMPORAL_ADDRESS;
    try {
      const url = new URL(temporalAddress);
      temporalAddress = `${url.hostname}:${url.port || '7233'}`;
    } catch {
      // Already in hostname:port format
    }

    const connection = await Connection.connect({
      address: temporalAddress,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const handle = client.schedule.getHandle(scheduleId);
    await handle.delete();

    logger.info('Schedule deleted', {
      scheduleId,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    await connection.close();
  } catch (error) {
    logger.error('Failed to delete schedule', {
      scheduleId,
      error: (error as Error).message,
    });
    throw error;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const scheduleId = process.argv[3];

  switch (command) {
    case 'setup':
      setupSchedules()
        .then(() => {
          logger.info('Schedules setup complete');
          process.exit(0);
        })
        .catch((err) => {
          logger.error('Setup failed', err);
          process.exit(1);
        });
      break;

    case 'list':
      listSchedules()
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('List failed', err);
          process.exit(1);
        });
      break;

    case 'pause':
      if (!scheduleId) {
        logger.error('Schedule ID required');
        process.exit(1);
      }
      pauseSchedule(scheduleId)
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('Pause failed', err);
          process.exit(1);
        });
      break;

    case 'unpause':
      if (!scheduleId) {
        logger.error('Schedule ID required');
        process.exit(1);
      }
      unpauseSchedule(scheduleId)
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('Unpause failed', err);
          process.exit(1);
        });
      break;

    case 'delete':
      if (!scheduleId) {
        logger.error('Schedule ID required');
        process.exit(1);
      }
      deleteSchedule(scheduleId)
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('Delete failed', err);
          process.exit(1);
        });
      break;

    case 'cleanup':
      cleanupOldSchedules()
        .then(() => {
          logger.info('Cleanup complete');
          process.exit(0);
        })
        .catch((err) => {
          logger.error('Cleanup failed', err);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Usage:
  bun run schedules.ts setup              - Create/update all schedules
  bun run schedules.ts list               - List all schedules
  bun run schedules.ts pause <scheduleId> - Pause a schedule
  bun run schedules.ts unpause <scheduleId> - Unpause a schedule
  bun run schedules.ts delete <scheduleId> - Delete a schedule
  bun run schedules.ts cleanup            - Delete old/invalid schedules
      `);
      process.exit(1);
  }
}

/**
 * Cleanup old/invalid schedules
 * Deletes schedules that reference non-existent workflows
 */
async function cleanupOldSchedules(): Promise<void> {
  const oldScheduleIds = [
    'bulk-refresh-daily',
    'bulk-refresh-high-priority',
    'bulk-refresh-hourly-testing',
    'bulk-refresh-1-seconds',
  ];

  logger.info('Starting cleanup of old schedules', {
    scheduleIds: oldScheduleIds,
  });

  // Parse Temporal address
  let temporalAddress = env.TEMPORAL_ADDRESS;
  try {
    const url = new URL(temporalAddress);
    temporalAddress = `${url.hostname}:${url.port || '7233'}`;
  } catch {
    // Already in hostname:port format
  }

  const connection = await Connection.connect({
    address: temporalAddress,
  });

  const client = new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
  });

  let deleted = 0;
  let notFound = 0;
  let errors = 0;

  for (const scheduleId of oldScheduleIds) {
    try {
      const handle = client.schedule.getHandle(scheduleId);
      try {
        await handle.describe();
        // Schedule exists, delete it
        await handle.delete();
        logger.info('Deleted old schedule', { scheduleId });
        deleted++;
      } catch (error) {
        // Schedule doesn't exist
        logger.info('Schedule not found (may already be deleted)', {
          scheduleId,
        });
        notFound++;
      }
    } catch (error) {
      logger.error('Failed to delete schedule', {
        scheduleId,
        error: (error as Error).message,
      });
      errors++;
    }
  }

  await connection.close();

  logger.info('Cleanup completed', {
    deleted,
    notFound,
    errors,
    total: oldScheduleIds.length,
  });
}
